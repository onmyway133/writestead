import { PLAN_ENTITLEMENTS, type Entitlements } from "../shared/plans";
import type { Site } from "../shared/types";

// Bindings from wrangler.jsonc plus the optional secrets from .dev.vars.example.
// MEDIA is optional: an install without R2 stores uploads in KV (see media.ts).
export type AppEnv = Omit<Env, "MODE" | "ROOT_DOMAIN" | "TURNSTILE_SITE_KEY" | "MEDIA"> & {
    MEDIA?: R2Bucket;
    MODE: string;
    ROOT_DOMAIN: string;
    TURNSTILE_SITE_KEY: string;
    OWNER_EMAIL?: string;
    EMAIL_FROM?: string;
    TURNSTILE_SECRET_KEY?: string;
    // Hosted version: create Cloudflare for SaaS custom hostnames for blogs' own domains.
    CF_API_TOKEN?: string;
    CF_ZONE_ID?: string;
    // Hosted version only: the platform's Stripe account that bills blogs for Pro and Teams.
    PLATFORM_STRIPE_SECRET_KEY?: string;
    PLATFORM_STRIPE_WEBHOOK_SECRET?: string;
    // Hosted version only: URL of an analytics script loaded on the marketing pages.
    PLATFORM_ANALYTICS_SCRIPT?: string;
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
