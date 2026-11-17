import type { SiteWithSettings } from "../../shared/types";

export type Author = { id: string; name: string; slug: string; bio: string; avatar: string; website: string };
export type Tag = { id: string; name: string; slug: string; description: string };

export type PublicPost = {
    id: string;
    type: "post" | "page";
    title: string;
    slug: string;
    excerpt: string;
    content: string;
    cover_image: string;
    visibility: "public" | "members" | "paid";
    featured: number;
    status: string;
    published_at: number;
    updated_at: number;
    meta_title: string;
    meta_description: string;
    canonical_url: string;
    og_image: string;
    authors: Author[];
    tags: Tag[];
};

export const PAGE_SIZE = 12;

// Posts a visitor can find by browsing: published and not email-only.
const LISTED = "p.status = 'published' AND p.delivery != 'email'";

type PostRow = Omit<PublicPost, "authors" | "tags">;

const POST_COLUMNS = `p.id, p.type, p.title, p.slug, p.excerpt, p.content, p.cover_image, p.visibility, p.featured, p.status,
    p.published_at, p.updated_at, p.meta_title, p.meta_description, p.canonical_url, p.og_image`;

async function attachRelations(db: D1Database, rows: PostRow[]): Promise<PublicPost[]>
{
    if (rows.length === 0)
    {
        return [];
    }
    const ids = rows.map((row) => row.id);
    const marks = ids.map(() => "?").join(",");
    const [authors, tags] = await db.batch<{ post_id: string } & Author & Tag>([
        db.prepare(
            `SELECT pa.post_id, u.id, u.name, u.slug, u.bio, u.avatar, u.website FROM post_authors pa
             JOIN users u ON u.id = pa.user_id WHERE pa.post_id IN (${marks}) ORDER BY pa.sort`
        ).bind(...ids),
        db.prepare(
            `SELECT pt.post_id, t.id, t.name, t.slug, t.description FROM post_tags pt
             JOIN tags t ON t.id = pt.tag_id WHERE pt.post_id IN (${marks}) ORDER BY pt.sort`
        ).bind(...ids),
    ]);
    return rows.map((row) => ({
        ...row,
        authors: (authors.results as (Author & { post_id: string })[])
            .filter((author) => author.post_id === row.id)
            .map(({ post_id: _id, ...author }) => author),
        tags: (tags.results as (Tag & { post_id: string })[])
            .filter((tag) => tag.post_id === row.id)
            .map(({ post_id: _id, ...tag }) => tag),
    }));
}

export async function listPosts(db: D1Database, site: SiteWithSettings, options: {
    page?: number;
    tagId?: string;
    authorId?: string;
    limit?: number;
    featuredOnly?: boolean;
} = {}): Promise<{ posts: PublicPost[]; total: number }>
{
    const limit = options.limit ?? PAGE_SIZE;
    const offset = Math.max(0, ((options.page ?? 1) - 1) * limit);
    const where = [`p.site_id = ?`, `p.type = 'post'`, LISTED];
    const binds: unknown[] = [site.id];
    if (options.tagId)
    {
        where.push("p.id IN (SELECT post_id FROM post_tags WHERE tag_id = ?)");
        binds.push(options.tagId);
    }
    if (options.authorId)
    {
        where.push("p.id IN (SELECT post_id FROM post_authors WHERE user_id = ?)");
        binds.push(options.authorId);
    }
    if (options.featuredOnly)
    {
        where.push("p.featured = 1");
    }
    const clause = where.join(" AND ");
    const [rows, count] = await db.batch<PostRow & { total: number }>([
        db.prepare(`SELECT ${POST_COLUMNS} FROM posts p WHERE ${clause} ORDER BY p.published_at DESC LIMIT ? OFFSET ?`)
            .bind(...binds, limit, offset),
        db.prepare(`SELECT COUNT(*) AS total FROM posts p WHERE ${clause}`).bind(...binds),
    ]);
    return {
        posts: await attachRelations(db, rows.results as PostRow[]),
        total: (count.results[0] as { total: number } | undefined)?.total ?? 0,
    };
}

// Finds a post or page by slug. Unlisted posts open by direct link but never show in lists.
export async function findBySlug(db: D1Database, site: SiteWithSettings, slug: string): Promise<PublicPost | null>
{
    const row = await db
        .prepare(
            `SELECT ${POST_COLUMNS} FROM posts p
             WHERE p.site_id = ? AND p.slug = ? AND p.status IN ('published', 'unlisted') AND p.delivery != 'email'
             ORDER BY p.type = 'page' DESC LIMIT 1`
        )
        .bind(site.id, slug)
        .first<PostRow>();
    if (!row)
    {
        return null;
    }
    return (await attachRelations(db, [row]))[0];
}

export async function findTag(db: D1Database, site: SiteWithSettings, slug: string): Promise<Tag | null>
{
    return db.prepare("SELECT id, name, slug, description FROM tags WHERE site_id = ? AND slug = ?").bind(site.id, slug).first<Tag>();
}

export async function findAuthor(db: D1Database, site: SiteWithSettings, slug: string): Promise<Author | null>
{
    return db
        .prepare(
            `SELECT u.id, u.name, u.slug, u.bio, u.avatar, u.website FROM users u
             JOIN site_members m ON m.user_id = u.id WHERE m.site_id = ? AND u.slug = ?`
        )
        .bind(site.id, slug)
        .first<Author>();
}

export async function popularTags(db: D1Database, site: SiteWithSettings, limit = 12): Promise<(Tag & { count: number })[]>
{
    const { results } = await db
        .prepare(
            `SELECT t.id, t.name, t.slug, t.description, COUNT(p.id) AS count FROM tags t
             JOIN post_tags pt ON pt.tag_id = t.id JOIN posts p ON p.id = pt.post_id AND ${LISTED}
             WHERE t.site_id = ? GROUP BY t.id ORDER BY count DESC, t.name LIMIT ?`
        )
        .bind(site.id, limit)
        .all<Tag & { count: number }>();
    return results;
}

export async function archive(db: D1Database, site: SiteWithSettings): Promise<{ title: string; slug: string; published_at: number }[]>
{
    const { results } = await db
        .prepare(`SELECT p.title, p.slug, p.published_at FROM posts p WHERE p.site_id = ? AND p.type = 'post' AND ${LISTED} ORDER BY p.published_at DESC`)
        .bind(site.id)
        .all<{ title: string; slug: string; published_at: number }>();
    return results;
}

export async function searchPosts(db: D1Database, site: SiteWithSettings, query: string): Promise<PublicPost[]>
{
    const like = `%${query.replace(/[%_]/g, "")}%`;
    const { results } = await db
        .prepare(
            `SELECT ${POST_COLUMNS} FROM posts p WHERE p.site_id = ? AND p.type = 'post' AND ${LISTED}
             AND (p.title LIKE ? OR p.excerpt LIKE ? OR p.content LIKE ?) ORDER BY p.published_at DESC LIMIT 30`
        )
        .bind(site.id, like, like, like)
        .all<PostRow>();
    return attachRelations(db, results);
}

export async function relatedPosts(db: D1Database, site: SiteWithSettings, post: PublicPost): Promise<PublicPost[]>
{
    const tagIds = post.tags.map((tag) => tag.id);
    const binds: unknown[] = [site.id, post.id];
    let filter = "";
    if (tagIds.length > 0)
    {
        filter = `ORDER BY (SELECT COUNT(*) FROM post_tags pt WHERE pt.post_id = p.id AND pt.tag_id IN (${tagIds.map(() => "?").join(",")})) DESC, p.published_at DESC`;
        binds.push(...tagIds);
    }
    else
    {
        filter = "ORDER BY p.published_at DESC";
    }
    const { results } = await db
        .prepare(`SELECT ${POST_COLUMNS} FROM posts p WHERE p.site_id = ? AND p.type = 'post' AND ${LISTED} AND p.id != ? ${filter} LIMIT 3`)
        .bind(...binds)
        .all<PostRow>();
    return attachRelations(db, results);
}

export async function approvedComments(db: D1Database, postId: string): Promise<{ id: string; name: string; body: string; created_at: number }[]>
{
    const { results } = await db
        .prepare("SELECT id, name, body, created_at FROM comments WHERE post_id = ? AND status = 'approved' ORDER BY created_at")
        .bind(postId)
        .all<{ id: string; name: string; body: string; created_at: number }>();
    return results;
}
