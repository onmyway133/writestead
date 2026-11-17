import type { SiteWithSettings } from "../shared/types";
import type { AppEnv } from "./env";
import { randomHex, timingSafeEqual, toHex } from "./lib/crypto";
import { ApiError, newId, now } from "./lib/http";

// Member payments go straight into the writer's own Stripe or PayPal account, through each
// provider's REST API with keys stored on the blog. A blog can connect several accounts per
// provider; checkout uses the default one.

export type Provider = "stripe" | "paypal";

type Account = { id: string; provider: Provider; secret: string; public_key: string; webhook_secret: string; sandbox: number };

async function paymentAccount(env: AppEnv, siteId: string, provider: Provider, accountId?: string): Promise<Account | null>
{
    const columns = "id, provider, secret, public_key, webhook_secret, sandbox";
    if (accountId)
    {
        return env.DB.prepare(`SELECT ${columns} FROM payment_accounts WHERE site_id = ? AND id = ? AND provider = ?`).bind(siteId, accountId, provider).first<Account>();
    }
    return env.DB
        .prepare(`SELECT ${columns} FROM payment_accounts WHERE site_id = ? AND provider = ? ORDER BY is_default DESC, created_at LIMIT 1`)
        .bind(siteId, provider)
        .first<Account>();
}

// The providers a reader can pick from on /subscribe.
export async function connectedProviders(env: AppEnv, siteId: string): Promise<Provider[]>
{
    const { results } = await env.DB.prepare("SELECT DISTINCT provider FROM payment_accounts WHERE site_id = ? ORDER BY provider DESC").bind(siteId).all<{ provider: Provider }>();
    return results.map((row) => row.provider);
}

// ---------- Stripe ----------

export async function stripeRequest<T>(secret: string, path: string, params: Record<string, string>): Promise<T>
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

// Stripe signs webhooks with HMAC-SHA256 over "<timestamp>.<body>" in the Stripe-Signature header.
export async function verifyStripeSignature(secret: string, header: string, payload: string): Promise<boolean>
{
    const parts = new Map<string, string[]>();
    for (const part of header.split(","))
    {
        const [key, value] = part.split("=");
        parts.set(key, [...(parts.get(key) ?? []), value]);
    }
    const timestamp = Number(parts.get("t")?.[0]);
    const signatures = parts.get("v1") ?? [];
    if (signatures.length === 0 || !timestamp || Math.abs(now() - timestamp) > 300)
    {
        return false;
    }
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const expected = toHex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${payload}`)));
    return signatures.some((signature) => timingSafeEqual(expected, signature));
}

type Tier = { id: string; name: string; monthly_price: number; yearly_price: number; currency: string };

async function loadTier(env: AppEnv, siteId: string, tierId: string): Promise<Tier>
{
    const tier = await env.DB
        .prepare("SELECT id, name, monthly_price, yearly_price, currency FROM tiers WHERE id = ? AND site_id = ? AND active = 1")
        .bind(tierId, siteId)
        .first<Tier>();
    if (!tier)
    {
        throw new ApiError(404, "not_found", "That plan doesn't exist.");
    }
    return tier;
}

export async function createCheckout(env: AppEnv, site: SiteWithSettings, input: { tierId: string; interval: "month" | "year"; email: string; origin: string; provider?: Provider }): Promise<string>
{
    const tier = await loadTier(env, site.id, input.tierId);
    const amount = input.interval === "year" && tier.yearly_price ? tier.yearly_price : tier.monthly_price;
    const interval = input.interval === "year" && tier.yearly_price ? "year" : "month";
    const providers = await connectedProviders(env, site.id);
    const provider = input.provider && providers.includes(input.provider) ? input.provider : providers[0];
    if (!provider)
    {
        throw new ApiError(503, "no_payment_account", "This blog hasn't connected a payment account yet.");
    }
    if (provider === "paypal")
    {
        return createPayPalCheckout(env, site, { tier, interval, amount, email: input.email, origin: input.origin });
    }
    const account = (await paymentAccount(env, site.id, "stripe"))!;
    const session = await stripeRequest<{ url: string }>(account.secret, "checkout/sessions", {
        mode: "subscription",
        customer_email: input.email,
        "line_items[0][quantity]": "1",
        "line_items[0][price_data][currency]": tier.currency,
        "line_items[0][price_data][unit_amount]": String(amount),
        "line_items[0][price_data][recurring][interval]": interval,
        "line_items[0][price_data][product_data][name]": `${site.title}: ${tier.name}`,
        success_url: `${input.origin}/message?m=${encodeURIComponent("Welcome aboard! Your paid membership is active.")}`,
        cancel_url: `${input.origin}/subscribe`,
        "metadata[site_id]": site.id,
        "metadata[tier_id]": tier.id,
        "metadata[interval]": interval,
        "subscription_data[metadata][site_id]": site.id,
        "subscription_data[metadata][email]": input.email,
    });
    return session.url;
}

type StripeObject = {
    id?: string;
    customer?: string | null;
    subscription?: string | null;
    customer_email?: string | null;
    customer_details?: { email?: string | null } | null;
    amount_total?: number | null;
    currency?: string | null;
    status?: string;
    metadata?: Record<string, string>;
};
type StripeEvent = { type: string; data: { object: StripeObject } };

export async function handleStripeWebhook(env: AppEnv, site: SiteWithSettings, accountId: string, request: Request): Promise<void>
{
    const account = await paymentAccount(env, site.id, "stripe", accountId);
    if (!account?.webhook_secret)
    {
        throw new ApiError(404, "not_found", "Unknown payment account.");
    }
    const payload = await request.text();
    if (!(await verifyStripeSignature(account.webhook_secret, request.headers.get("stripe-signature") ?? "", payload)))
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
        await upgradeMember(env, site.id, {
            email,
            provider: "stripe",
            accountId: account.id,
            customerId: object.customer ?? "",
            subscriptionId: object.subscription ?? "",
            amount: object.amount_total ?? 0,
            currency: object.currency ?? "usd",
            interval: object.metadata?.interval ?? "",
        });
    }
    if (event.type === "customer.subscription.deleted")
    {
        await cancelMember(env, site.id, { subscriptionId: object.id ?? "", email: object.metadata?.email ?? "" });
    }
}

// Stripe's hosted billing portal lets a paid member change their card or cancel.
export async function createBillingPortal(env: AppEnv, siteId: string, subscriberId: string, returnUrl: string): Promise<string>
{
    const member = await env.DB
        .prepare("SELECT provider, payment_account_id, customer_id FROM subscribers WHERE id = ? AND site_id = ?")
        .bind(subscriberId, siteId)
        .first<{ provider: string; payment_account_id: string; customer_id: string }>();
    if (!member || member.provider !== "stripe" || !member.customer_id)
    {
        throw new ApiError(404, "no_billing", "There's no card billing to manage for this account.");
    }
    const account = await paymentAccount(env, siteId, "stripe", member.payment_account_id) ?? await paymentAccount(env, siteId, "stripe");
    if (!account)
    {
        throw new ApiError(503, "no_payment_account", "This blog's payment account is no longer connected.");
    }
    const session = await stripeRequest<{ url: string }>(account.secret, "billing_portal/sessions", { customer: member.customer_id, return_url: returnUrl });
    return session.url;
}

// ---------- Shared member changes ----------

type Upgrade = { email: string; provider: Provider; accountId: string; customerId: string; subscriptionId: string; amount: number; currency: string; interval: string; subscriberId?: string };

async function upgradeMember(env: AppEnv, siteId: string, input: Upgrade): Promise<void>
{
    const existing = input.subscriberId
        ? await env.DB.prepare("SELECT id FROM subscribers WHERE site_id = ? AND id = ?").bind(siteId, input.subscriberId).first<{ id: string }>()
        : await env.DB.prepare("SELECT id FROM subscribers WHERE site_id = ? AND email = ?").bind(siteId, input.email).first<{ id: string }>();
    const id = existing?.id ?? newId();
    const fields = [input.provider, input.accountId, input.customerId, input.subscriptionId];
    await env.DB.batch([
        existing
            ? env.DB.prepare(
                `UPDATE subscribers SET tier = 'paid', status = 'active', confirmed_at = COALESCE(confirmed_at, ?), paid_since = ?, amount = ?, currency = ?, interval = ?,
                 provider = ?, payment_account_id = ?, customer_id = ?, subscription_id = ? WHERE id = ?`
            ).bind(now(), now(), input.amount, input.currency, input.interval, ...fields, id)
            : env.DB.prepare(
                `INSERT INTO subscribers (id, site_id, email, status, tier, source, token, paid_since, amount, currency, interval, provider, payment_account_id, customer_id, subscription_id, created_at, confirmed_at)
                 VALUES (?, ?, ?, 'active', 'paid', 'checkout', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            ).bind(id, siteId, input.email, randomHex(24), now(), input.amount, input.currency, input.interval, ...fields, now(), now()),
        env.DB.prepare("INSERT INTO member_events (site_id, subscriber_id, type, amount, created_at) VALUES (?, ?, 'upgraded', ?, ?)").bind(siteId, id, input.amount, now()),
    ]);
}

async function cancelMember(env: AppEnv, siteId: string, input: { subscriptionId: string; email?: string; subscriberId?: string }): Promise<void>
{
    let row: { id: string; amount: number } | null = null;
    if (input.subscriptionId)
    {
        row = await env.DB.prepare("SELECT id, amount FROM subscribers WHERE site_id = ? AND subscription_id = ?").bind(siteId, input.subscriptionId).first();
    }
    if (!row && input.subscriberId)
    {
        row = await env.DB.prepare("SELECT id, amount FROM subscribers WHERE site_id = ? AND id = ?").bind(siteId, input.subscriberId).first();
    }
    if (!row && input.email)
    {
        row = await env.DB.prepare("SELECT id, amount FROM subscribers WHERE site_id = ? AND email = ?").bind(siteId, input.email.toLowerCase()).first();
    }
    if (!row)
    {
        return;
    }
    await env.DB.batch([
        env.DB.prepare("UPDATE subscribers SET tier = 'free', amount = 0, subscription_id = '' WHERE id = ? AND tier = 'paid'").bind(row.id),
        env.DB.prepare("INSERT INTO member_events (site_id, subscriber_id, type, amount, created_at) VALUES (?, ?, 'cancelled', ?, ?)").bind(siteId, row.id, row.amount, now()),
    ]);
}

// ---------- PayPal ----------

function paypalBase(account: Pick<Account, "sandbox">): string
{
    return account.sandbox ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com";
}

async function paypalToken(account: Account): Promise<string>
{
    const response = await fetch(`${paypalBase(account)}/v1/oauth2/token`, {
        method: "POST",
        headers: { Authorization: `Basic ${btoa(`${account.public_key}:${account.secret}`)}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: "grant_type=client_credentials",
    });
    const data = await response.json<{ access_token?: string; error_description?: string }>().catch(() => ({ access_token: undefined, error_description: undefined }));
    if (!response.ok || !data.access_token)
    {
        console.error("PayPal auth error", data.error_description);
        throw new ApiError(503, "payment_error", "PayPal rejected this blog's credentials. Check the client ID and secret.");
    }
    return data.access_token;
}

async function paypalRequest<T>(account: Account, token: string, path: string, body: unknown): Promise<T>
{
    const response = await fetch(`${paypalBase(account)}${path}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify(body),
    });
    const data = await response.json<T & { message?: string }>().catch(() => ({}) as T & { message?: string });
    if (!response.ok)
    {
        console.error("PayPal error", path, response.status, data.message);
        throw new ApiError(503, "payment_error", "PayPal returned an error. Try again later.");
    }
    return data;
}

// PayPal amounts are decimal strings in the currency's major unit.
export function paypalValue(minor: number): string
{
    return (minor / 100).toFixed(2);
}

async function paypalPlan(env: AppEnv, account: Account, token: string, site: SiteWithSettings, tier: Tier, interval: "month" | "year", amount: number): Promise<string>
{
    const currency = tier.currency.toUpperCase();
    const cached = await env.DB
        .prepare("SELECT plan_id FROM paypal_plans WHERE account_id = ? AND tier_id = ? AND interval = ? AND amount = ? AND currency = ?")
        .bind(account.id, tier.id, interval, amount, currency)
        .first<{ plan_id: string }>();
    if (cached)
    {
        return cached.plan_id;
    }
    const name = `${site.title}: ${tier.name}`.slice(0, 127);
    const product = await paypalRequest<{ id: string }>(account, token, "/v1/catalogs/products", { name, type: "SERVICE" });
    const plan = await paypalRequest<{ id: string }>(account, token, "/v1/billing/plans", {
        product_id: product.id,
        name,
        status: "ACTIVE",
        billing_cycles: [{
            frequency: { interval_unit: interval === "year" ? "YEAR" : "MONTH", interval_count: 1 },
            tenure_type: "REGULAR",
            sequence: 1,
            // 0 means the cycle repeats until the subscription is cancelled.
            total_cycles: 0,
            pricing_scheme: { fixed_price: { value: paypalValue(amount), currency_code: currency } },
        }],
        payment_preferences: { auto_bill_outstanding: true, payment_failure_threshold: 3 },
    });
    await env.DB.prepare("INSERT OR REPLACE INTO paypal_plans (account_id, tier_id, interval, amount, currency, plan_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .bind(account.id, tier.id, interval, amount, currency, plan.id, now()).run();
    return plan.id;
}

async function createPayPalCheckout(env: AppEnv, site: SiteWithSettings, input: { tier: Tier; interval: "month" | "year"; amount: number; email: string; origin: string }): Promise<string>
{
    const account = (await paymentAccount(env, site.id, "paypal"))!;
    const token = await paypalToken(account);
    const planId = await paypalPlan(env, account, token, site, input.tier, input.interval, input.amount);
    // The subscriber row exists before payment so the webhook can find it by id through custom_id.
    let subscriber = await env.DB.prepare("SELECT id FROM subscribers WHERE site_id = ? AND email = ?").bind(site.id, input.email).first<{ id: string }>();
    if (!subscriber)
    {
        subscriber = { id: newId() };
        await env.DB.prepare("INSERT INTO subscribers (id, site_id, email, status, source, token, created_at) VALUES (?, ?, ?, 'pending', 'checkout', ?, ?)")
            .bind(subscriber.id, site.id, input.email, randomHex(24), now()).run();
    }
    const subscription = await paypalRequest<{ links?: { href: string; rel: string }[] }>(account, token, "/v1/billing/subscriptions", {
        plan_id: planId,
        custom_id: subscriber.id,
        subscriber: { email_address: input.email },
        application_context: {
            brand_name: site.title.slice(0, 127),
            user_action: "SUBSCRIBE_NOW",
            return_url: `${input.origin}/message?m=${encodeURIComponent("Welcome aboard! Your paid membership starts as soon as PayPal confirms the payment.")}`,
            cancel_url: `${input.origin}/subscribe`,
        },
    });
    const approve = subscription.links?.find((link) => link.rel === "approve")?.href;
    if (!approve)
    {
        throw new ApiError(503, "payment_error", "PayPal didn't return a checkout link. Try again later.");
    }
    return approve;
}

export type PayPalEvent = { event_type?: string; resource?: { id?: string; custom_id?: string; plan_id?: string; subscriber?: { email_address?: string } } };

export type PayPalAction =
    | { kind: "upgrade"; subscriberId: string; subscriptionId: string; planId: string; email: string }
    | { kind: "cancel"; subscriberId: string; subscriptionId: string }
    | { kind: "ignore" };

// Pure mapping from a PayPal webhook event to what Writestead does with it.
export function mapPayPalEvent(event: PayPalEvent): PayPalAction
{
    const resource = event.resource ?? {};
    const subscriberId = resource.custom_id ?? "";
    const subscriptionId = resource.id ?? "";
    if (!subscriptionId)
    {
        return { kind: "ignore" };
    }
    if (event.event_type === "BILLING.SUBSCRIPTION.ACTIVATED" && subscriberId)
    {
        return { kind: "upgrade", subscriberId, subscriptionId, planId: resource.plan_id ?? "", email: (resource.subscriber?.email_address ?? "").toLowerCase() };
    }
    if (event.event_type === "BILLING.SUBSCRIPTION.CANCELLED" || event.event_type === "BILLING.SUBSCRIPTION.EXPIRED")
    {
        return { kind: "cancel", subscriberId, subscriptionId };
    }
    return { kind: "ignore" };
}

export async function handlePayPalWebhook(env: AppEnv, site: SiteWithSettings, accountId: string, request: Request): Promise<void>
{
    const account = await paymentAccount(env, site.id, "paypal", accountId);
    if (!account?.webhook_secret)
    {
        throw new ApiError(404, "not_found", "Unknown payment account.");
    }
    const event = await request.json<PayPalEvent>();
    // PayPal checks the signature for us; the webhook id ties it to this account's endpoint.
    const token = await paypalToken(account);
    const verification = await paypalRequest<{ verification_status?: string }>(account, token, "/v1/notifications/verify-webhook-signature", {
        auth_algo: request.headers.get("paypal-auth-algo") ?? "",
        cert_url: request.headers.get("paypal-cert-url") ?? "",
        transmission_id: request.headers.get("paypal-transmission-id") ?? "",
        transmission_sig: request.headers.get("paypal-transmission-sig") ?? "",
        transmission_time: request.headers.get("paypal-transmission-time") ?? "",
        webhook_id: account.webhook_secret,
        webhook_event: event,
    });
    if (verification.verification_status !== "SUCCESS")
    {
        throw new ApiError(400, "bad_signature", "Invalid signature.");
    }
    const action = mapPayPalEvent(event);
    if (action.kind === "upgrade")
    {
        const plan = await env.DB.prepare("SELECT interval, amount, currency FROM paypal_plans WHERE plan_id = ?").bind(action.planId).first<{ interval: string; amount: number; currency: string }>();
        const member = await env.DB.prepare("SELECT email FROM subscribers WHERE site_id = ? AND id = ?").bind(site.id, action.subscriberId).first<{ email: string }>();
        if (!member)
        {
            return;
        }
        await upgradeMember(env, site.id, {
            subscriberId: action.subscriberId,
            email: member.email,
            provider: "paypal",
            accountId: account.id,
            customerId: "",
            subscriptionId: action.subscriptionId,
            amount: plan?.amount ?? 0,
            currency: (plan?.currency ?? "usd").toLowerCase(),
            interval: plan?.interval ?? "",
        });
    }
    if (action.kind === "cancel")
    {
        await cancelMember(env, site.id, { subscriptionId: action.subscriptionId, subscriberId: action.subscriberId });
    }
}
