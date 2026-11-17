import { Hono } from "hono";
import type { HonoEnv } from "../../auth";
import { getEntitlements } from "../../env";
import { now } from "../../lib/http";

export const analyticsRoutes = new Hono<HonoEnv>();

type Row = Record<string, string | number | null>;

analyticsRoutes.get("/analytics", async (c) =>
{
    const site = c.get("site");
    const entitlements = getEntitlements(c.env, site);
    const days = Math.min(Math.max(Number(c.req.query("days")) || 30, 1), entitlements.analyticsDays);
    const end = now();
    const start = end - days * 86400;
    const previousStart = start - days * 86400;
    const db = c.env.DB;
    const day = "date(created_at, 'unixepoch')";
    const results = await db.batch<Row>([
        // 0: totals for this period and the one before, for the change badges
        db.prepare(`SELECT COUNT(*) AS views, COUNT(DISTINCT visitor) AS visitors FROM pageviews WHERE site_id = ? AND created_at >= ?`).bind(site.id, start),
        db.prepare(`SELECT COUNT(*) AS views, COUNT(DISTINCT visitor) AS visitors FROM pageviews WHERE site_id = ? AND created_at >= ? AND created_at < ?`).bind(site.id, previousStart, start),
        // 2: views per day
        db.prepare(`SELECT ${day} AS day, COUNT(*) AS views, COUNT(DISTINCT visitor) AS visitors FROM pageviews WHERE site_id = ? AND created_at >= ? GROUP BY day ORDER BY day`).bind(site.id, start),
        // 3-7: breakdowns
        db.prepare(`SELECT pv.path, COALESCE(p.title, pv.path) AS title, COUNT(*) AS views, COUNT(DISTINCT pv.visitor) AS visitors FROM pageviews pv LEFT JOIN posts p ON p.id = pv.post_id WHERE pv.site_id = ? AND pv.created_at >= ? GROUP BY pv.path ORDER BY views DESC LIMIT 10`).bind(site.id, start),
        db.prepare(`SELECT CASE WHEN referrer = '' THEN 'Direct' ELSE referrer END AS name, COUNT(DISTINCT visitor) AS visitors FROM pageviews WHERE site_id = ? AND created_at >= ? GROUP BY name ORDER BY visitors DESC LIMIT 10`).bind(site.id, start),
        db.prepare(`SELECT CASE WHEN country = '' THEN '??' ELSE country END AS name, COUNT(DISTINCT visitor) AS visitors FROM pageviews WHERE site_id = ? AND created_at >= ? GROUP BY name ORDER BY visitors DESC LIMIT 10`).bind(site.id, start),
        db.prepare(`SELECT device AS name, COUNT(DISTINCT visitor) AS visitors FROM pageviews WHERE site_id = ? AND created_at >= ? GROUP BY name ORDER BY visitors DESC`).bind(site.id, start),
        db.prepare(`SELECT utm_source AS name, COUNT(DISTINCT visitor) AS visitors FROM pageviews WHERE site_id = ? AND created_at >= ? AND utm_source != '' GROUP BY name ORDER BY visitors DESC LIMIT 10`).bind(site.id, start),
        // 8: subscriber counts now
        db.prepare(`SELECT COUNT(*) FILTER (WHERE status = 'active') AS active, COUNT(*) FILTER (WHERE status = 'active' AND tier = 'free') AS free,
            COUNT(*) FILTER (WHERE status = 'active' AND tier IN ('paid', 'comp')) AS paid, COUNT(*) FILTER (WHERE status = 'pending') AS pending,
            COALESCE(SUM(CASE WHEN tier = 'paid' THEN CASE WHEN interval = 'year' THEN amount / 12 ELSE amount END ELSE 0 END), 0) AS mrr
            FROM subscribers WHERE site_id = ?`).bind(site.id),
        // 9: member events in the period, by day and type
        db.prepare(`SELECT ${day} AS day, type, COUNT(*) AS n, COALESCE(SUM(amount), 0) AS amount FROM member_events WHERE site_id = ? AND created_at >= ? GROUP BY day, type ORDER BY day`).bind(site.id, start),
        // 10: newsletters in the period
        db.prepare(`SELECT e.id, e.subject, e.recipients, e.created_at,
            (SELECT COUNT(DISTINCT subscriber_id) FROM email_events WHERE email_id = e.id AND type = 'open') AS opens,
            (SELECT COUNT(DISTINCT subscriber_id) FROM email_events WHERE email_id = e.id AND type = 'click') AS clicks
            FROM emails e WHERE e.site_id = ? AND e.created_at >= ? ORDER BY e.created_at DESC LIMIT 20`).bind(site.id, start),
        // 11: subscribers per signup source in the period (which posts and forms convert)
        db.prepare(`SELECT CASE WHEN source = '' THEN 'web' ELSE source END AS name, COUNT(*) AS visitors FROM subscribers WHERE site_id = ? AND created_at >= ? GROUP BY name ORDER BY visitors DESC LIMIT 10`).bind(site.id, start),
        // 12: active members at the start of the period, to draw the growth line
        db.prepare(`SELECT COUNT(*) AS n FROM subscribers WHERE site_id = ? AND confirmed_at IS NOT NULL AND confirmed_at < ? AND (unsubscribed_at IS NULL OR unsubscribed_at >= ?)`).bind(site.id, start, start),
    ]);
    const first = (index: number) => (results[index].results[0] ?? {}) as Row;
    const events = results[9].results as { day: string; type: string; n: number; amount: number }[];
    const sum = (type: string, field: "n" | "amount" = "n") => events.filter((event) => event.type === type).reduce((total, event) => total + Number(event[field]), 0);
    const emails = results[10].results as { recipients: number; opens: number; clicks: number }[];
    const delivered = emails.reduce((total, email) => total + email.recipients, 0);
    const advanced = entitlements.canUseAdvancedAnalytics;
    return c.json({
        days,
        maxDays: entitlements.analyticsDays,
        advanced,
        web: {
            ...first(0),
            previous: first(1),
            series: results[2].results,
            pages: results[3].results,
            referrers: results[4].results,
            countries: results[5].results,
            devices: results[6].results,
            utm: advanced ? results[7].results : [],
        },
        members: {
            ...first(8),
            mrr: advanced ? first(8).mrr : null,
            startCount: first(12).n,
            series: events,
            subscribed: sum("subscribed"),
            unsubscribed: sum("unsubscribed"),
            upgraded: sum("upgraded"),
            cancelled: sum("cancelled"),
            newRevenue: advanced ? sum("upgraded", "amount") : null,
            lostRevenue: advanced ? sum("cancelled", "amount") : null,
            sources: results[11].results,
        },
        newsletters: {
            sent: emails.length,
            openRate: delivered ? emails.reduce((total, email) => total + email.opens, 0) / delivered : 0,
            clickRate: delivered ? emails.reduce((total, email) => total + email.clicks, 0) / delivered : 0,
            emails,
        },
    });
});
