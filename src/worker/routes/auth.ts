import { Hono } from "hono";
import type { Role } from "../../shared/types";
import { DEFAULT_SETTINGS } from "../../shared/settings";
import { checkEmail, checkPassword, currentUser, endSession, type HonoEnv, passwordFields, startSession, verifyLogin } from "../auth";
import { isMulti } from "../env";
import { sha256Hex } from "../lib/crypto";
import { ApiError, newId, now, readJson, text } from "../lib/http";
import { slugify } from "../lib/text";
import { verifyTurnstile } from "../lib/turnstile";
import { isReservedSubdomain, resolveHost } from "../site";

export const authRoutes = new Hono<HonoEnv>();

// What the sign-in screen needs before anyone is signed in.
authRoutes.get("/status", async (c) =>
{
    const target = await resolveHost(c.env, c.req.header("host") ?? "");
    const user = await currentUser(c);
    return c.json({
        mode: isMulti(c.env) ? "multi" : "single",
        needsSetup: target.kind === "setup",
        isMarketing: target.kind === "marketing",
        siteTitle: target.kind === "site" ? target.site.title : null,
        isDemo: target.kind === "site" ? target.site.is_demo === 1 : false,
        signedIn: user !== null,
        rootDomain: c.env.ROOT_DOMAIN,
        turnstileSiteKey: c.env.TURNSTILE_SECRET_KEY ? c.env.TURNSTILE_SITE_KEY : "",
    });
});

async function uniqueUserSlug(db: D1Database, name: string): Promise<string>
{
    const base = slugify(name);
    let slug = base;
    for (let attempt = 2; await db.prepare("SELECT 1 FROM users WHERE slug = ?").bind(slug).first(); attempt++)
    {
        slug = `${base}-${attempt}`;
    }
    return slug;
}

async function createUser(db: D1Database, input: { email: string; name: string; password: string }): Promise<string>
{
    const id = newId();
    const { hash, salt } = await passwordFields(input.password);
    await db.prepare("INSERT INTO users (id, email, name, slug, password_hash, salt, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .bind(id, input.email, input.name, await uniqueUserSlug(db, input.name), hash, salt, now()).run();
    return id;
}

async function createSite(db: D1Database, input: { title: string; subdomain: string | null; ownerId: string }): Promise<string>
{
    const siteId = newId();
    await db.batch([
        db.prepare("INSERT INTO sites (id, subdomain, title, description, settings, created_at) VALUES (?, ?, ?, '', ?, ?)")
            .bind(siteId, input.subdomain, input.title, JSON.stringify(DEFAULT_SETTINGS), now()),
        db.prepare("INSERT INTO site_members (site_id, user_id, role, created_at) VALUES (?, ?, 'owner', ?)").bind(siteId, input.ownerId, now()),
        db.prepare("INSERT INTO posts (id, site_id, type, title, slug, content, status, published_at, created_at, updated_at) VALUES (?, ?, 'page', 'About', 'about', ?, 'published', ?, ?, ?)")
            .bind(newId(), siteId, "Tell readers who you are and what this blog is about. Edit this page from the dashboard under Pages.", now(), now(), now()),
    ]);
    return siteId;
}

// Self-hosted: the first visit to /admin creates the blog and its owner.
authRoutes.post("/setup", async (c) =>
{
    if (isMulti(c.env))
    {
        throw new ApiError(404, "not_found", "Not found.");
    }
    if (await c.env.DB.prepare("SELECT 1 FROM sites LIMIT 1").first())
    {
        throw new ApiError(409, "already_setup", "This blog is already set up. Sign in instead.");
    }
    const body = await readJson<{ email: string; name: string; password: string; title: string }>(c);
    const email = checkEmail(body.email);
    const owner = c.env.OWNER_EMAIL?.trim().toLowerCase();
    if (owner && owner !== email)
    {
        throw new ApiError(403, "not_owner", "Only the email set as OWNER_EMAIL can set up this blog.");
    }
    const name = text(body.name, { max: 80, field: "Name" }) || email.split("@")[0];
    const title = text(body.title, { max: 120, field: "Blog name" }) || `${name}'s blog`;
    const userId = await createUser(c.env.DB, { email, name, password: checkPassword(body.password) });
    await createSite(c.env.DB, { title, subdomain: null, ownerId: userId });
    await startSession(c, userId);
    return c.json({ ok: true });
});

const SUBDOMAIN = /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])$/;

authRoutes.get("/check-subdomain", async (c) =>
{
    const name = (c.req.query("name") ?? "").toLowerCase();
    const valid = SUBDOMAIN.test(name) && !isReservedSubdomain(name);
    const taken = valid && (await c.env.DB.prepare("SELECT 1 FROM sites WHERE subdomain = ?").bind(name).first()) !== null;
    return c.json({ available: valid && !taken, valid });
});

// Hosted: sign up on the root domain creates a user and their first blog on a subdomain.
authRoutes.post("/signup", async (c) =>
{
    if (!isMulti(c.env))
    {
        throw new ApiError(404, "not_found", "Not found.");
    }
    const body = await readJson<{ email: string; name: string; password: string; title: string; subdomain: string; turnstile: string }>(c);
    await verifyTurnstile(c.env, body.turnstile, c.req.header("cf-connecting-ip") ?? null);
    const email = checkEmail(body.email);
    const password = checkPassword(body.password);
    const subdomain = (body.subdomain ?? "").trim().toLowerCase();
    if (!SUBDOMAIN.test(subdomain) || isReservedSubdomain(subdomain))
    {
        throw new ApiError(400, "invalid_subdomain", "Pick an address with 3 to 32 letters, numbers or dashes.");
    }
    if (await c.env.DB.prepare("SELECT 1 FROM sites WHERE subdomain = ?").bind(subdomain).first())
    {
        throw new ApiError(409, "subdomain_taken", "That address is taken. Try another.");
    }
    let userId: string;
    const existing = await verifyLogin(c.env.DB, email, password);
    if (existing)
    {
        userId = existing.id;
    }
    else
    {
        if (await c.env.DB.prepare("SELECT 1 FROM users WHERE email = ?").bind(email).first())
        {
            throw new ApiError(409, "email_taken", "That email already has an account. Sign in with its password to add a blog.");
        }
        const name = text(body.name, { max: 80, field: "Name" }) || email.split("@")[0];
        userId = await createUser(c.env.DB, { email, name, password });
    }
    const title = text(body.title, { max: 120, field: "Blog name" }) || subdomain;
    await createSite(c.env.DB, { title, subdomain, ownerId: userId });
    await startSession(c, userId);
    return c.json({ ok: true, url: `https://${subdomain}.${c.env.ROOT_DOMAIN}/admin` });
});

authRoutes.post("/login", async (c) =>
{
    const body = await readJson<{ email: string; password: string }>(c);
    const email = checkEmail(body.email);
    const user = await verifyLogin(c.env.DB, email, typeof body.password === "string" ? body.password : "");
    if (!user)
    {
        throw new ApiError(401, "bad_login", "That email and password don't match.");
    }
    await startSession(c, user.id);
    return c.json({ ok: true });
});

authRoutes.post("/logout", async (c) =>
{
    await endSession(c);
    return c.json({ ok: true });
});

// The blogs a signed-in user can manage, for the hosted "choose a blog" screen.
authRoutes.get("/sites", async (c) =>
{
    const user = await currentUser(c);
    if (!user)
    {
        throw new ApiError(401, "unauthorized", "Sign in to continue.");
    }
    const { results } = await c.env.DB
        .prepare("SELECT s.id, s.title, s.subdomain, s.custom_domain, m.role FROM site_members m JOIN sites s ON s.id = m.site_id WHERE m.user_id = ? ORDER BY s.created_at")
        .bind(user.id)
        .all<{ id: string; title: string; subdomain: string | null; custom_domain: string | null; role: Role }>();
    return c.json({
        user: { name: user.name, email: user.email },
        sites: results.map((site) => ({
            ...site,
            url: site.custom_domain ? `https://${site.custom_domain}` : isMulti(c.env) ? `https://${site.subdomain}.${c.env.ROOT_DOMAIN}` : "",
        })),
    });
});

// Staff invites: the link holds a one-time code stored hashed in KV.
authRoutes.get("/invite", async (c) =>
{
    const invite = await c.env.CACHE.get<{ siteId: string; email: string; role: Role; siteTitle: string }>(`invite:${await sha256Hex(c.req.query("code") ?? "")}`, "json");
    if (!invite)
    {
        throw new ApiError(404, "invite_expired", "This invite has expired or was already used.");
    }
    const hasAccount = (await c.env.DB.prepare("SELECT 1 FROM users WHERE email = ?").bind(invite.email).first()) !== null;
    return c.json({ email: invite.email, role: invite.role, siteTitle: invite.siteTitle, hasAccount });
});

authRoutes.post("/invite", async (c) =>
{
    const body = await readJson<{ code: string; name: string; password: string }>(c);
    const key = `invite:${await sha256Hex(body.code ?? "")}`;
    const invite = await c.env.CACHE.get<{ siteId: string; email: string; role: Role }>(key, "json");
    if (!invite)
    {
        throw new ApiError(404, "invite_expired", "This invite has expired or was already used.");
    }
    const password = checkPassword(body.password);
    let user = await verifyLogin(c.env.DB, invite.email, password);
    if (!user)
    {
        if (await c.env.DB.prepare("SELECT 1 FROM users WHERE email = ?").bind(invite.email).first())
        {
            throw new ApiError(401, "bad_login", "You already have an account. Enter its password to accept.");
        }
        const id = await createUser(c.env.DB, { email: invite.email, name: text(body.name, { max: 80, field: "Name" }) || invite.email.split("@")[0], password });
        user = { id } as never;
    }
    await c.env.DB.prepare("INSERT OR REPLACE INTO site_members (site_id, user_id, role, created_at) VALUES (?, ?, ?, ?)").bind(invite.siteId, user!.id, invite.role, now()).run();
    await c.env.CACHE.delete(key);
    await startSession(c, user!.id);
    return c.json({ ok: true });
});
