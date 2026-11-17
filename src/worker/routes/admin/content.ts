import { Hono, type Context } from "hono";
import type { Post, PostSummary } from "../../../shared/types";
import { can, type HonoEnv, requirePermission } from "../../auth";
import { queueNewsletter } from "../../email";
import { ApiError, badRequest, newId, notFound, now, readJson, text } from "../../lib/http";
import { excerptOf, slugify } from "../../lib/text";
import { deleteMedia, putMedia } from "../../media";
import { fireWebhooks } from "../../webhooks";

type C = Context<HonoEnv>;

export const contentRoutes = new Hono<HonoEnv>();

const SUMMARY_COLUMNS = `p.id, p.type, p.title, p.slug, p.excerpt, p.cover_image, p.status, p.visibility, p.featured, p.delivery,
    p.published_at, p.emailed_at, p.updated_at,
    COALESCE((SELECT GROUP_CONCAT(u.name, ', ') FROM post_authors pa JOIN users u ON u.id = pa.user_id WHERE pa.post_id = p.id), '') AS authors,
    COALESCE((SELECT GROUP_CONCAT(t.name, ', ') FROM post_tags pt JOIN tags t ON t.id = pt.tag_id WHERE pt.post_id = p.id), '') AS tags`;

contentRoutes.get("/posts", async (c) =>
{
    const site = c.get("site");
    const type = c.req.query("type") === "page" ? "page" : "post";
    const status = c.req.query("status") ?? "";
    const query = (c.req.query("q") ?? "").trim();
    const where = ["p.site_id = ?", "p.type = ?"];
    const binds: unknown[] = [site.id, type];
    if (["draft", "scheduled", "published", "unlisted"].includes(status))
    {
        where.push("p.status = ?");
        binds.push(status);
    }
    if (query)
    {
        where.push("p.title LIKE ?");
        binds.push(`%${query}%`);
    }
    // Authors and contributors only see their own posts.
    if (!can(c.get("role"), "edit_any_post"))
    {
        where.push("p.id IN (SELECT post_id FROM post_authors WHERE user_id = ?)");
        binds.push(c.get("user").id);
    }
    const { results } = await c.env.DB
        .prepare(`SELECT ${SUMMARY_COLUMNS} FROM posts p WHERE ${where.join(" AND ")} ORDER BY COALESCE(p.published_at, p.updated_at) DESC LIMIT 500`)
        .bind(...binds)
        .all<PostSummary>();
    return c.json({ posts: results });
});

async function loadPost(c: C, id: string): Promise<Post>
{
    const site = c.get("site");
    const row = await c.env.DB
        .prepare(`SELECT ${SUMMARY_COLUMNS}, p.content, p.meta_title, p.meta_description, p.canonical_url, p.og_image, p.email_segment FROM posts p WHERE p.id = ? AND p.site_id = ?`)
        .bind(id, site.id)
        .first<Omit<Post, "author_ids" | "tag_names">>();
    if (!row)
    {
        throw notFound("That post doesn't exist.");
    }
    const [authors, tags] = await c.env.DB.batch<{ id: string; name: string }>([
        c.env.DB.prepare("SELECT user_id AS id FROM post_authors WHERE post_id = ? ORDER BY sort").bind(id),
        c.env.DB.prepare("SELECT t.name FROM post_tags pt JOIN tags t ON t.id = pt.tag_id WHERE pt.post_id = ? ORDER BY pt.sort").bind(id),
    ]);
    const post = { ...row, author_ids: authors.results.map((item) => item.id), tag_names: tags.results.map((item) => item.name) };
    if (!can(c.get("role"), "edit_any_post") && !post.author_ids.includes(c.get("user").id))
    {
        throw new ApiError(403, "forbidden", "You can only edit your own posts.");
    }
    return post;
}

contentRoutes.get("/posts/:id", async (c) =>
{
    return c.json({ post: await loadPost(c, c.req.param("id")) });
});

async function uniqueSlug(c: C, type: string, wanted: string, exceptId: string | null): Promise<string>
{
    const site = c.get("site");
    const base = slugify(wanted);
    const reserved = new Set(["admin", "api", "tag", "author", "archive", "search", "subscribe", "account", "media", "embed", "message", "rss", "feed", "sitemap", "robots"]);
    let slug = reserved.has(base) ? `${base}-post` : base;
    for (let attempt = 2; ; attempt++)
    {
        const clash = await c.env.DB.prepare("SELECT id FROM posts WHERE site_id = ? AND slug = ? AND id != ?").bind(site.id, slug, exceptId ?? "").first();
        if (!clash)
        {
            return slug;
        }
        slug = `${base}-${attempt}`;
    }
}

contentRoutes.post("/posts", async (c) =>
{
    const site = c.get("site");
    const body = await readJson<{ type: string; title: string }>(c);
    const type = body.type === "page" ? "page" : "post";
    if (type === "page")
    {
        requirePermission(c, "edit_any_post");
    }
    const id = newId();
    const title = text(body.title, { max: 300, field: "Title" });
    const slug = await uniqueSlug(c, type, title || `untitled-${id.slice(0, 6)}`, null);
    await c.env.DB.batch([
        c.env.DB.prepare("INSERT INTO posts (id, site_id, type, title, slug, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
            .bind(id, site.id, type, title, slug, now(), now()),
        c.env.DB.prepare("INSERT INTO post_authors (post_id, user_id, sort) VALUES (?, ?, 0)").bind(id, c.get("user").id),
    ]);
    return c.json({ post: await loadPost(c, id) });
});

type SaveBody = {
    title: string; slug: string; excerpt: string; content: string; cover_image: string;
    status: string; visibility: string; featured: boolean; delivery: string; email_segment: string;
    meta_title: string; meta_description: string; canonical_url: string; og_image: string;
    published_at: number | null; author_ids: string[]; tag_names: string[];
    autosave: boolean; send_email: boolean;
};

contentRoutes.put("/posts/:id", async (c) =>
{
    const site = c.get("site");
    const role = c.get("role");
    const before = await loadPost(c, c.req.param("id"));
    const body = await readJson<SaveBody>(c);
    const title = text(body.title ?? before.title, { max: 300, field: "Title" });
    const content = typeof body.content === "string" ? body.content : before.content;
    if (content.length > 500_000)
    {
        throw badRequest("This post is too long to save.");
    }
    let status = (["draft", "scheduled", "published", "unlisted"].includes(body.status ?? "") ? body.status : before.status) as Post["status"];
    if (status !== "draft" && status !== before.status && !can(role, "publish"))
    {
        throw new ApiError(403, "forbidden", "Contributors can't publish. Save a draft and ask an editor to publish it.");
    }
    let publishedAt = typeof body.published_at === "number" ? body.published_at : before.published_at;
    if (status === "scheduled")
    {
        if (!publishedAt || publishedAt <= now())
        {
            throw badRequest("Pick a time in the future to schedule this post.");
        }
    }
    if ((status === "published" || status === "unlisted") && !publishedAt)
    {
        publishedAt = now();
    }
    if (status === "published" && publishedAt && publishedAt > now())
    {
        status = "scheduled";
    }
    const slug = body.slug !== undefined && body.slug !== before.slug ? await uniqueSlug(c, before.type, body.slug || title, before.id) : before.slug;
    const visibility = ["public", "members", "paid"].includes(body.visibility ?? "") ? body.visibility! : before.visibility;
    const delivery = ["web", "both", "email"].includes(body.delivery ?? "") ? body.delivery! : before.delivery;
    // An excerpt that was generated from the old content follows the new content; a written one stays.
    const wasAuto = before.excerpt === "" || before.excerpt === excerptOf(before.content);
    const excerpt = text(body.excerpt ?? (wasAuto ? "" : before.excerpt), { max: 600, field: "Excerpt" });
    const statements = [
        c.env.DB.prepare(
            `UPDATE posts SET title = ?, slug = ?, excerpt = ?, content = ?, cover_image = ?, status = ?, visibility = ?, featured = ?, delivery = ?, email_segment = ?,
             meta_title = ?, meta_description = ?, canonical_url = ?, og_image = ?, published_at = ?, updated_at = ? WHERE id = ? AND site_id = ?`
        ).bind(
            title, slug, excerpt || excerptOf(content), content, text(body.cover_image ?? before.cover_image, { max: 1000 }), status, visibility,
            (body.featured ?? before.featured) ? 1 : 0, delivery, text(body.email_segment ?? "all", { max: 80 }) || "all",
            text(body.meta_title ?? before.meta_title, { max: 300 }), text(body.meta_description ?? before.meta_description, { max: 500 }),
            text(body.canonical_url ?? before.canonical_url, { max: 1000 }), text(body.og_image ?? before.og_image, { max: 1000 }),
            publishedAt, now(), before.id, site.id
        ),
    ];
    if (Array.isArray(body.tag_names))
    {
        statements.push(c.env.DB.prepare("DELETE FROM post_tags WHERE post_id = ?").bind(before.id));
        const names = [...new Set(body.tag_names.map((name) => String(name).trim()).filter(Boolean))].slice(0, 20);
        for (const [index, name] of names.entries())
        {
            const tagSlug = slugify(name);
            statements.push(c.env.DB.prepare("INSERT OR IGNORE INTO tags (id, site_id, name, slug) VALUES (?, ?, ?, ?)").bind(newId(), site.id, name.slice(0, 80), tagSlug));
            statements.push(c.env.DB.prepare("INSERT INTO post_tags (post_id, tag_id, sort) SELECT ?, id, ? FROM tags WHERE site_id = ? AND slug = ?").bind(before.id, index, site.id, tagSlug));
        }
    }
    if (Array.isArray(body.author_ids) && body.author_ids.length > 0 && can(role, "edit_any_post"))
    {
        statements.push(c.env.DB.prepare("DELETE FROM post_authors WHERE post_id = ?").bind(before.id));
        for (const [index, userId] of body.author_ids.slice(0, 10).entries())
        {
            statements.push(c.env.DB.prepare("INSERT INTO post_authors (post_id, user_id, sort) SELECT ?, user_id, ? FROM site_members WHERE site_id = ? AND user_id = ?").bind(before.id, index, site.id, String(userId)));
        }
    }
    // Autosaves keep the draft fresh; real saves also add a revision when the text changed.
    if (!body.autosave && (content !== before.content || title !== before.title))
    {
        statements.push(c.env.DB.prepare("INSERT INTO revisions (id, post_id, user_id, title, content, created_at) VALUES (?, ?, ?, ?, ?, ?)").bind(newId(), before.id, c.get("user").id, before.title, before.content, now()));
        statements.push(c.env.DB.prepare("DELETE FROM revisions WHERE post_id = ? AND id NOT IN (SELECT id FROM revisions WHERE post_id = ? ORDER BY created_at DESC LIMIT 50)").bind(before.id, before.id));
    }
    await c.env.DB.batch(statements);
    const after = await loadPost(c, before.id);
    const justPublished = after.status === "published" && before.status !== "published";
    if (justPublished)
    {
        c.executionCtx.waitUntil(fireWebhooks(c.env, site.id, "post.published", { id: after.id, title: after.title, slug: after.slug }));
    }
    let emailed: { recipients: number } | null = null;
    if (justPublished && body.send_email && after.delivery !== "web" && !after.emailed_at && after.type === "post")
    {
        requirePermission(c, "manage_subscribers");
        emailed = await queueNewsletter(c.env, site, after, text(body.email_segment, { max: 80 }) || "all");
    }
    return c.json({ post: await loadPost(c, before.id), emailed });
});

contentRoutes.delete("/posts/:id", async (c) =>
{
    const post = await loadPost(c, c.req.param("id"));
    if (post.status !== "draft")
    {
        requirePermission(c, "edit_any_post");
    }
    await c.env.DB.prepare("DELETE FROM posts WHERE id = ? AND site_id = ?").bind(post.id, c.get("site").id).run();
    c.executionCtx.waitUntil(fireWebhooks(c.env, c.get("site").id, "post.deleted", { id: post.id, slug: post.slug }));
    return c.json({ ok: true });
});

contentRoutes.post("/posts/:id/duplicate", async (c) =>
{
    const post = await loadPost(c, c.req.param("id"));
    const id = newId();
    const slug = await uniqueSlug(c, post.type, `${post.slug}-copy`, null);
    await c.env.DB.batch([
        c.env.DB.prepare(
            `INSERT INTO posts (id, site_id, type, title, slug, excerpt, content, cover_image, visibility, meta_title, meta_description, og_image, created_at, updated_at)
             SELECT ?, site_id, type, title || ' (copy)', ?, excerpt, content, cover_image, visibility, meta_title, meta_description, og_image, ?, ? FROM posts WHERE id = ?`
        ).bind(id, slug, now(), now(), post.id),
        c.env.DB.prepare("INSERT INTO post_authors (post_id, user_id, sort) VALUES (?, ?, 0)").bind(id, c.get("user").id),
        c.env.DB.prepare("INSERT INTO post_tags (post_id, tag_id, sort) SELECT ?, tag_id, sort FROM post_tags WHERE post_id = ?").bind(id, post.id),
    ]);
    return c.json({ id });
});

contentRoutes.get("/posts/:id/revisions", async (c) =>
{
    const post = await loadPost(c, c.req.param("id"));
    const { results } = await c.env.DB
        .prepare("SELECT r.id, r.title, r.content, r.created_at, COALESCE(u.name, '') AS author FROM revisions r LEFT JOIN users u ON u.id = r.user_id WHERE r.post_id = ? ORDER BY r.created_at DESC")
        .bind(post.id)
        .all();
    return c.json({ revisions: results });
});

contentRoutes.post("/posts/:id/send", async (c) =>
{
    requirePermission(c, "manage_subscribers");
    const post = await loadPost(c, c.req.param("id"));
    if (post.status !== "published" && post.delivery !== "email")
    {
        throw badRequest("Publish the post before emailing it.");
    }
    if (post.emailed_at)
    {
        throw new ApiError(409, "already_sent", "This post was already sent as an email.");
    }
    const body = await readJson<{ segment: string }>(c);
    return c.json(await queueNewsletter(c.env, c.get("site"), post, text(body.segment, { max: 80 }) || "all"));
});

// ---------- Tags ----------

contentRoutes.get("/tags", async (c) =>
{
    const { results } = await c.env.DB
        .prepare("SELECT t.id, t.name, t.slug, t.description, (SELECT COUNT(*) FROM post_tags pt WHERE pt.tag_id = t.id) AS count FROM tags t WHERE t.site_id = ? ORDER BY t.name")
        .bind(c.get("site").id)
        .all();
    return c.json({ tags: results });
});

contentRoutes.put("/tags/:id", async (c) =>
{
    requirePermission(c, "edit_any_post");
    const body = await readJson<{ name: string; slug: string; description: string }>(c);
    const name = text(body.name, { max: 80, field: "Name" });
    if (!name)
    {
        throw badRequest("Give the tag a name.");
    }
    await c.env.DB.prepare("UPDATE tags SET name = ?, slug = ?, description = ? WHERE id = ? AND site_id = ?")
        .bind(name, slugify(body.slug || name), text(body.description, { max: 500 }), c.req.param("id"), c.get("site").id).run()
        .catch(() =>
        {
            throw new ApiError(409, "slug_taken", "Another tag already uses that slug.");
        });
    return c.json({ ok: true });
});

contentRoutes.delete("/tags/:id", async (c) =>
{
    requirePermission(c, "edit_any_post");
    await c.env.DB.prepare("DELETE FROM tags WHERE id = ? AND site_id = ?").bind(c.req.param("id"), c.get("site").id).run();
    return c.json({ ok: true });
});

// ---------- Media ----------

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp", "image/avif", "image/svg+xml"]);
const MAX_UPLOAD = 10 * 1024 * 1024;

contentRoutes.post("/media", async (c) =>
{
    const site = c.get("site");
    const form = await c.req.parseBody();
    const file = form.file;
    if (!(file instanceof File))
    {
        throw badRequest("Choose a file to upload.");
    }
    if (!IMAGE_TYPES.has(file.type) && !file.type.startsWith("video/") && file.type !== "application/pdf" && !file.type.startsWith("audio/"))
    {
        throw badRequest("Upload an image, video, audio file or PDF.");
    }
    if (file.size > MAX_UPLOAD)
    {
        throw new ApiError(413, "too_large", "Files can be up to 10 MB.");
    }
    const id = newId();
    const extension = (file.name.split(".").pop() ?? "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "bin";
    const key = `${site.id}/${new Date().toISOString().slice(0, 7)}/${id}.${extension}`;
    await putMedia(c.env, key, file.stream(), file.type);
    await c.env.DB.prepare("INSERT INTO media (id, site_id, key, filename, mime, size, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .bind(id, site.id, key, file.name.slice(0, 200), file.type, file.size, now()).run();
    return c.json({ id, url: `/media/${key}`, filename: file.name, mime: file.type });
});

contentRoutes.get("/media", async (c) =>
{
    const { results } = await c.env.DB
        .prepare("SELECT id, key, filename, mime, size, created_at FROM media WHERE site_id = ? ORDER BY created_at DESC LIMIT 200")
        .bind(c.get("site").id)
        .all<{ id: string; key: string; filename: string; mime: string; size: number; created_at: number }>();
    return c.json({ media: results.map((item) => ({ ...item, url: `/media/${item.key}` })) });
});

contentRoutes.delete("/media/:id", async (c) =>
{
    requirePermission(c, "edit_any_post");
    const row = await c.env.DB.prepare("SELECT key FROM media WHERE id = ? AND site_id = ?").bind(c.req.param("id"), c.get("site").id).first<{ key: string }>();
    if (row)
    {
        await deleteMedia(c.env, row.key);
        await c.env.DB.prepare("DELETE FROM media WHERE id = ?").bind(c.req.param("id")).run();
    }
    return c.json({ ok: true });
});
