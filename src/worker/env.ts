import { PLAN_ENTITLEMENTS, type Entitlements } from "../shared/plans";
import type { Site } from "../shared/types";

// Bindings from wrangler.jsonc plus the optional secrets from .dev.vars.example.
export type AppEnv = Omit<Env, "MODE" | "ROOT_DOMAIN" | "TURNSTILE_SITE_KEY"> & {
    MODE: string;
    ROOT_DOMAIN: string;
    TURNSTILE_SITE_KEY: string;
    OWNER_EMAIL?: string;
    EMAIL_FROM?: string;
    TURNSTILE_SECRET_KEY?: string;
};

export function isMulti(env: AppEnv): boolean
{
    return env.MODE === "multi" && env.ROOT_DOMAIN.length > 0;
}

export function getEntitlements(env: AppEnv, site: Pick<Site, "plan">): Entitlements
{
    if (!isMulti(env))
    {
        return PLAN_ENTITLEMENTS.self;
    }
    return PLAN_ENTITLEMENTS[site.plan] ?? PLAN_ENTITLEMENTS.free;
}

// The public address of a site, used in emails, feeds and canonical links.
export function siteUrl(env: AppEnv, site: Pick<Site, "subdomain" | "custom_domain">, requestOrigin?: string): string
{
    if (site.custom_domain)
    {
        return `https://${site.custom_domain}`;
    }
    if (isMulti(env) && site.subdomain)
    {
        return `https://${site.subdomain}.${env.ROOT_DOMAIN}`;
    }
    return requestOrigin ?? "";
}
