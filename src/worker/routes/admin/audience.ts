import { Hono } from "hono";
import { checkEmail, type HonoEnv, requirePermission } from "../../auth";
import { getEntitlements, siteUrl } from "../../env";
import { randomHex } from "../../lib/crypto";
import { ApiError, badRequest, newId, now, readJson, text } from "../../lib/http";
import { parseCsv, toCsv } from "../../../shared/csv";
import { fireWebhooks } from "../../webhooks";

export const audienceRoutes = new Hono<HonoEnv>();

audienceRoutes.use("/subscribers/*", async (c, next) =>
{
    requirePermission(c, "manage_subscribers");
    await next();
});

const SUBSCRIBER_COLUMNS = "id, email, name, status, tier, labels, source, email_enabled, amount, currency, interval, created_at, confirmed_at, unsubscribed_at";

function subscriberFilter(siteId: string, query: Record<string, string | undefined>): { where: string; binds: unknown[] }
{
    const where = ["site_id = ?"];
    const binds: unknown[] = [siteId];
    if (query.q)
    {
        where.push("(email LIKE ? OR name LIKE ?)");
        binds.push(`%${query.q}%`, `%${query.q}%`);
    }
    if (query.status && ["pending", "active", "unsubscribed", "bounced"].includes(query.status))
    {
        where.push("status = ?");
        binds.push(query.status);
    }
    if (query.tier && ["free", "paid", "comp"].includes(query.tier))
    {
        where.push("tier = ?");
        binds.push(query.tier);
    }
    if (query.label)
    {
        where.push("(',' || labels || ',') LIKE ?");
        binds.push(`%,${query.label},%`);
    }
    return { where: where.join(" AND "), binds };
}

audienceRoutes.get("/subscribers", async (c) =>
{
    const site = c.get("site");
    const page = Math.max(1, Number(c.req.query("page")) || 1);
    const { where, binds } = subscriberFilter(site.id, c.req.query());
    const [rows, count, labels, totals] = await c.env.DB.batch([
        c.env.DB.prepare(`SELECT ${SUBSCRIBER_COLUMNS} FROM subscribers WHERE ${where} ORDER BY created_at DESC LIMIT 50 OFFSET ?`).bind(...binds, (page - 1) * 50),
        c.env.DB.prepare(`SELECT COUNT(*) AS total FROM subscribers WHERE ${where}`).bind(...binds),
        c.env.DB.prepare("SELECT labels FROM subscribers WHERE site_id = ? AND labels != ''").bind(site.id),
        c.env.DB.prepare("SELECT status, tier, COUNT(*) AS n FROM subscribers WHERE site_id = ? GROUP BY status, tier").bind(site.id),
    ]);
    const labelSet = new Set<string>();
    for (const row of labels.results as { labels: string }[])
    {
        row.labels.split(",").map((label) => label.trim()).filter(Boolean).forEach((label) => labelSet.add(label));
    }
    return c.json({
        subscribers: rows.results,
        total: (count.results[0] as { total: number }).total,
        labels: [...labelSet].sort(),
        totals: totals.results,
        limit: getEntitlements(c.env, site).subscriberLimit,
    });
});

audienceRoutes.post("/subscribers", async (c) =>
{
    const site = c.get("site");
    const body = await readJson<{ email: string; name: string; labels: string; tier: string }>(c);
    const email = checkEmail(body.email);
    const count = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM subscribers WHERE site_id = ? AND status IN ('active', 'pending')").bind(site.id).first<{ n: number }>();
    if ((count?.n ?? 0) >= getEntitlements(c.env, site).subscriberLimit)
    {
        throw new ApiError(402, "subscriber_limit", "You've reached your plan's subscriber limit. Upgrade to Pro for more.");
    }
    const id = newId();
    await c.env.DB.prepare(
        "INSERT INTO subscribers (id, site_id, email, name, status, tier, labels, source, token, created_at, confirmed_at) VALUES (?, ?, ?, ?, 'active', ?, ?, 'admin', ?, ?, ?)"
    ).bind(id, site.id, email, text(body.name, { max: 80 }), body.tier === "comp" ? "comp" : "free", cleanLabels(body.labels), randomHex(24), now(), now()).run()
        .catch(() =>
        {
            throw new ApiError(409, "exists", "That email is already a subscriber.");
        });
    await c.env.DB.prepare("INSERT INTO member_events (site_id, subscriber_id, type, created_at) VALUES (?, ?, 'subscribed', ?)").bind(site.id, id, now()).run();
    c.executionCtx.waitUntil(fireWebhooks(c.env, site.id, "subscriber.created", { id, email }));
    return c.json({ id });
});

function cleanLabels(value: unknown): string
{
    return typeof value === "string"
        ? [...new Set(value.split(",").map((label) => label.trim().toLowerCase().replace(/[^a-z0-9 _-]/g, "")).filter(Boolean))].slice(0, 20).join(",")
        : "";
}

audienceRoutes.put("/subscribers/:id", async (c) =>
{
    const body = await readJson<{ name: string; labels: string; tier: string; status: string }>(c);
    const site = c.get("site");
    const current = await c.env.DB.prepare("SELECT status, tier FROM subscribers WHERE id = ? AND site_id = ?").bind(c.req.param("id"), site.id).first<{ status: string; tier: string }>();
    if (!current)
    {
        throw new ApiError(404, "not_found", "That subscriber doesn't exist.");
    }
    const status = ["active", "unsubscribed"].includes(body.status ?? "") ? body.status! : current.status;
    // Paid comes only from a real payment; staff can grant or remove complimentary access.
    const tier = body.tier === "comp" || (body.tier === "free" && current.tier === "comp") ? body.tier : current.tier;
    await c.env.DB.prepare("UPDATE subscribers SET name = ?, labels = ?, tier = ?, status = ?, unsubscribed_at = CASE WHEN ? = 'unsubscribed' THEN ? ELSE unsubscribed_at END WHERE id = ? AND site_id = ?")
        .bind(text(body.name, { max: 80 }), cleanLabels(body.labels), tier, status, status, now(), c.req.param("id"), site.id).run();
    return c.json({ ok: true });
});

audienceRoutes.delete("/subscribers/:id", async (c) =>
{
    const site = c.get("site");
    await c.env.DB.prepare("DELETE FROM subscribers WHERE id = ? AND site_id = ?").bind(c.req.param("id"), site.id).run();
    c.executionCtx.waitUntil(fireWebhooks(c.env, site.id, "subscriber.deleted", { id: c.req.param("id") }));
    return c.json({ ok: true });
});

// CSV import: needs an email column; name, labels and created_at are optional.
audienceRoutes.post("/subscribers/import", async (c) =>
{
    const site = c.get("site");
    const body = await readJson<{ csv: string; labels: string }>(c);
    const rows = parseCsv(typeof body.csv === "string" ? body.csv : "");
    if (rows.length < 2)
    {
        throw badRequest("The CSV needs a header row and at least one subscriber.");
    }
    const header = rows[0].map((cell) => cell.trim().toLowerCase());
    const emailIndex = header.findIndex((cell) => cell === "email" || cell === "email_address" || cell === "email address");
    if (emailIndex === -1)
    {
        throw badRequest("The CSV needs a column named email.");
    }
    const nameIndex = header.findIndex((cell) => cell === "name" || cell === "full name");
    const labelIndex = header.findIndex((cell) => cell === "labels" || cell === "tags");
    const limit = getEntitlements(c.env, site).subscriberLimit;
    const count = (await c.env.DB.prepare("SELECT COUNT(*) AS n FROM subscribers WHERE site_id = ?").bind(site.id).first<{ n: number }>())?.n ?? 0;
    const extra = cleanLabels(body.labels);
    let imported = 0;
    let skipped = 0;
    const statements: D1PreparedStatement[] = [];
    for (const row of rows.slice(1))
    {
        const email = (row[emailIndex] ?? "").trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || count + imported >= limit)
        {
            skipped++;
            continue;
        }
        const labels = cleanLabels([labelIndex >= 0 ? row[labelIndex] : "", extra].filter(Boolean).join(","));
        statements.push(c.env.DB.prepare(
            "INSERT OR IGNORE INTO subscribers (id, site_id, email, name, status, labels, source, token, created_at, confirmed_at) VALUES (?, ?, ?, ?, 'active', ?, 'import', ?, ?, ?)"
        ).bind(newId(), site.id, email, nameIndex >= 0 ? (row[nameIndex] ?? "").slice(0, 80) : "", labels, randomHex(24), now(), now()));
        imported++;
    }
    for (let index = 0; index < statements.length; index += 100)
    {
        await c.env.DB.batch(statements.slice(index, index + 100));
    }
    return c.json({ imported, skipped });
});

audienceRoutes.get("/subscribers/export", async (c) =>
{
    const site = c.get("site");
    const { where, binds } = subscriberFilter(site.id, c.req.query());
    const { results } = await c.env.DB.prepare(`SELECT email, name, status, tier, labels, source, created_at FROM subscribers WHERE ${where} ORDER BY created_at`).bind(...binds).all<Record<string, string | number>>();
    const csv = toCsv([
        ["email", "name", "status", "tier", "labels", "source", "created_at"],
        ...results.map((row) => [row.email, row.name, row.status, row.tier, row.labels, row.source, new Date(Number(row.created_at) * 1000).toISOString()].map(String)),
    ]);
    return c.body(csv, 200, { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="subscribers.csv"` });
});

// ---------- Newsletters ----------

audienceRoutes.get("/emails", async (c) =>
{
    const { results } = await c.env.DB.prepare(
        `SELECT e.id, e.post_id, e.subject, e.segment, e.status, e.recipients, e.delivered, e.failed, e.created_at,
            (SELECT COUNT(DISTINCT subscriber_id) FROM email_events WHERE email_id = e.id AND type = 'open') AS opens,
            (SELECT COUNT(DISTINCT subscriber_id) FROM email_events WHERE email_id = e.id AND type = 'click') AS clicks
         FROM emails e WHERE e.site_id = ? ORDER BY e.created_at DESC LIMIT 100`
    ).bind(c.get("site").id).all();
    return c.json({ emails: results });
});

audienceRoutes.get("/emails/:id", async (c) =>
{
    const site = c.get("site");
    const email = await c.env.DB.prepare("SELECT id, subject, recipients, delivered, failed, created_at FROM emails WHERE id = ? AND site_id = ?").bind(c.req.param("id"), site.id).first();
    if (!email)
    {
        throw new ApiError(404, "not_found", "That email doesn't exist.");
    }
    const { results: links } = await c.env.DB.prepare(
        "SELECT url, COUNT(*) AS clicks, COUNT(DISTINCT subscriber_id) AS people FROM email_events WHERE email_id = ? AND type = 'click' GROUP BY url ORDER BY clicks DESC LIMIT 20"
    ).bind(c.req.param("id")).all();
    return c.json({ email, links });
});

// ---------- Comments ----------

audienceRoutes.get("/comments", async (c) =>
{
    const status = ["pending", "approved", "spam"].includes(c.req.query("status") ?? "") ? c.req.query("status") : "pending";
    const { results } = await c.env.DB.prepare(
        `SELECT cm.id, cm.name, cm.body, cm.status, cm.created_at, p.title AS post_title, p.slug AS post_slug,
            COALESCE(s.email, '') AS email FROM comments cm JOIN posts p ON p.id = cm.post_id LEFT JOIN subscribers s ON s.id = cm.subscriber_id
         WHERE cm.site_id = ? AND cm.status = ? ORDER BY cm.created_at DESC LIMIT 200`
    ).bind(c.get("site").id, status).all();
    const counts = await c.env.DB.prepare("SELECT status, COUNT(*) AS n FROM comments WHERE site_id = ? GROUP BY status").bind(c.get("site").id).all();
    return c.json({ comments: results, counts: counts.results });
});

audienceRoutes.put("/comments/:id", async (c) =>
{
    requirePermission(c, "edit_any_post");
    const body = await readJson<{ status: string }>(c);
    if (!["pending", "approved", "spam"].includes(body.status ?? ""))
    {
        throw badRequest("Unknown status.");
    }
    await c.env.DB.prepare("UPDATE comments SET status = ? WHERE id = ? AND site_id = ?").bind(body.status, c.req.param("id"), c.get("site").id).run();
    return c.json({ ok: true });
});

audienceRoutes.delete("/comments/:id", async (c) =>
{
    requirePermission(c, "edit_any_post");
    await c.env.DB.prepare("DELETE FROM comments WHERE id = ? AND site_id = ?").bind(c.req.param("id"), c.get("site").id).run();
    return c.json({ ok: true });
});

// ---------- Paid tiers and payment accounts ----------

audienceRoutes.get("/tiers", async (c) =>
{
    const site = c.get("site");
    const [tiers, accounts] = await c.env.DB.batch([
        c.env.DB.prepare("SELECT id, name, description, monthly_price, yearly_price, currency, benefits, active FROM tiers WHERE site_id = ? ORDER BY monthly_price").bind(site.id),
        // Only a prefix is shown: the Stripe key's mode prefix, or PayPal's public client id.
        c.env.DB.prepare(
            `SELECT id, provider, label, is_default, sandbox, created_at, webhook_secret != '' AS has_webhook,
             CASE WHEN provider = 'paypal' THEN substr(public_key, 1, 10) ELSE substr(secret, 1, 8) END AS hint
             FROM payment_accounts WHERE site_id = ? ORDER BY created_at`
        ).bind(site.id),
    ]);
    // The UI appends "<provider>/<account id>" to build each account's webhook URL.
    return c.json({ tiers: tiers.results, accounts: accounts.results, webhookBase: `${siteUrl(c.env, site, new URL(c.req.url).origin)}/api/webhooks/` });
});

function requirePaid(c: Parameters<typeof requirePermission>[0])
{
    requirePermission(c, "manage_settings");
    if (!getEntitlements(c.env, c.get("site")).canUsePaidMembers)
    {
        throw new ApiError(402, "upgrade_required", "Paid memberships are part of Pro.");
    }
}

audienceRoutes.post("/tiers", async (c) =>
{
    requirePaid(c);
    const body = await readJson<{ id: string; name: string; description: string; monthly_price: number; yearly_price: number; currency: string; benefits: string; active: boolean }>(c);
    const name = text(body.name, { max: 80, field: "Name" });
    const monthly = Math.round(Number(body.monthly_price) || 0);
    if (!name || monthly < 100)
    {
        throw badRequest("Give the tier a name and a monthly price of at least 1.00.");
    }
    const currency = /^[a-z]{3}$/i.test(body.currency ?? "") ? body.currency!.toLowerCase() : "usd";
    const values = [name, text(body.description, { max: 500 }), monthly, Math.round(Number(body.yearly_price) || 0), currency, text(body.benefits, { max: 2000 }), body.active === false ? 0 : 1];
    if (body.id)
    {
        await c.env.DB.prepare("UPDATE tiers SET name = ?, description = ?, monthly_price = ?, yearly_price = ?, currency = ?, benefits = ?, active = ? WHERE id = ? AND site_id = ?")
            .bind(...values, body.id, c.get("site").id).run();
        return c.json({ id: body.id });
    }
    const id = newId();
    await c.env.DB.prepare("INSERT INTO tiers (id, site_id, name, description, monthly_price, yearly_price, currency, benefits, active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(id, c.get("site").id, ...values, now()).run();
    return c.json({ id });
});

audienceRoutes.delete("/tiers/:id", async (c) =>
{
    requirePaid(c);
    await c.env.DB.prepare("DELETE FROM tiers WHERE id = ? AND site_id = ?").bind(c.req.param("id"), c.get("site").id).run();
    return c.json({ ok: true });
});

audienceRoutes.post("/payment-accounts", async (c) =>
{
    requirePaid(c);
    const body = await readJson<{ provider: string; label: string; secret: string; public_key: string; webhook_secret: string; sandbox: boolean }>(c);
    const provider = body.provider === "paypal" ? "paypal" : "stripe";
    const secret = text(body.secret, { max: 300, field: "Secret key" });
    if (provider === "stripe" && !/^(sk|rk)_(live|test)_/.test(secret))
    {
        throw badRequest("Paste a Stripe secret or restricted key (it starts with sk_ or rk_).");
    }
    if (!secret)
    {
        throw badRequest("Paste the account's secret.");
    }
    if (provider === "paypal" && !text(body.public_key, { max: 300 }))
    {
        throw badRequest("PayPal needs the client ID and the secret.");
    }
    const site = c.get("site");
    const hasDefault = await c.env.DB.prepare("SELECT 1 FROM payment_accounts WHERE site_id = ? AND provider = ? AND is_default = 1").bind(site.id, provider).first();
    const id = newId();
    await c.env.DB.prepare("INSERT INTO payment_accounts (id, site_id, provider, label, secret, public_key, webhook_secret, sandbox, is_default, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(
            id, site.id, provider, text(body.label, { max: 80 }) || (provider === "stripe" ? "Stripe" : "PayPal"), secret, text(body.public_key, { max: 300 }),
            text(body.webhook_secret, { max: 300 }), provider === "paypal" && body.sandbox ? 1 : 0, hasDefault ? 0 : 1, now()
        ).run();
    return c.json({ id });
});

// The webhook URL includes the account id, so its secret (Stripe) or webhook id (PayPal) comes after connecting.
audienceRoutes.put("/payment-accounts/:id/webhook", async (c) =>
{
    requirePaid(c);
    const body = await readJson<{ webhook_secret: string }>(c);
    const value = text(body.webhook_secret, { max: 300, field: "Webhook secret" });
    if (!value)
    {
        throw badRequest("Paste the webhook signing secret or webhook ID.");
    }
    await c.env.DB.prepare("UPDATE payment_accounts SET webhook_secret = ? WHERE id = ? AND site_id = ?").bind(value, c.req.param("id"), c.get("site").id).run();
    return c.json({ ok: true });
});

audienceRoutes.put("/payment-accounts/:id/default", async (c) =>
{
    requirePaid(c);
    const site = c.get("site");
    const row = await c.env.DB.prepare("SELECT provider FROM payment_accounts WHERE id = ? AND site_id = ?").bind(c.req.param("id"), site.id).first<{ provider: string }>();
    if (row)
    {
        await c.env.DB.batch([
            c.env.DB.prepare("UPDATE payment_accounts SET is_default = 0 WHERE site_id = ? AND provider = ?").bind(site.id, row.provider),
            c.env.DB.prepare("UPDATE payment_accounts SET is_default = 1 WHERE id = ?").bind(c.req.param("id")),
        ]);
    }
    return c.json({ ok: true });
});

audienceRoutes.delete("/payment-accounts/:id", async (c) =>
{
    requirePaid(c);
    await c.env.DB.prepare("DELETE FROM payment_accounts WHERE id = ? AND site_id = ?").bind(c.req.param("id"), c.get("site").id).run();
    return c.json({ ok: true });
});
