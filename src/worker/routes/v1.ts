import { Hono } from "hono";
import { cors } from "hono/cors";
import { renderMarkdown } from "../../shared/markdown";
import type { HonoEnv } from "../auth";
import { findBySlug, listPosts, type PublicPost } from "../blog/data";
import { getEntitlements } from "../env";
import { sha256Hex } from "../lib/crypto";
import { ApiError } from "../lib/http";

// Read-only content API for headless use: posts, pages and tags as JSON. Gated posts are left out.
export const v1Routes = new Hono<HonoEnv>();

v1Routes.use("*", cors({ origin: "*", allowMethods: ["GET"] }));

v1Routes.use("*", async (c, next) =>
{
    const site = c.get("site");
    if (!getEntitlements(c.env, site).canUseApi)
    {
        throw new ApiError(402, "upgrade_required", "The API is part of Pro.");
    }
    const key = c.req.header("authorization")?.replace(/^Bearer\s+/i, "") ?? c.req.query("key") ?? "";
    const row = key ? await c.env.DB.prepare("SELECT 1 FROM api_keys WHERE site_id = ? AND key_hash = ?").bind(site.id, await sha256Hex(key)).first() : null;
    if (!row)
    {
        throw new ApiError(401, "invalid_key", "Pass a valid API key as a Bearer token.");
    }
    await next();
});

function serialize(post: PublicPost)
{
    const isPublic = post.visibility === "public";
    return {
        id: post.id,
        type: post.type,
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt,
        html: isPublic ? renderMarkdown(post.content) : null,
        markdown: isPublic ? post.content : null,
        visibility: post.visibility,
        featured: post.featured === 1,
        cover_image: post.cover_image,
        published_at: new Date(post.published_at * 1000).toISOString(),
        updated_at: new Date(post.updated_at * 1000).toISOString(),
        authors: post.authors.map(({ name, slug }) => ({ name, slug })),
        tags: post.tags.map(({ name, slug }) => ({ name, slug })),
    };
}

v1Routes.get("/posts", async (c) =>
{
    const page = Math.max(1, Number(c.req.query("page")) || 1);
    const limit = Math.min(Math.max(Number(c.req.query("limit")) || 15, 1), 50);
    const { posts, total } = await listPosts(c.env.DB, c.get("site"), { page, limit });
    return c.json({ posts: posts.map(serialize), meta: { page, limit, total } });
});

v1Routes.get("/posts/:slug", async (c) =>
{
    const post = await findBySlug(c.env.DB, c.get("site"), c.req.param("slug"));
    if (!post)
    {
        throw new ApiError(404, "not_found", "No post with that slug.");
    }
    return c.json({ post: serialize(post) });
});

v1Routes.get("/tags", async (c) =>
{
    const { results } = await c.env.DB.prepare("SELECT name, slug, description FROM tags WHERE site_id = ? ORDER BY name").bind(c.get("site").id).all();
    return c.json({ tags: results });
});
