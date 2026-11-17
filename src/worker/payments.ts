import type { SiteWithSettings } from "../shared/types";
import type { AppEnv } from "./env";
import { randomHex, toHex, timingSafeEqual } from "./lib/crypto";
import { ApiError, newId, now } from "./lib/http";

// Stripe through its REST API with the blog's own secret key, so money goes straight to the
// writer's Stripe account. A blog can connect several accounts; checkout uses the default one.

type Account = { id: string; secret: string; webhook_secret: string };

async function stripeAccount(env: AppEnv, siteId: string, accountId?: string): Promise<Account | null>
{
    const sql = accountId
        ? "SELECT id, secret, webhook_secret FROM payment_accounts WHERE site_id = ? AND id = ? AND provider = 'stripe'"
        : "SELECT id, secret, webhook_secret FROM payment_accounts WHERE site_id = ? AND provider = 'stripe' ORDER BY is_default DESC, created_at LIMIT 1";
    const statement = env.DB.prepare(sql);
    return (accountId ? statement.bind(siteId, accountId) : statement.bind(siteId)).first<Account>();
}

async function stripe<T>(secret: string, path: string, params: Record<string, string>): Promise<T>
{
    const response = await fetch(`https://api.stripe.com/v1/${path}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(params),
    });
    const data = await response.json<T & { error?: { message: string } }>();
    if (!response.ok)
    {
        console.error("Stripe error", data.error?.message);
        throw new ApiError(503, "payment_error", "The payment provider returned an error. Try again later.");
    }
    return data;
}

export async function createCheckout(env: AppEnv, site: SiteWithSettings, input: { tierId: string; interval: "month" | "year"; email: string; origin: string }): Promise<string>
{
    const tier = await env.DB
        .prepare("SELECT id, name, monthly_price, yearly_price, currency FROM tiers WHERE id = ? AND site_id = ? AND active = 1")
        .bind(input.tierId, site.id)
        .first<{ id: string; name: string; monthly_price: number; yearly_price: number; currency: string }>();
    if (!tier)
    {
        throw new ApiError(404, "not_found", "That plan doesn't exist.");
    }
    const account = await stripeAccount(env, site.id);
    if (!account)
    {
        throw new ApiError(503, "no_payment_account", "This blog hasn't connected a payment account yet.");
    }
    const amount = input.interval === "year" && tier.yearly_price ? tier.yearly_price : tier.monthly_price;
    const session = await stripe<{ url: string }>(account.secret, "checkout/sessions", {
        mode: "subscription",
        customer_email: input.email,
        "line_items[0][quantity]": "1",
        "line_items[0][price_data][currency]": tier.currency,
        "line_items[0][price_data][unit_amount]": String(amount),
        "line_items[0][price_data][recurring][interval]": input.interval,
        "line_items[0][price_data][product_data][name]": `${site.title}: ${tier.name}`,
        success_url: `${input.origin}/message?m=${encodeURIComponent("Welcome aboard! Your paid membership is active.")}`,
        cancel_url: `${input.origin}/subscribe`,
        "metadata[site_id]": site.id,
        "metadata[tier_id]": tier.id,
        "subscription_data[metadata][site_id]": site.id,
        "subscription_data[metadata][email]": input.email,
    });
    return session.url;
}

async function verifySignature(secret: string, header: string, payload: string): Promise<boolean>
{
    const parts = Object.fromEntries(header.split(",").map((part) => part.split("=") as [string, string]));
    const timestamp = Number(parts.t);
    if (!parts.v1 || !timestamp || Math.abs(now() - timestamp) > 300)
    {
        return false;
    }
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const signature = toHex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${payload}`)));
    return timingSafeEqual(signature, parts.v1);
}

type StripeEvent = {
    type: string;
    data: { object: { customer_email?: string; customer_details?: { email?: string }; amount_total?: number; currency?: string; metadata?: Record<string, string>; items?: { data: { price?: { recurring?: { interval?: string } } }[] } } };
};

export async function handleStripeWebhook(env: AppEnv, site: SiteWithSettings, accountId: string, request: Request): Promise<void>
{
    const account = await stripeAccount(env, site.id, accountId);
    if (!account?.webhook_secret)
    {
        throw new ApiError(404, "not_found", "Unknown payment account.");
    }
    const payload = await request.text();
    if (!(await verifySignature(account.webhook_secret, request.headers.get("stripe-signature") ?? "", payload)))
    {
        throw new ApiError(400, "bad_signature", "Invalid signature.");
    }
    const event = JSON.parse(payload) as StripeEvent;
    const object = event.data.object;
    if (event.type === "checkout.session.completed")
    {
        const email = (object.customer_details?.email ?? object.customer_email ?? "").toLowerCase();
        if (!email)
        {
            return;
        }
        const existing = await env.DB.prepare("SELECT id FROM subscribers WHERE site_id = ? AND email = ?").bind(site.id, email).first<{ id: string }>();
        const id = existing?.id ?? newId();
        const interval = object.metadata?.interval ?? "";
        await env.DB.batch([
            existing
                ? env.DB.prepare("UPDATE subscribers SET tier = 'paid', status = 'active', paid_since = ?, amount = ?, currency = ?, interval = ? WHERE id = ?")
                    .bind(now(), object.amount_total ?? 0, object.currency ?? "usd", interval, id)
                : env.DB.prepare("INSERT INTO subscribers (id, site_id, email, status, tier, source, token, paid_since, amount, currency, interval, created_at, confirmed_at) VALUES (?, ?, ?, 'active', 'paid', 'checkout', ?, ?, ?, ?, ?, ?, ?)")
                    .bind(id, site.id, email, randomHex(24), now(), object.amount_total ?? 0, object.currency ?? "usd", interval, now(), now()),
            env.DB.prepare("INSERT INTO member_events (site_id, subscriber_id, type, amount, created_at) VALUES (?, ?, 'upgraded', ?, ?)").bind(site.id, id, object.amount_total ?? 0, now()),
        ]);
    }
    if (event.type === "customer.subscription.deleted")
    {
        const email = (object.metadata?.email ?? "").toLowerCase();
        const row = await env.DB.prepare("SELECT id, amount FROM subscribers WHERE site_id = ? AND email = ?").bind(site.id, email).first<{ id: string; amount: number }>();
        if (row)
        {
            await env.DB.batch([
                env.DB.prepare("UPDATE subscribers SET tier = 'free', amount = 0 WHERE id = ?").bind(row.id),
                env.DB.prepare("INSERT INTO member_events (site_id, subscriber_id, type, amount, created_at) VALUES (?, ?, 'cancelled', ?, ?)").bind(site.id, row.id, row.amount, now()),
            ]);
        }
    }
}
