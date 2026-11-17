import { type Context, Hono } from "hono";
import { blockDemoWrites, type HonoEnv, requireStaff } from "./auth";
import { ensureSchema } from "./db/migrate";
import type { NewsletterJob } from "./email";
import type { AppEnv } from "./env";
import { publishScheduled, sendFollowUps, sendNewsletterChunk } from "./jobs";
import { landingPage, legalPage, marketingNotFound, marketingRobots, marketingSitemap } from "./landing/page";
import { errorResponse } from "./lib/http";
import { analyticsRoutes } from "./routes/admin/analytics";
import { audienceRoutes } from "./routes/admin/audience";
import { contentRoutes } from "./routes/admin/content";
import { siteRoutes } from "./routes/admin/site";
import { authRoutes } from "./routes/auth";
import { billingAdminRoutes, billingWebhookRoutes } from "./routes/billing";
import { publicRoutes } from "./routes/public";
import { v1Routes } from "./routes/v1";
import { resolveHost } from "./site";

const app = new Hono<HonoEnv>();

app.onError(errorResponse);

app.use("*", async (c, next) =>
{
    await ensureSchema(c.env.DB);
    await next();
});

app.get("/api/health", (c) =>
{
    return c.json({ ok: true });
});

app.route("/api/auth", authRoutes);

// The dashboard is a single-page app; every /admin path gets its shell.
async function adminShell(c: Context<HonoEnv>)
{
    const response = await c.env.ASSETS.fetch(new Request(new URL("/index.html", c.req.url)));
    return new Response(response.body, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache", "X-Robots-Tag": "noindex" } });
}

app.get("/admin", adminShell);
app.get("/admin/*", adminShell);

// Stripe calls the platform billing webhook on whatever host it was given, including the root domain.
app.route("/", billingWebhookRoutes);

// Everything else depends on which hostname was asked for.
app.use("*", async (c, next) =>
{
    const target = await resolveHost(c.env, c.req.header("host") ?? new URL(c.req.url).host);
    const path = new URL(c.req.url).pathname;
    if (target.kind === "marketing")
    {
        if (path === "/")
        {
            return c.html(landingPage(c.env));
        }
        if (path === "/privacy" || path === "/terms")
        {
            return c.html(legalPage(c.env, path === "/privacy" ? "privacy" : "terms"));
        }
        if (path === "/signup" || path === "/login")
        {
            return adminShell(c);
        }
        if (path === "/robots.txt")
        {
            return c.text(marketingRobots(c.env));
        }
        if (path === "/sitemap.xml")
        {
            return c.body(marketingSitemap(c.env), 200, { "Content-Type": "application/xml" });
        }
        return c.html(marketingNotFound(c.env, "Page not found", "That page doesn't exist."), 404);
    }
    if (target.kind === "setup")
    {
        return c.redirect("/admin", 302);
    }
    if (target.kind === "unknown")
    {
        return c.html(marketingNotFound(c.env, "No blog here yet", "This address isn't connected to a blog. Want it? Start a free blog in a minute."), 404);
    }
    c.set("site", target.site);
    await next();
});

app.use("/api/admin/*", requireStaff, blockDemoWrites);
app.route("/api/admin", siteRoutes);
app.route("/api/admin", contentRoutes);
app.route("/api/admin", audienceRoutes);
app.route("/api/admin", analyticsRoutes);
app.route("/api/admin", billingAdminRoutes);
app.route("/api/v1", v1Routes);

app.all("/api/admin/*", (c) =>
{
    return c.json({ error: "Not found.", code: "not_found" }, 404);
});

app.route("/", publicRoutes);

export default {
    fetch: app.fetch,
    async queue(batch: MessageBatch<NewsletterJob>, env: AppEnv)
    {
        await ensureSchema(env.DB);
        for (const message of batch.messages)
        {
            try
            {
                await sendNewsletterChunk(env, message.body);
                message.ack();
            }
            catch (error)
            {
                console.error("Newsletter chunk failed", error);
                message.retry();
            }
        }
    },
    async scheduled(_controller: ScheduledController, env: AppEnv, ctx: ExecutionContext)
    {
        ctx.waitUntil(ensureSchema(env.DB).then(async () =>
        {
            await publishScheduled(env);
            await sendFollowUps(env);
        }));
    },
} satisfies ExportedHandler<AppEnv, NewsletterJob>;
