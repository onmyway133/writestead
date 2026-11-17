import { Hono } from "hono";
import type { ImportBundle } from "../../../shared/importers";
import { DEFAULT_SETTINGS, findTheme, readSettings, type SiteSettings } from "../../../shared/settings";
import type { Me, Role } from "../../../shared/types";
import { can, checkEmail, checkPassword, type HonoEnv, passwordFields, requirePermission } from "../../auth";
import { emailConfigured, sendEmail } from "../../email";
import { getEntitlements, isMulti, siteUrl } from "../../env";
import { randomHex, sha256Hex } from "../../lib/crypto";
import { ApiError, badRequest, newId, now, readJson, text } from "../../lib/http";
import { excerptOf, slugify } from "../../lib/text";
import { WEBHOOK_EVENTS } from "../../webhooks";

export const siteRoutes = new Hono<HonoEnv>();

siteRoutes.get("/me", (c) =>
{
    const site = c.get("site");
    const me: Me = {
        user: c.get("user"),
        role: c.get("role"),
        site,
        entitlements: getEntitlements(c.env, site),
        mode: isMulti(c.env) ? "multi" : "single",
        url: siteUrl(c.env, site, new URL(c.req.url).origin),
    };
    return c.json({ ...me, emailConfigured: emailConfigured(c.env), rootDomain: c.env.ROOT_DOMAIN });
});

// ---------- Settings ----------

siteRoutes.put("/settings", async (c) =>
{
    requirePermission(c, "manage_settings");
    const site = c.get("site");
    const entitlements = getEntitlements(c.env, site);
    const body = await readJson<{ title: string; description: string; status: string; settings: Partial<SiteSettings> }>(c);
    const merged = readSettings(JSON.stringify({ ...site.settings, ...(body.settings ?? {}) }));
    // Keep only known keys so the JSON can't grow with junk.
    const settings = Object.fromEntries(Object.keys(DEFAULT_SETTINGS).map((key) => [key, merged[key as keyof SiteSettings]])) as SiteSettings;
    if (findTheme(settings.theme).premium && !entitlements.canUsePremiumThemes && settings.theme !== site.settings.theme)
    {
        throw new ApiError(402, "upgrade_required", `${findTheme(settings.theme).name} is a Pro theme.`);
    }
    if (!entitlements.canUseCodeInjection && (settings.customCss !== site.settings.customCss || settings.headCode !== site.settings.headCode || settings.footerCode !== site.settings.footerCode))
    {
        throw new ApiError(402, "upgrade_required", "Custom CSS and code injection are part of Pro.");
    }
    if (settings.hidePoweredBy && !entitlements.canHidePoweredBy)
    {
        settings.hidePoweredBy = false;
    }
    if (settings.paidEnabled && !entitlements.canUsePaidMembers)
    {
        settings.paidEnabled = false;
    }
    for (const key of ["customCss", "headCode", "footerCode"] as const)
    {
        if (settings[key].length > 50_000)
        {
            throw badRequest("Custom code is limited to 50,000 characters.");
        }
    }
    settings.navigation = settings.navigation.slice(0, 20).map((item) => ({ label: String(item.label).slice(0, 60), url: String(item.url).slice(0, 500) }));
    settings.footerNavigation = settings.footerNavigation.slice(0, 20).map((item) => ({ label: String(item.label).slice(0, 60), url: String(item.url).slice(0, 500) }));
    const title = text(body.title ?? site.title, { max: 120, field: "Title" }) || site.title;
    const status = body.status === "waitlist" ? "waitlist" : body.status === "live" ? "live" : site.status;
    await c.env.DB.prepare("UPDATE sites SET title = ?, description = ?, status = ?, settings = ? WHERE id = ?")
        .bind(title, text(body.description ?? site.description, { max: 500 }), status, JSON.stringify(settings), site.id).run();
    return c.json({ ok: true });
});

const DOMAIN = /^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

siteRoutes.put("/domain", async (c) =>
{
    requirePermission(c, "manage_settings");
    const site = c.get("site");
    if (!getEntitlements(c.env, site).canUseCustomDomain)
    {
        throw new ApiError(402, "upgrade_required", "Custom domains are part of Pro.");
    }
    const body = await readJson<{ domain: string }>(c);
    const domain = (body.domain ?? "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (domain && (!DOMAIN.test(domain) || (isMulti(c.env) && domain.endsWith(c.env.ROOT_DOMAIN))))
    {
        throw badRequest("Enter a domain like blog.example.com.");
    }
    await c.env.DB.prepare("UPDATE sites SET custom_domain = ? WHERE id = ?").bind(domain || null, site.id).run()
        .catch(() =>
        {
            throw new ApiError(409, "domain_taken", "Another blog already uses that domain.");
        });
    return c.json({ ok: true, domain: domain || null, target: isMulti(c.env) ? `custom.${c.env.ROOT_DOMAIN}` : new URL(c.req.url).hostname });
});

// ---------- Staff ----------

siteRoutes.get("/staff", async (c) =>
{
    const { results } = await c.env.DB.prepare(
        `SELECT u.id, u.name, u.email, u.slug, u.avatar, m.role, m.created_at,
            (SELECT COUNT(*) FROM post_authors pa JOIN posts p ON p.id = pa.post_id WHERE pa.user_id = u.id AND p.site_id = m.site_id) AS posts
         FROM site_members m JOIN users u ON u.id = m.user_id WHERE m.site_id = ? ORDER BY m.created_at`
    ).bind(c.get("site").id).all();
    return c.json({ staff: results, limit: getEntitlements(c.env, c.get("site")).staffLimit });
});

const ROLES: Role[] = ["admin", "editor", "author", "contributor"];

siteRoutes.post("/staff/invite", async (c) =>
{
    requirePermission(c, "manage_staff");
    const site = c.get("site");
    const body = await readJson<{ email: string; role: Role }>(c);
    const email = checkEmail(body.email);
    const role = ROLES.includes(body.role as Role) ? body.role! : "author";
    if (role === "admin" && c.get("role") !== "owner")
    {
        throw new ApiError(403, "forbidden", "Only the owner can invite admins.");
    }
    const count = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM site_members WHERE site_id = ?").bind(site.id).first<{ n: number }>();
    if ((count?.n ?? 0) >= getEntitlements(c.env, site).staffLimit)
    {
        throw new ApiError(402, "upgrade_required", "Free and Pro are for one writer. Upgrade to Teams to invite teammates.");
    }
    const code = randomHex(24);
    await c.env.CACHE.put(`invite:${await sha256Hex(code)}`, JSON.stringify({ siteId: site.id, email, role, siteTitle: site.title }), { expirationTtl: 7 * 86400 });
    const link = `${siteUrl(c.env, site, new URL(c.req.url).origin)}/admin/invite?code=${code}`;
    const outcome = await sendEmail(c.env, {
        to: email,
        subject: `You're invited to write for ${site.title}`,
        text: `${c.get("user").name} invited you to join ${site.title} as ${role}.\n\nAccept: ${link}\n\nThe link works for 7 days.`,
        html: `<p>${c.get("user").name.replace(/</g, "&lt;")} invited you to join <strong>${site.title.replace(/</g, "&lt;")}</strong> as ${role}.</p><p><a href="${link}">Accept the invite</a></p><p>The link works for 7 days.</p>`,
    });
    return c.json({ link, emailed: outcome.sent });
});

siteRoutes.put("/staff/:userId", async (c) =>
{
    requirePermission(c, "manage_staff");
    const body = await readJson<{ role: Role }>(c);
    if (!ROLES.includes(body.role as Role))
    {
        throw badRequest("Unknown role.");
    }
    const target = await c.env.DB.prepare("SELECT role FROM site_members WHERE site_id = ? AND user_id = ?").bind(c.get("site").id, c.req.param("userId")).first<{ role: Role }>();
    if (!target || target.role === "owner")
    {
        throw new ApiError(403, "forbidden", "The owner's role can't be changed.");
    }
    await c.env.DB.prepare("UPDATE site_members SET role = ? WHERE site_id = ? AND user_id = ?").bind(body.role, c.get("site").id, c.req.param("userId")).run();
    return c.json({ ok: true });
});

siteRoutes.delete("/staff/:userId", async (c) =>
{
    requirePermission(c, "manage_staff");
    await c.env.DB.prepare("DELETE FROM site_members WHERE site_id = ? AND user_id = ? AND role != 'owner'").bind(c.get("site").id, c.req.param("userId")).run();
    return c.json({ ok: true });
});

// ---------- Own profile ----------

siteRoutes.put("/profile", async (c) =>
{
    const user = c.get("user");
    const body = await readJson<{ name: string; slug: string; bio: string; avatar: string; website: string; password: string }>(c);
    const name = text(body.name, { max: 80, field: "Name" }) || user.name;
    const slug = slugify(body.slug || name);
    if (slug !== user.slug && (await c.env.DB.prepare("SELECT 1 FROM users WHERE slug = ? AND id != ?").bind(slug, user.id).first()))
    {
        throw new ApiError(409, "slug_taken", "That profile address is taken.");
    }
    const statements = [
        c.env.DB.prepare("UPDATE users SET name = ?, slug = ?, bio = ?, avatar = ?, website = ? WHERE id = ?")
            .bind(name, slug, text(body.bio, { max: 400 }), text(body.avatar, { max: 1000 }), text(body.website, { max: 300 }), user.id),
    ];
    if (body.password)
    {
        const { hash, salt } = await passwordFields(checkPassword(body.password));
        statements.push(c.env.DB.prepare("UPDATE users SET password_hash = ?, salt = ? WHERE id = ?").bind(hash, salt, user.id));
    }
    await c.env.DB.batch(statements);
    return c.json({ ok: true });
});

// ---------- Import ----------

siteRoutes.post("/import", async (c) =>
{
    requirePermission(c, "manage_settings");
    const site = c.get("site");
    const bundle = await readJson<ImportBundle>(c);
    const posts = Array.isArray(bundle.posts) ? bundle.posts.slice(0, 2000) : [];
    const subscribers = Array.isArray(bundle.subscribers) ? bundle.subscribers.slice(0, 50_000) : [];
    const author = c.get("user").id;
    const statements: D1PreparedStatement[] = [];
    const usedSlugs = new Set((await c.env.DB.prepare("SELECT slug FROM posts WHERE site_id = ?").bind(site.id).all<{ slug: string }>()).results.map((row) => row.slug));
    let importedPosts = 0;
    for (const post of posts)
    {
        const id = newId();
        let slug = slugify(post.slug || post.title || id);
        for (let attempt = 2; usedSlugs.has(slug); attempt++)
        {
            slug = `${slugify(post.slug || post.title)}-${attempt}`;
        }
        usedSlugs.add(slug);
        const content = String(post.content ?? "").slice(0, 500_000);
        const status = post.status === "published" ? "published" : "draft";
        statements.push(c.env.DB.prepare(
            `INSERT INTO posts (id, site_id, type, title, slug, excerpt, content, cover_image, status, visibility, published_at, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
            id, site.id, post.type === "page" ? "page" : "post", String(post.title ?? "").slice(0, 300), slug,
            String(post.excerpt || excerptOf(content)).slice(0, 600), content, String(post.cover_image ?? "").slice(0, 1000), status,
            ["public", "members", "paid"].includes(post.visibility) ? post.visibility : "public",
            status === "published" ? post.published_at ?? now() : null, post.published_at ?? now(), now()
        ));
        statements.push(c.env.DB.prepare("INSERT INTO post_authors (post_id, user_id, sort) VALUES (?, ?, 0)").bind(id, author));
        for (const [index, name] of (post.tags ?? []).slice(0, 10).entries())
        {
            const tagSlug = slugify(String(name));
            statements.push(c.env.DB.prepare("INSERT OR IGNORE INTO tags (id, site_id, name, slug) VALUES (?, ?, ?, ?)").bind(newId(), site.id, String(name).slice(0, 80), tagSlug));
            statements.push(c.env.DB.prepare("INSERT OR IGNORE INTO post_tags (post_id, tag_id, sort) SELECT ?, id, ? FROM tags WHERE site_id = ? AND slug = ?").bind(id, index, site.id, tagSlug));
        }
        importedPosts++;
    }
    let importedSubscribers = 0;
    for (const subscriber of subscribers)
    {
        const email = String(subscriber.email ?? "").trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        {
            continue;
        }
        // Imported paid members keep access as complimentary until they pay through this blog.
        const tier = subscriber.tier === "paid" || subscriber.tier === "comp" ? "comp" : "free";
        statements.push(c.env.DB.prepare(
            "INSERT OR IGNORE INTO subscribers (id, site_id, email, name, status, tier, source, token, created_at, confirmed_at) VALUES (?, ?, ?, ?, 'active', ?, 'import', ?, ?, ?)"
        ).bind(newId(), site.id, email, String(subscriber.name ?? "").slice(0, 80), tier, randomHex(24), subscriber.created_at ?? now(), now()));
        importedSubscribers++;
    }
    for (let index = 0; index < statements.length; index += 100)
    {
        await c.env.DB.batch(statements.slice(index, index + 100));
    }
    return c.json({ posts: importedPosts, subscribers: importedSubscribers });
});

// Copies one remote image into R2 so imported posts stop depending on the old host.
siteRoutes.post("/import/image", async (c) =>
{
    requirePermission(c, "manage_settings");
    const site = c.get("site");
    const body = await readJson<{ url: string }>(c);
    const url = String(body.url ?? "");
    if (!/^https?:\/\//.test(url))
    {
        throw badRequest("Not an image URL.");
    }
    const response = await fetch(url, { headers: { "User-Agent": "Writestead importer" } }).catch(() => null);
    const type = response?.headers.get("content-type")?.split(";")[0] ?? "";
    if (!response?.ok || !type.startsWith("image/"))
    {
        return c.json({ url });
    }
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > 10 * 1024 * 1024)
    {
        return c.json({ url });
    }
    const id = newId();
    const extension = type.split("/")[1].replace("jpeg", "jpg").replace(/\+.*$/, "").slice(0, 5);
    const key = `${site.id}/import/${id}.${extension}`;
    await c.env.MEDIA.put(key, bytes, { httpMetadata: { contentType: type } });
    await c.env.DB.prepare("INSERT INTO media (id, site_id, key, filename, mime, size, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .bind(id, site.id, key, url.split("/").pop()?.slice(0, 200) ?? "image", type, bytes.byteLength, now()).run();
    return c.json({ url: `/media/${key}` });
});

// ---------- Export (no lock-in) ----------

siteRoutes.get("/export", async (c) =>
{
    requirePermission(c, "manage_settings");
    const site = c.get("site");
    const [posts, tags, postTags, authors, subscribers, media, tiers] = await c.env.DB.batch([
        c.env.DB.prepare("SELECT id, type, title, slug, excerpt, content, cover_image, status, visibility, featured, delivery, meta_title, meta_description, canonical_url, og_image, published_at, created_at, updated_at FROM posts WHERE site_id = ?").bind(site.id),
        c.env.DB.prepare("SELECT id, name, slug, description FROM tags WHERE site_id = ?").bind(site.id),
        c.env.DB.prepare("SELECT pt.post_id, pt.tag_id FROM post_tags pt JOIN posts p ON p.id = pt.post_id WHERE p.site_id = ?").bind(site.id),
        c.env.DB.prepare("SELECT pa.post_id, u.name, u.email, u.slug FROM post_authors pa JOIN posts p ON p.id = pa.post_id JOIN users u ON u.id = pa.user_id WHERE p.site_id = ?").bind(site.id),
        c.env.DB.prepare("SELECT email, name, status, tier, labels, source, created_at FROM subscribers WHERE site_id = ?").bind(site.id),
        c.env.DB.prepare("SELECT key, filename, mime, size, created_at FROM media WHERE site_id = ?").bind(site.id),
        c.env.DB.prepare("SELECT name, description, monthly_price, yearly_price, currency, benefits, active FROM tiers WHERE site_id = ?").bind(site.id),
    ]);
    const origin = siteUrl(c.env, site, new URL(c.req.url).origin);
    return c.json({
        writestead: { version: 1, exported_at: now(), site: { title: site.title, description: site.description, url: origin, settings: site.settings } },
        posts: posts.results,
        tags: tags.results,
        posts_tags: postTags.results,
        posts_authors: authors.results,
        subscribers: subscribers.results,
        media: (media.results as { key: string }[]).map((item) => ({ ...item, url: `${origin}/media/${item.key}` })),
        tiers: tiers.results,
    });
});

// ---------- API keys and webhooks ----------

siteRoutes.use("/integrations/*", async (c, next) =>
{
    requirePermission(c, "manage_settings");
    if (!getEntitlements(c.env, c.get("site")).canUseApi)
    {
        throw new ApiError(402, "upgrade_required", "The API and webhooks are part of Pro.");
    }
    await next();
});

siteRoutes.get("/integrations", async (c) =>
{
    const site = c.get("site");
    const [keys, hooks] = await c.env.DB.batch([
        c.env.DB.prepare("SELECT id, name, hint, created_at FROM api_keys WHERE site_id = ? ORDER BY created_at").bind(site.id),
        c.env.DB.prepare("SELECT id, event, url, created_at FROM webhooks WHERE site_id = ? ORDER BY created_at").bind(site.id),
    ]);
    return c.json({ keys: keys.results, webhooks: hooks.results, events: WEBHOOK_EVENTS, canUse: getEntitlements(c.env, site).canUseApi && can(c.get("role"), "manage_settings") });
});

siteRoutes.post("/integrations/keys", async (c) =>
{
    const body = await readJson<{ name: string }>(c);
    const key = `ws_${randomHex(24)}`;
    await c.env.DB.prepare("INSERT INTO api_keys (id, site_id, name, key_hash, hint, created_at) VALUES (?, ?, ?, ?, ?, ?)")
        .bind(newId(), c.get("site").id, text(body.name, { max: 80 }) || "API key", await sha256Hex(key), `${key.slice(0, 7)}…${key.slice(-4)}`, now()).run();
    // The full key is shown once; only its hash is stored.
    return c.json({ key });
});

siteRoutes.delete("/integrations/keys/:id", async (c) =>
{
    await c.env.DB.prepare("DELETE FROM api_keys WHERE id = ? AND site_id = ?").bind(c.req.param("id"), c.get("site").id).run();
    return c.json({ ok: true });
});

siteRoutes.post("/integrations/webhooks", async (c) =>
{
    const body = await readJson<{ event: string; url: string }>(c);
    if (!(WEBHOOK_EVENTS as readonly string[]).includes(body.event ?? "") || !/^https:\/\//.test(body.url ?? ""))
    {
        throw badRequest("Pick an event and an https URL.");
    }
    const secret = randomHex(16);
    await c.env.DB.prepare("INSERT INTO webhooks (id, site_id, event, url, secret, created_at) VALUES (?, ?, ?, ?, ?, ?)")
        .bind(newId(), c.get("site").id, body.event, text(body.url, { max: 500 }), secret, now()).run();
    return c.json({ secret });
});

siteRoutes.delete("/integrations/webhooks/:id", async (c) =>
{
    await c.env.DB.prepare("DELETE FROM webhooks WHERE id = ? AND site_id = ?").bind(c.req.param("id"), c.get("site").id).run();
    return c.json({ ok: true });
});
