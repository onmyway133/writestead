// Creates a blog with sample content through the public API, the same way a person would.
//
//   node scripts/seed.mjs demo --root https://writestead.com --email you@example.com --password '...'
//   node scripts/seed.mjs flagship --root https://writestead.com --email you@example.com --password '...'
//
// "demo" builds the Field Notes sample blog on demo.<root>; "flagship" builds the Writestead blog on blog.<root>.
// On a self-hosted install pass --blog <url> instead of --root, and the account must exist already.
import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { DEMO, FLAGSHIP } from "./seed/content.mjs";

const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: { root: { type: "string" }, blog: { type: "string" }, email: { type: "string" }, password: { type: "string" }, name: { type: "string" } },
});
const content = positionals[0] === "flagship" ? FLAGSHIP : DEMO;
if (!values.email || !values.password || (!values.root && !values.blog))
{
    console.error("Usage: node scripts/seed.mjs demo|flagship --root <url> | --blog <url> --email <email> --password <password>");
    process.exit(1);
}

let cookie = "";

async function call(base, path, options = {})
{
    const response = await fetch(`${base}/api${path}`, {
        method: options.method ?? (options.body || options.form ? "POST" : "GET"),
        headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...(cookie ? { Cookie: cookie } : {}) },
        body: options.form ?? (options.body ? JSON.stringify(options.body) : undefined),
    });
    const setCookie = response.headers.get("set-cookie");
    if (setCookie?.includes("ws_session="))
    {
        cookie = setCookie.split(";")[0];
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok)
    {
        throw new Error(`${path}: ${data.error ?? response.status}`);
    }
    return data;
}

let blog = values.blog;
if (values.root)
{
    const root = values.root.replace(/\/$/, "");
    const host = new URL(root).host;
    blog = `${new URL(root).protocol}//${content.subdomain}.${host}`;
    try
    {
        await call(root, "/auth/signup", { body: { email: values.email, password: values.password, name: values.name ?? content.author.name, title: content.title, subdomain: content.subdomain } });
        console.log(`Created ${blog}`);
    }
    catch (error)
    {
        console.log(`Signup skipped (${error.message}), signing in instead`);
    }
}
await call(blog, "/auth/login", { body: { email: values.email, password: values.password } });

async function upload(file)
{
    const bytes = await readFile(new URL(`./seed/${file}`, import.meta.url));
    const form = new FormData();
    form.append("file", new Blob([bytes], { type: "image/webp" }), file);
    return (await call(blog, "/admin/media", { form })).url;
}

const me = await call(blog, "/admin/me");
await call(blog, "/admin/profile", { method: "PUT", body: { name: content.author.name, slug: content.author.slug, bio: content.author.bio, website: content.author.website ?? "" } });
await call(blog, "/admin/settings", { method: "PUT", body: { title: content.title, description: content.description, settings: { ...me.site.settings, ...content.settings } } });

const existing = await call(blog, "/admin/posts?type=post");
const existingPages = await call(blog, "/admin/posts?type=page");
const day = 86400;
const now = Math.floor(Date.now() / 1000);

for (const page of content.pages)
{
    const found = existingPages.posts.find((item) => item.slug === page.slug);
    const id = found?.id ?? (await call(blog, "/admin/posts", { body: { type: "page", title: page.title } })).post.id;
    await call(blog, `/admin/posts/${id}`, { method: "PUT", body: { title: page.title, slug: page.slug, content: page.content, status: "published" } });
    console.log(`Page /${page.slug}`);
}

for (const [index, post] of content.posts.entries())
{
    if (existing.posts.some((item) => item.slug === post.slug))
    {
        console.log(`Skip /${post.slug} (exists)`);
        continue;
    }
    const { post: created } = await call(blog, "/admin/posts", { body: { title: post.title } });
    const cover = post.cover ? await upload(post.cover) : "";
    await call(blog, `/admin/posts/${created.id}`, {
        method: "PUT",
        body: {
            title: post.title,
            slug: post.slug,
            excerpt: post.excerpt,
            content: post.content,
            cover_image: cover,
            tag_names: post.tags,
            featured: post.featured ?? false,
            visibility: post.visibility ?? "public",
            status: "published",
            published_at: now - (post.daysAgo ?? index * 4 + 1) * day,
        },
    });
    console.log(`Post /${post.slug}`);
}
console.log(`Done: ${blog}`);
