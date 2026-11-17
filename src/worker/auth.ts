import type { Context, Next } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { Role, SiteWithSettings, User } from "../shared/types";
import { isMulti, type AppEnv } from "./env";
import { hashPassword, randomHex, sha256Hex, timingSafeEqual } from "./lib/crypto";
import { ApiError, now } from "./lib/http";
import { resolveHost } from "./site";

export const SESSION_COOKIE = "ws_session";
const SESSION_DAYS = 30;
export const MIN_PASSWORD = 8;

export type Vars = { user: User; role: Role; site: SiteWithSettings };
export type HonoEnv = { Bindings: AppEnv; Variables: Vars };
type AppContext = Context<HonoEnv>;

const USER_COLUMNS = "u.id, u.email, u.name, u.slug, u.bio, u.avatar, u.website";

export async function passwordFields(password: string): Promise<{ hash: string; salt: string }>
{
    const salt = randomHex(16);
    return { hash: await hashPassword(password, salt), salt };
}

export function checkPassword(password: unknown): string
{
    if (typeof password !== "string" || password.length < MIN_PASSWORD)
    {
        throw new ApiError(400, "weak_password", `Use a password of at least ${MIN_PASSWORD} characters.`);
    }
    if (password.length > 200)
    {
        throw new ApiError(400, "weak_password", "That password is too long.");
    }
    return password;
}

export function checkEmail(email: unknown): string
{
    const value = typeof email === "string" ? email.trim().toLowerCase() : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || value.length > 254)
    {
        throw new ApiError(400, "invalid_email", "Enter a valid email address.");
    }
    return value;
}

export async function verifyLogin(db: D1Database, email: string, password: string): Promise<User | null>
{
    const row = await db
        .prepare(`SELECT ${USER_COLUMNS}, u.password_hash, u.salt FROM users u WHERE u.email = ?`)
        .bind(email)
        .first<User & { password_hash: string; salt: string }>();
    if (!row)
    {
        // Spend the same time as a real check so timing doesn't reveal which emails exist.
        await hashPassword(password, "0000000000000000");
        return null;
    }
    if (!timingSafeEqual(await hashPassword(password, row.salt), row.password_hash))
    {
        return null;
    }
    const { password_hash: _hash, salt: _salt, ...user } = row;
    return user;
}

// In multi mode the session cookie covers every subdomain, so signing up on the root domain
// carries over to the new blog's dashboard. Custom domains get their own host-only cookie.
function cookieDomain(c: AppContext): string | undefined
{
    // Browsers reject a Domain attribute without a dot, such as local testing on localhost.
    if (!isMulti(c.env) || !c.env.ROOT_DOMAIN.includes("."))
    {
        return undefined;
    }
    const host = new URL(c.req.url).hostname;
    const root = c.env.ROOT_DOMAIN;
    return host === root || host.endsWith(`.${root}`) ? `.${root}` : undefined;
}

export async function startSession(c: AppContext, userId: string): Promise<void>
{
    const token = randomHex(32);
    const expiresAt = now() + SESSION_DAYS * 86400;
    await c.env.DB.batch([
        c.env.DB.prepare("DELETE FROM sessions WHERE expires_at < ?").bind(now()),
        c.env.DB.prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)")
            .bind(await sha256Hex(token), userId, expiresAt),
    ]);
    setCookie(c, SESSION_COOKIE, token, {
        httpOnly: true,
        secure: true,
        sameSite: "Lax",
        path: "/",
        domain: cookieDomain(c),
        maxAge: SESSION_DAYS * 86400,
    });
}

export async function endSession(c: AppContext): Promise<void>
{
    const token = getCookie(c, SESSION_COOKIE);
    if (token)
    {
        await c.env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await sha256Hex(token)).run();
    }
    deleteCookie(c, SESSION_COOKIE, { path: "/", secure: true, domain: cookieDomain(c) });
}

export async function currentUser(c: AppContext): Promise<User | null>
{
    const token = getCookie(c, SESSION_COOKIE);
    if (!token)
    {
        return null;
    }
    return c.env.DB
        .prepare(
            `SELECT ${USER_COLUMNS} FROM sessions s JOIN users u ON u.id = s.user_id
             WHERE s.token_hash = ? AND s.expires_at > ?`
        )
        .bind(await sha256Hex(token), now())
        .first<User>();
}

export async function requireSite(c: AppContext, next: Next)
{
    const target = await resolveHost(c.env, c.req.header("host") ?? new URL(c.req.url).host);
    if (target.kind !== "site")
    {
        throw new ApiError(404, "no_site", "There is no blog at this address.");
    }
    c.set("site", target.site);
    await next();
}

// Needs requireSite first. Loads the signed-in user and their role on this blog.
export async function requireStaff(c: AppContext, next: Next)
{
    const user = await currentUser(c);
    if (!user)
    {
        throw new ApiError(401, "unauthorized", "Sign in to continue.");
    }
    const member = await c.env.DB
        .prepare("SELECT role FROM site_members WHERE site_id = ? AND user_id = ?")
        .bind(c.get("site").id, user.id)
        .first<{ role: Role }>();
    if (!member)
    {
        throw new ApiError(403, "not_staff", "You're not on the team of this blog.");
    }
    c.set("user", user);
    c.set("role", member.role);
    await next();
}

// Visitors can explore the demo dashboard, but nothing they do is saved.
export async function blockDemoWrites(c: AppContext, next: Next)
{
    if (c.get("site").is_demo && c.req.method !== "GET")
    {
        throw new ApiError(403, "demo_read_only", "This is a read-only demo. Start your own blog to make changes.");
    }
    await next();
}

export type Permission = "manage_settings" | "manage_staff" | "manage_subscribers" | "publish" | "edit_any_post" | "billing";

const PERMISSIONS: Record<Role, Permission[]> = {
    owner: ["manage_settings", "manage_staff", "manage_subscribers", "publish", "edit_any_post", "billing"],
    admin: ["manage_settings", "manage_staff", "manage_subscribers", "publish", "edit_any_post"],
    editor: ["manage_subscribers", "publish", "edit_any_post"],
    author: ["publish"],
    contributor: [],
};

export function can(role: Role, permission: Permission): boolean
{
    return PERMISSIONS[role].includes(permission);
}

export function requirePermission(c: AppContext, permission: Permission): void
{
    if (!can(c.get("role"), permission))
    {
        throw new ApiError(403, "forbidden", "Your role can't do that. Ask an admin.");
    }
}
