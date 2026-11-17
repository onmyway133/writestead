import { parseCsv } from "./csv";

// Every importer turns another platform's export into this shape. Post bodies may be HTML;
// Markdown allows raw HTML, so imported posts render as they did before.

export type ImportedPost = {
    type: "post" | "page";
    title: string;
    slug: string;
    content: string;
    excerpt: string;
    status: "draft" | "published";
    published_at: number | null;
    tags: string[];
    cover_image: string;
    visibility: "public" | "members" | "paid";
};

export type ImportedSubscriber = { email: string; name: string; tier: "free" | "paid" | "comp"; created_at: number | null };

export type ImportBundle = { posts: ImportedPost[]; subscribers: ImportedSubscriber[] };

function seconds(value: string | number | null | undefined): number | null
{
    if (value === null || value === undefined || value === "")
    {
        return null;
    }
    const time = typeof value === "number" ? value : Date.parse(String(value).replace(" ", "T") + (/[zZ]|[+-]\d\d:?\d\d$/.test(String(value)) ? "" : "Z"));
    return Number.isFinite(time) ? Math.floor(time / 1000) : null;
}

function slugFrom(value: string): string
{
    return value.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

function decodeEntities(value: string): string
{
    return value
        .replace(/&#(\d+);/g, (_m, code: string) => String.fromCodePoint(Number(code)))
        .replace(/&#x([0-9a-f]+);/gi, (_m, code: string) => String.fromCodePoint(parseInt(code, 16)))
        .replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
}

// ---------- Ghost (JSON export from Settings > Migration) ----------

type GhostData = {
    posts?: { id: string; title: string; slug: string; html?: string | null; plaintext?: string | null; custom_excerpt?: string | null; status: string; type?: string; published_at?: string | null; feature_image?: string | null; visibility?: string; page?: boolean }[];
    tags?: { id: string; name: string }[];
    posts_tags?: { post_id: string; tag_id: string }[];
    members?: { email: string; name?: string | null; status?: string; created_at?: string }[];
};

export function parseGhost(json: string): ImportBundle
{
    const parsed = JSON.parse(json);
    const data: GhostData = parsed?.db?.[0]?.data ?? parsed?.data ?? {};
    const tagNames = new Map((data.tags ?? []).map((tag) => [tag.id, tag.name]));
    const posts = (data.posts ?? []).map((post): ImportedPost => ({
        type: post.type === "page" || post.page ? "page" : "post",
        title: post.title ?? "",
        slug: post.slug ?? slugFrom(post.title ?? ""),
        content: post.html ?? post.plaintext ?? "",
        excerpt: post.custom_excerpt ?? "",
        status: post.status === "published" ? "published" : "draft",
        published_at: seconds(post.published_at),
        tags: (data.posts_tags ?? []).filter((link) => link.post_id === post.id).map((link) => tagNames.get(link.tag_id) ?? "").filter((name) => name && !name.startsWith("#")),
        cover_image: post.feature_image ?? "",
        visibility: post.visibility === "paid" || post.visibility === "tiers" ? "paid" : post.visibility === "members" ? "members" : "public",
    }));
    const subscribers = (data.members ?? []).map((member): ImportedSubscriber => ({
        email: member.email,
        name: member.name ?? "",
        tier: member.status === "paid" ? "paid" : member.status === "comped" ? "comp" : "free",
        created_at: seconds(member.created_at),
    }));
    return { posts, subscribers };
}

// ---------- WordPress (WXR XML from Tools > Export) ----------

function tagValue(xml: string, name: string): string
{
    const match = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`));
    if (!match)
    {
        return "";
    }
    const cdata = match[1].match(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/);
    return cdata ? cdata[1] : decodeEntities(match[1].trim());
}

export function parseWordPress(xml: string): ImportBundle
{
    const posts: ImportedPost[] = [];
    // Attachments map post ids to image URLs, for featured images.
    const attachments = new Map<string, string>();
    const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
    for (const item of items)
    {
        if (tagValue(item, "wp:post_type") === "attachment")
        {
            attachments.set(tagValue(item, "wp:post_id"), tagValue(item, "wp:attachment_url"));
        }
    }
    for (const item of items)
    {
        const type = tagValue(item, "wp:post_type");
        if (type !== "post" && type !== "page")
        {
            continue;
        }
        const status = tagValue(item, "wp:status");
        if (status === "trash" || status === "auto-draft")
        {
            continue;
        }
        const tags = [...item.matchAll(/<category domain="(?:post_tag|category)"[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/category>/g)]
            .map((match) => decodeEntities(match[1].trim()))
            .filter((name) => name && name !== "Uncategorized");
        const thumbnail = item.match(/<wp:meta_key>(?:<!\[CDATA\[)?_thumbnail_id(?:\]\]>)?<\/wp:meta_key>\s*<wp:meta_value>(?:<!\[CDATA\[)?(\d+)/);
        const title = tagValue(item, "title");
        const content = tagValue(item, "content:encoded").replace(/<!-- \/?wp:[\s\S]*?-->\n?/g, "");
        posts.push({
            type,
            title,
            slug: tagValue(item, "wp:post_name") || slugFrom(title),
            content: /<p[\s>]/.test(content) ? content : content.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean).join("\n\n"),
            excerpt: tagValue(item, "excerpt:encoded"),
            status: status === "publish" ? "published" : "draft",
            published_at: seconds(tagValue(item, "wp:post_date_gmt") || tagValue(item, "pubDate")),
            tags: [...new Set(tags)],
            cover_image: thumbnail ? attachments.get(thumbnail[1]) ?? "" : "",
            visibility: "public",
        });
    }
    return { posts, subscribers: [] };
}

// ---------- Substack (posts.csv + posts/<id>.<slug>.html from the export ZIP, email_list CSV) ----------

export function parseSubstack(files: Record<string, string>): ImportBundle
{
    const posts: ImportedPost[] = [];
    const subscribers: ImportedSubscriber[] = [];
    const postsCsv = Object.entries(files).find(([name]) => /(^|\/)posts\.csv$/.test(name))?.[1];
    if (postsCsv)
    {
        const rows = parseCsv(postsCsv);
        const header = rows[0] ?? [];
        const col = (name: string) => header.indexOf(name);
        for (const row of rows.slice(1))
        {
            const id = row[col("post_id")] ?? "";
            const htmlFile = Object.entries(files).find(([name]) => name.endsWith(`/${id}.html`) || name.endsWith(`${id}.html`));
            if (row[col("type")] && row[col("type")] !== "newsletter")
            {
                continue;
            }
            const title = row[col("title")] ?? "";
            const audience = row[col("audience")] ?? "everyone";
            posts.push({
                type: "post",
                title,
                slug: id.split(".").slice(1).join(".") || slugFrom(title),
                content: htmlFile?.[1] ?? "",
                excerpt: row[col("subtitle")] ?? "",
                status: row[col("is_published")] === "true" ? "published" : "draft",
                published_at: seconds(row[col("post_date")]),
                tags: [],
                cover_image: "",
                visibility: audience === "only_paid" ? "paid" : audience === "only_free" ? "members" : "public",
            });
        }
    }
    for (const [name, csv] of Object.entries(files))
    {
        if (!/email_list.*\.csv$|subscribers.*\.csv$/i.test(name))
        {
            continue;
        }
        subscribers.push(...parseSubscriberCsv(csv));
    }
    return { posts, subscribers };
}

export function parseSubscriberCsv(csv: string): ImportedSubscriber[]
{
    const rows = parseCsv(csv);
    const header = (rows[0] ?? []).map((cell) => cell.trim().toLowerCase());
    const email = header.findIndex((cell) => cell === "email" || cell === "email address");
    const name = header.findIndex((cell) => cell === "name" || cell === "full name");
    const plan = header.findIndex((cell) => cell === "plan" || cell === "subscription_type" || cell === "tier");
    const created = header.findIndex((cell) => cell === "created_at" || cell === "subscription_date" || cell === "active_subscription_start" || cell === "created");
    if (email === -1)
    {
        return [];
    }
    return rows.slice(1).filter((row) => row[email]?.includes("@")).map((row) => ({
        email: row[email].trim().toLowerCase(),
        name: name >= 0 ? row[name] ?? "" : "",
        tier: plan >= 0 && /paid|founding|annual|monthly/i.test(row[plan] ?? "") ? "paid" : plan >= 0 && /comp/i.test(row[plan] ?? "") ? "comp" : "free",
        created_at: created >= 0 ? seconds(row[created]) : null,
    }));
}

// ---------- Medium (posts/*.html from the export ZIP) ----------

export function parseMediumHtml(html: string, filename: string): ImportedPost | null
{
    if (/^posts\/draft_/.test(filename.split("/").slice(-2).join("/")) && !/<time/.test(html))
    {
        // Drafts still import, as drafts.
    }
    const title = decodeEntities((html.match(/<h1[^>]*class="p-name"[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? html.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "").replace(/<[^>]+>/g, "").trim());
    const body = html.match(/<section data-field="body"[^>]*>([\s\S]*?)<\/section>\s*<footer/)?.[1] ?? html.match(/<section data-field="body"[^>]*>([\s\S]*)<\/section>/)?.[1] ?? "";
    if (!title && !body)
    {
        return null;
    }
    const published = html.match(/<time[^>]*class="dt-published"[^>]*datetime="([^"]+)"/)?.[1];
    const subtitle = html.match(/<section data-field="subtitle"[^>]*>([\s\S]*?)<\/section>/)?.[1]?.replace(/<[^>]+>/g, "").trim() ?? "";
    const canonical = html.match(/<a[^>]*class="p-canonical"[^>]*href="([^"]+)"/)?.[1] ?? "";
    // Medium repeats the title as the first heading of the body.
    const content = body.replace(/<h3[^>]*class="graf graf--h3 graf--leading graf--title"[^>]*>[\s\S]*?<\/h3>/, "").replace(/\s(class|name|id|data-[\w-]+)="[^"]*"/g, "");
    const image = content.match(/<img[^>]+src="([^"]+)"/)?.[1] ?? "";
    return {
        type: "post",
        title,
        slug: canonical.split("/").pop()?.replace(/-[0-9a-f]{8,12}$/, "") || slugFrom(title),
        content: content.trim(),
        excerpt: decodeEntities(subtitle),
        status: published && !filename.includes("draft_") ? "published" : "draft",
        published_at: seconds(published),
        tags: [],
        cover_image: image,
        visibility: "public",
    };
}

// ---------- Markdown files with optional YAML front matter ----------

export function parseMarkdownFile(text: string, filename: string): ImportedPost
{
    let body = text.replace(/^﻿/, "");
    const meta: Record<string, string> = {};
    const frontMatter = body.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
    if (frontMatter)
    {
        body = body.slice(frontMatter[0].length);
        let lastKey = "";
        for (const line of frontMatter[1].split(/\r?\n/))
        {
            const pair = line.match(/^([\w-]+):\s*(.*)$/);
            if (pair)
            {
                lastKey = pair[1].toLowerCase();
                meta[lastKey] = pair[2].trim().replace(/^["']|["']$/g, "");
            }
            else if (/^\s*-\s+/.test(line) && lastKey)
            {
                // A YAML list under the last key, e.g. tags:\n  - one
                meta[lastKey] = [meta[lastKey], line.replace(/^\s*-\s+/, "").trim().replace(/^["']|["']$/g, "")].filter(Boolean).join(",");
            }
        }
    }
    let title = meta.title ?? "";
    if (!title)
    {
        const heading = body.match(/^#\s+(.+)\n/);
        if (heading)
        {
            title = heading[1].trim();
            body = body.slice(heading[0].length);
        }
    }
    const base = filename.split("/").pop()!.replace(/\.(md|markdown|mdx)$/i, "").replace(/^\d{4}-\d{2}-\d{2}-/, "");
    title ||= base.replace(/[-_]/g, " ");
    const tags = (meta.tags ?? meta.categories ?? "").replace(/^\[|\]$/g, "").split(",").map((tag) => tag.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
    return {
        type: meta.type === "page" || meta.layout === "page" ? "page" : "post",
        title,
        slug: meta.slug || slugFrom(base) || slugFrom(title),
        content: body.trim(),
        excerpt: meta.description ?? meta.excerpt ?? meta.summary ?? "",
        status: meta.draft === "true" || meta.published === "false" || meta.status === "draft" ? "draft" : "published",
        published_at: seconds(meta.date ?? filename.match(/(\d{4}-\d{2}-\d{2})/)?.[1]),
        tags,
        cover_image: meta.cover_image ?? meta.image ?? meta.cover ?? "",
        visibility: "public",
    };
}
