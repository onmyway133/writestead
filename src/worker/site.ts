import { readSettings } from "../shared/settings";
import type { Site, SiteWithSettings } from "../shared/types";
import { isMulti, type AppEnv } from "./env";

export type HostTarget =
    | { kind: "marketing" }
    | { kind: "site"; site: SiteWithSettings }
    | { kind: "setup" }
    | { kind: "unknown" };

const RESERVED = new Set(["www", "app", "api", "admin", "mail", "email", "status", "docs", "help", "support", "cdn", "static", "assets", "dashboard"]);

export function isReservedSubdomain(name: string): boolean
{
    return RESERVED.has(name);
}

type SiteRow = Site & { settings: string };

function withSettings(row: SiteRow): SiteWithSettings
{
    return { ...row, settings: readSettings(row.settings) };
}

const SITE_COLUMNS = "id, subdomain, custom_domain, title, description, settings, plan, status, is_demo, created_at";

// Decides what a hostname serves. In single mode every host is the one blog.
export async function resolveHost(env: AppEnv, host: string): Promise<HostTarget>
{
    const hostname = host.toLowerCase().split(":")[0];
    if (!isMulti(env))
    {
        const row = await env.DB.prepare(`SELECT ${SITE_COLUMNS} FROM sites ORDER BY created_at LIMIT 1`).first<SiteRow>();
        return row ? { kind: "site", site: withSettings(row) } : { kind: "setup" };
    }
    const root = env.ROOT_DOMAIN.toLowerCase();
    if (hostname === root || hostname === `www.${root}`)
    {
        return { kind: "marketing" };
    }
    let row: SiteRow | null;
    if (hostname.endsWith(`.${root}`))
    {
        const subdomain = hostname.slice(0, -(root.length + 1));
        row = await env.DB.prepare(`SELECT ${SITE_COLUMNS} FROM sites WHERE subdomain = ?`).bind(subdomain).first<SiteRow>();
    }
    else
    {
        row = await env.DB.prepare(`SELECT ${SITE_COLUMNS} FROM sites WHERE custom_domain = ?`).bind(hostname).first<SiteRow>();
    }
    return row ? { kind: "site", site: withSettings(row) } : { kind: "unknown" };
}

export async function loadSite(env: AppEnv, id: string): Promise<SiteWithSettings | null>
{
    const row = await env.DB.prepare(`SELECT ${SITE_COLUMNS} FROM sites WHERE id = ?`).bind(id).first<SiteRow>();
    return row ? withSettings(row) : null;
}
