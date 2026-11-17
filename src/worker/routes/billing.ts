import { Hono } from "hono";
import { PRO_PRICE, TEAMS_PRICE } from "../../shared/plans";
import { type HonoEnv, requirePermission } from "../auth";
import { type AppEnv, isMulti, siteUrl } from "../env";
import { ApiError, readJson } from "../lib/http";
import { stripeRequest, verifyStripeSignature } from "../payments";

// Hosted version only: blogs pay for Pro or Teams with the platform's own Stripe account.
// Self-hosted installs never see this, because everything is already unlocked there.

export function billingEnabled(env: AppEnv): boolean
{
    return isMulti(env) && Boolean(env.PLATFORM_STRIPE_SECRET_KEY);
}

type PaidPlan = "pro" | "teams";

const PRICES: Record<PaidPlan, { monthly: number; yearly: number; name: string }> = {
    pro: { ...PRO_PRICE, name: "Writestead Pro" },
    teams: { ...TEAMS_PRICE, name: "Writestead Teams" },
};

// Mounted under /api/admin, after requireStaff.
export const billingAdminRoutes = new Hono<HonoEnv>();

billingAdminRoutes.get("/billing", (c) =>
{
    return c.json({ enabled: billingEnabled(c.env), plan: c.get("site").plan });
});

billingAdminRoutes.post("/billing/checkout", async (c) =>
{
    requirePermission(c, "billing");
    if (!billingEnabled(c.env))
    {
        throw new ApiError(404, "billing_off", "Online billing isn't set up on this server.");
    }
    const site = c.get("site");
    const body = await readJson<{ plan: string; interval: string }>(c);
    const plan: PaidPlan = body.plan === "teams" ? "teams" : "pro";
    const interval = body.interval === "year" ? "year" : "month";
    const price = PRICES[plan];
    const billing = await c.env.DB.prepare("SELECT billing_customer_id, billing_subscription_id FROM sites WHERE id = ?").bind(site.id)
        .first<{ billing_customer_id: string; billing_subscription_id: string }>();
    if (billing?.billing_subscription_id && site.plan !== "free")
    {
        throw new ApiError(409, "already_subscribed", "You already have a subscription. Use Manage billing to change it.");
    }
    const origin = siteUrl(c.env, site, new URL(c.req.url).origin);
    const params: Record<string, string> = {
        mode: "subscription",
        client_reference_id: site.id,
        "line_items[0][quantity]": "1",
        "line_items[0][price_data][currency]": "usd",
        "line_items[0][price_data][unit_amount]": String((interval === "year" ? price.yearly : price.monthly) * 100),
        "line_items[0][price_data][recurring][interval]": interval,
        "line_items[0][price_data][product_data][name]": price.name,
        success_url: `${origin}/admin/settings/plan?upgraded=1`,
        cancel_url: `${origin}/admin/settings/plan`,
        "metadata[site_id]": site.id,
        "metadata[plan]": plan,
        "metadata[interval]": interval,
        // Copied onto the subscription so later updates and cancellations know which blog they're for.
        "subscription_data[metadata][site_id]": site.id,
        "subscription_data[metadata][plan]": plan,
    };
    if (billing?.billing_customer_id)
    {
        params.customer = billing.billing_customer_id;
    }
    else
    {
        params.customer_email = c.get("user").email;
    }
    const session = await stripeRequest<{ url: string }>(c.env.PLATFORM_STRIPE_SECRET_KEY!, "checkout/sessions", params);
    return c.json({ url: session.url });
});

billingAdminRoutes.post("/billing/portal", async (c) =>
{
    requirePermission(c, "billing");
    if (!billingEnabled(c.env))
    {
        throw new ApiError(404, "billing_off", "Online billing isn't set up on this server.");
    }
    const site = c.get("site");
    const billing = await c.env.DB.prepare("SELECT billing_customer_id FROM sites WHERE id = ?").bind(site.id).first<{ billing_customer_id: string }>();
    if (!billing?.billing_customer_id)
    {
        throw new ApiError(404, "no_billing", "This blog doesn't have a subscription yet.");
    }
    const session = await stripeRequest<{ url: string }>(c.env.PLATFORM_STRIPE_SECRET_KEY!, "billing_portal/sessions", {
        customer: billing.billing_customer_id,
        return_url: `${siteUrl(c.env, site, new URL(c.req.url).origin)}/admin/settings/plan`,
    });
    return c.json({ url: session.url });
});

type BillingObject = {
    id?: string;
    customer?: string | null;
    subscription?: string | null;
    status?: string;
    metadata?: Record<string, string>;
};

// Mounted before host resolution so it answers on the root domain, where Stripe points.
export const billingWebhookRoutes = new Hono<{ Bindings: AppEnv }>();

billingWebhookRoutes.post("/api/billing/webhook", async (c) =>
{
    if (!billingEnabled(c.env) || !c.env.PLATFORM_STRIPE_WEBHOOK_SECRET)
    {
        throw new ApiError(404, "billing_off", "Billing isn't set up on this server.");
    }
    const payload = await c.req.text();
    if (!(await verifyStripeSignature(c.env.PLATFORM_STRIPE_WEBHOOK_SECRET, c.req.header("stripe-signature") ?? "", payload)))
    {
        throw new ApiError(400, "bad_signature", "Invalid signature.");
    }
    const event = JSON.parse(payload) as { type: string; data: { object: BillingObject } };
    const object = event.data.object;
    const siteId = object.metadata?.site_id ?? "";
    const plan = object.metadata?.plan === "teams" ? "teams" : "pro";
    if (!siteId)
    {
        return c.json({ received: true });
    }
    if (event.type === "checkout.session.completed")
    {
        await c.env.DB.prepare("UPDATE sites SET plan = ?, billing_customer_id = ?, billing_subscription_id = ?, billing_interval = ? WHERE id = ?")
            .bind(plan, object.customer ?? "", object.subscription ?? "", object.metadata?.interval ?? "", siteId).run();
    }
    if (event.type === "customer.subscription.updated")
    {
        // Past due keeps the plan while Stripe retries the card; only ended states drop to Free.
        const ended = ["canceled", "unpaid", "incomplete_expired"].includes(object.status ?? "");
        await c.env.DB.prepare("UPDATE sites SET plan = ? WHERE id = ? AND billing_subscription_id = ?")
            .bind(ended ? "free" : plan, siteId, object.id ?? "").run();
    }
    if (event.type === "customer.subscription.deleted")
    {
        await c.env.DB.prepare("UPDATE sites SET plan = 'free', billing_subscription_id = '' WHERE id = ? AND billing_subscription_id = ?")
            .bind(siteId, object.id ?? "").run();
    }
    return c.json({ received: true });
});
