import { Hono, type Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { HonoEnv } from "../auth";
import { checkEmail } from "../auth";
import { approvedComments, archive, findAuthor, findBySlug, findTag, listPosts, PAGE_SIZE, popularTags, relatedPosts, searchPosts } from "../blog/data";
import { atom, robots, rss, sitemap } from "../blog/feeds";
import {
    accountPage, archivePage, canRead, formatDate, homePage, listingPage, messagePage, notFoundPage, postPage, type Reader,
    type RenderContext, searchPage, subscribePage, waitlistPage,
} from "../blog/render";
import { cachedOgResponse, cardVersion, renderOgImage } from "../og";
import { confirmEmail, sendEmail, signInEmail, welcomeEmail } from "../email";
import { getEntitlements, isMulti, siteUrl } from "../env";
import { randomHex, sha256Hex } from "../lib/crypto";
import { ApiError, newId, now } from "../lib/http";
import { verifyTurnstile } from "../lib/turnstile";
import { deviceOf } from "../lib/ua";
import { getMedia } from "../media";
import { connectedProviders, createBillingPortal, createCheckout, handlePayPalWebhook, handleStripeWebhook } from "../payments";

export const READER_COOKIE = "ws_reader";

type C = Context<HonoEnv>;

export const publicRoutes = new Hono<HonoEnv>();

async function loadReader(c: C): Promise<Reader | null>
{
    const token = getCookie(c, READER_COOKIE);
    if (!token)
    {
        return null;
    }
    return c.env.DB
        .prepare("SELECT id, email, name, tier, status, token, provider FROM subscribers WHERE site_id = ? AND token = ? AND status != 'pending'")
        .bind(c.get("site").id, token)
        .first<Reader>();
}

function origin(c: C): string
{
    return siteUrl(c.env, c.get("site"), new URL(c.req.url).origin) || new URL(c.req.url).origin;
}

async function renderContext(c: C, themeOverride?: string): Promise<RenderContext>
{
    const site = c.get("site");
    const entitlements = getEntitlements(c.env, site);
    return {
        site,
        origin: new URL(c.req.url).origin,
        reader: await loadReader(c),
        poweredBy: !(site.settings.hidePoweredBy && entitlements.canHidePoweredBy),
        customCode: entitlements.canUseCodeInjection,
        turnstileSiteKey: c.env.TURNSTILE_SECRET_KEY ? c.env.TURNSTILE_SITE_KEY : "",
        themeOverride,
        marketingUrl: isMulti(c.env) ? `https://${c.env.ROOT_DOMAIN}` : "https://writestead.com",
    };
}

// Staff can preview any theme with ?preview_theme=<id>; the dashboard loads it in an iframe.
function previewTheme(c: C): string | undefined
{
    return c.req.query("preview_theme") || undefined;
}

function wantsJson(c: C): boolean
{
    return (c.req.header("accept") ?? "").includes("application/json");
}

async function formOrJson(c: C): Promise<Record<string, string>>
{
    const type = c.req.header("content-type") ?? "";
    if (type.includes("application/json"))
    {
        const body = await c.req.json().catch(() => ({}));
        return Object.fromEntries(Object.entries(body ?? {}).map(([key, value]) => [key, String(value ?? "")]));
    }
    const form = await c.req.parseBody();
    return Object.fromEntries(Object.entries(form).map(([key, value]) => [key, typeof value === "string" ? value : ""]));
}

// Form posts answer JSON to the inline script, and redirect to a message page without JS.
function reply(c: C, message: string, redirect?: string)
{
    if (wantsJson(c))
    {
        return c.json({ ok: true, message, redirect });
    }
    return c.redirect(redirect ?? `/message?m=${encodeURIComponent(message)}`, 303);
}

// ---------- Pages ----------

publicRoutes.get("/", async (c) =>
{
    const ctx = await renderContext(c, previewTheme(c));
    if (c.get("site").status === "waitlist" && !previewTheme(c))
    {
        return c.html(waitlistPage(ctx));
    }
    const page = Math.max(1, Number(c.req.query("page")) || 1);
    const [{ posts, total }, featured, tags] = await Promise.all([
        listPosts(c.env.DB, ctx.site, { page }),
        page === 1 ? listPosts(c.env.DB, ctx.site, { featuredOnly: true, limit: 3 }) : Promise.resolve({ posts: [], total: 0 }),
        popularTags(c.env.DB, ctx.site),
    ]);
    return c.html(homePage(ctx, { posts, featured: featured.posts, total, page, tags }, PAGE_SIZE));
});

publicRoutes.get("/tag/:slug", async (c) =>
{
    const ctx = await renderContext(c);
    const tag = await findTag(c.env.DB, ctx.site, c.req.param("slug"));
    if (!tag)
    {
        return c.html(notFoundPage(ctx), 404);
    }
    const page = Math.max(1, Number(c.req.query("page")) || 1);
    const { posts, total } = await listPosts(c.env.DB, ctx.site, { tagId: tag.id, page });
    return c.html(listingPage(ctx, { title: tag.name, eyebrow: "Tag", description: tag.description || `${total} post${total === 1 ? "" : "s"}`, path: `/tag/${tag.slug}`, posts, page, total, pageSize: PAGE_SIZE }));
});

publicRoutes.get("/author/:slug", async (c) =>
{
    const ctx = await renderContext(c);
    const author = await findAuthor(c.env.DB, ctx.site, c.req.param("slug"));
    if (!author)
    {
        return c.html(notFoundPage(ctx), 404);
    }
    const page = Math.max(1, Number(c.req.query("page")) || 1);
    const { posts, total } = await listPosts(c.env.DB, ctx.site, { authorId: author.id, page });
    return c.html(listingPage(ctx, {
        title: author.name, eyebrow: "Author", description: author.bio, avatar: author.avatar || undefined, path: `/author/${author.slug}`, posts, page, total, pageSize: PAGE_SIZE,
        jsonLd: { "@context": "https://schema.org", "@type": "Person", name: author.name, url: `${ctx.origin}/author/${author.slug}`, description: author.bio || undefined },
    }));
});

publicRoutes.get("/archive", async (c) =>
{
    const ctx = await renderContext(c);
    return c.html(archivePage(ctx, await archive(c.env.DB, ctx.site)));
});

publicRoutes.get("/search", async (c) =>
{
    const ctx = await renderContext(c);
    const query = (c.req.query("q") ?? "").trim().slice(0, 100);
    return c.html(searchPage(ctx, query, query ? await searchPosts(c.env.DB, ctx.site, query) : null));
});

publicRoutes.get("/subscribe", async (c) =>
{
    const ctx = await renderContext(c);
    const { results } = await c.env.DB
        .prepare("SELECT id, name, description, monthly_price, yearly_price, currency, benefits FROM tiers WHERE site_id = ? AND active = 1 ORDER BY monthly_price")
        .bind(ctx.site.id)
        .all<{ id: string; name: string; description: string; monthly_price: number; yearly_price: number; currency: string; benefits: string }>();
    const paid = getEntitlements(c.env, ctx.site).canUsePaidMembers ? results : [];
    const providers = paid.length > 0 ? await connectedProviders(c.env, ctx.site.id) : [];
    return c.html(subscribePage(ctx, paid, c.req.query("plan") === "paid", providers));
});

publicRoutes.get("/account", async (c) =>
{
    const ctx = await renderContext(c);
    return c.html(accountPage(ctx, c.req.query("sent") === "1"));
});

publicRoutes.get("/message", async (c) =>
{
    const ctx = await renderContext(c);
    return c.html(messagePage(ctx, "Thanks", (c.req.query("m") ?? "Done.").slice(0, 300), { label: "Back to the blog", href: "/" }));
});

// A bare subscribe form for embedding on other sites with an iframe.
publicRoutes.get("/embed/subscribe", async (c) =>
{
    const site = c.get("site");
    const accent = /^#[0-9a-f]{3,8}$/i.test(site.settings.accent) ? site.settings.accent : "#6d4aff";
    const action = `${origin(c)}/api/subscribe`;
    return c.html(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/_ws/blog.css"><style>:root{--accent:${accent}}body{background:transparent;margin:0}</style></head>
<body><form class="subscribe-form embed-form" method="post" action="${action}" target="_top" data-ws-form><input type="hidden" name="source" value="embed"><label class="sr-only" for="e">Email</label><input id="e" type="email" name="email" required placeholder="you@example.com"><button class="btn" type="submit">Subscribe</button><p class="form-status" role="status"></p></form>
<script>document.querySelector("form").addEventListener("submit",function(e){e.preventDefault();var f=e.target,s=f.querySelector(".form-status");fetch(f.action,{method:"POST",body:new FormData(f),headers:{Accept:"application/json"}}).then(function(r){return r.json()}).then(function(j){s.textContent=j.message||j.error||"";if(j.ok)f.reset()})});</script></body></html>`);
});

// ---------- Feeds ----------

publicRoutes.get("/rss.xml", async (c) =>
{
    const site = c.get("site");
    const { posts } = await listPosts(c.env.DB, site, { limit: 30 });
    return c.body(rss(site, new URL(c.req.url).origin, posts), 200, { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, max-age=300" });
});

publicRoutes.get("/feed", (c) =>
{
    return c.redirect("/rss.xml", 301);
});

publicRoutes.get("/atom.xml", async (c) =>
{
    const site = c.get("site");
    const { posts } = await listPosts(c.env.DB, site, { limit: 30 });
    return c.body(atom(site, new URL(c.req.url).origin, posts), 200, { "Content-Type": "application/atom+xml; charset=utf-8", "Cache-Control": "public, max-age=300" });
});

publicRoutes.get("/sitemap.xml", async (c) =>
{
    const site = c.get("site");
    const [posts, tags, authors] = await c.env.DB.batch<{ slug: string; updated: number }>([
        c.env.DB.prepare("SELECT '/' || slug AS slug, updated_at AS updated FROM posts WHERE site_id = ? AND status = 'published' AND delivery != 'email' ORDER BY published_at DESC").bind(site.id),
        c.env.DB.prepare("SELECT '/tag/' || slug AS slug, ? AS updated FROM tags WHERE site_id = ?").bind(site.created_at, site.id),
        c.env.DB.prepare("SELECT '/author/' || u.slug AS slug, u.created_at AS updated FROM users u JOIN site_members m ON m.user_id = u.id WHERE m.site_id = ?").bind(site.id),
    ]);
    const newest = (posts.results[0] as { updated: number } | undefined)?.updated ?? site.created_at;
    const entries = [{ path: "/", updated: newest }, ...[...posts.results, ...tags.results, ...authors.results].map((row) => ({ path: row.slug, updated: row.updated }))];
    return c.body(sitemap(new URL(c.req.url).origin, entries), 200, { "Content-Type": "application/xml; charset=utf-8" });
});

publicRoutes.get("/robots.txt", (c) =>
{
    return c.text(robots(new URL(c.req.url).origin));
});

// ---------- Media from R2 ----------

publicRoutes.get("/media/*", async (c) =>
{
    const key = decodeURIComponent(new URL(c.req.url).pathname.slice("/media/".length));
    if (!key.startsWith(`${c.get("site").id}/`))
    {
        return c.notFound();
    }
    return (await getMedia(c.env, key)) ?? c.notFound();
});

// ---------- Subscribing ----------

publicRoutes.post("/api/subscribe", async (c) =>
{
    const site = c.get("site");
    if (!site.settings.membersEnabled && site.status !== "waitlist")
    {
        throw new ApiError(403, "subscriptions_off", "This blog isn't taking subscribers right now.");
    }
    const form = await formOrJson(c);
    await verifyTurnstile(c.env, form["cf-turnstile-response"], c.req.header("cf-connecting-ip") ?? null);
    const email = checkEmail(form.email);
    const name = (form.name ?? "").trim().slice(0, 80);
    const source = (form.source ?? "web").slice(0, 40);
    const entitlements = getEntitlements(c.env, site);
    const existing = await c.env.DB.prepare("SELECT id, status, token FROM subscribers WHERE site_id = ? AND email = ?").bind(site.id, email).first<{ id: string; status: string; token: string }>();
    if (existing?.status === "active")
    {
        return reply(c, "You're already subscribed. Thanks!");
    }
    let token = existing?.token;
    if (!existing)
    {
        const count = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM subscribers WHERE site_id = ? AND status IN ('active', 'pending')").bind(site.id).first<{ n: number }>();
        if ((count?.n ?? 0) >= entitlements.subscriberLimit)
        {
            throw new ApiError(402, "subscriber_limit", "This blog has reached its subscriber limit.");
        }
        token = randomHex(24);
        await c.env.DB.prepare("INSERT INTO subscribers (id, site_id, email, name, status, source, token, created_at) VALUES (?, ?, ?, ?, 'pending', ?, ?, ?)")
            .bind(newId(), site.id, email, name, source, token, now()).run();
    }
    else
    {
        await c.env.DB.prepare("UPDATE subscribers SET status = 'pending', email_enabled = 1 WHERE id = ?").bind(existing.id).run();
    }
    // Double opt-in: the subscription only starts after the confirm link is opened.
    const link = `${origin(c)}/api/confirm?t=${token}`;
    const message = confirmEmail(site, link, site.status === "waitlist");
    const outcome = await sendEmail(c.env, { to: email, ...message, fromName: site.title });
    if (!outcome.sent)
    {
        // Without email set up there's no way to confirm by inbox, so confirm right away.
        await activate(c, token!);
        return reply(c, site.status === "waitlist" ? "You're on the list!" : "You're subscribed. Welcome!");
    }
    return reply(c, "Almost there. Check your inbox to confirm your email.");
});

async function activate(c: C, token: string): Promise<{ id: string; email: string; token: string } | null>
{
    const site = c.get("site");
    const row = await c.env.DB.prepare("SELECT id, email, status, token FROM subscribers WHERE site_id = ? AND token = ?").bind(site.id, token).first<{ id: string; email: string; status: string; token: string }>();
    if (!row)
    {
        return null;
    }
    if (row.status !== "active")
    {
        await c.env.DB.batch([
            c.env.DB.prepare("UPDATE subscribers SET status = 'active', confirmed_at = ?, unsubscribed_at = NULL WHERE id = ?").bind(now(), row.id),
            c.env.DB.prepare("INSERT INTO member_events (site_id, subscriber_id, type, created_at) VALUES (?, ?, 'subscribed', ?)").bind(site.id, row.id, now()),
        ]);
        if (site.settings.welcomeEmail.enabled && site.status !== "waitlist")
        {
            const welcome = welcomeEmail(site, `${origin(c)}/account`);
            c.executionCtx.waitUntil(sendEmail(c.env, { to: row.email, ...welcome, fromName: site.title }));
        }
    }
    return row;
}

function setReaderCookie(c: C, token: string)
{
    setCookie(c, READER_COOKIE, token, { httpOnly: true, secure: true, sameSite: "Lax", path: "/", maxAge: 365 * 86400 });
}

publicRoutes.get("/api/confirm", async (c) =>
{
    const row = await activate(c, c.req.query("t") ?? "");
    const ctx = await renderContext(c);
    if (!row)
    {
        return c.html(messagePage(ctx, "Link expired", "This confirmation link isn't valid anymore. Try subscribing again."), 400);
    }
    setReaderCookie(c, row.token);
    return c.html(messagePage(await renderContext(c), "You're in!", "Your email is confirmed. New posts will arrive in your inbox.", { label: "Start reading", href: "/" }));
});

publicRoutes.get("/api/unsubscribe", async (c) =>
{
    const site = c.get("site");
    const token = c.req.query("t") ?? "";
    const row = await c.env.DB.prepare("SELECT id FROM subscribers WHERE site_id = ? AND token = ?").bind(site.id, token).first<{ id: string }>();
    const ctx = await renderContext(c);
    if (!row)
    {
        return c.html(messagePage(ctx, "Link not valid", "We couldn't find that subscription."), 400);
    }
    await unsubscribe(c, row.id);
    return c.html(messagePage(ctx, "You're unsubscribed", "You won't get more emails from this blog. You can subscribe again anytime.", { label: "Back to the blog", href: "/" }));
});

// One-click unsubscribe from mail clients (RFC 8058) posts to the same URL.
publicRoutes.post("/api/unsubscribe", async (c) =>
{
    const row = await c.env.DB.prepare("SELECT id FROM subscribers WHERE site_id = ? AND token = ?").bind(c.get("site").id, c.req.query("t") ?? "").first<{ id: string }>();
    if (row)
    {
        await unsubscribe(c, row.id);
    }
    return c.text("Unsubscribed");
});

async function unsubscribe(c: C, subscriberId: string)
{
    await c.env.DB.batch([
        c.env.DB.prepare("UPDATE subscribers SET status = 'unsubscribed', unsubscribed_at = ? WHERE id = ? AND status != 'unsubscribed'").bind(now(), subscriberId),
        c.env.DB.prepare("INSERT INTO member_events (site_id, subscriber_id, type, created_at) VALUES (?, ?, 'unsubscribed', ?)").bind(c.get("site").id, subscriberId, now()),
    ]);
}

// ---------- Reader accounts (magic links) ----------

publicRoutes.post("/api/account/link", async (c) =>
{
    const site = c.get("site");
    const form = await formOrJson(c);
    await verifyTurnstile(c.env, form["cf-turnstile-response"], c.req.header("cf-connecting-ip") ?? null);
    const email = checkEmail(form.email);
    const row = await c.env.DB.prepare("SELECT id FROM subscribers WHERE site_id = ? AND email = ? AND status != 'pending'").bind(site.id, email).first<{ id: string }>();
    const generic = "If that email is subscribed, a sign-in link is on its way.";
    if (!row)
    {
        return reply(c, generic);
    }
    const code = randomHex(24);
    await c.env.CACHE.put(`signin:${await sha256Hex(code)}`, row.id, { expirationTtl: 3600 });
    const link = `${origin(c)}/api/account/verify?c=${code}`;
    const outcome = await sendEmail(c.env, { to: email, ...signInEmail(site, link), fromName: site.title });
    if (!outcome.sent)
    {
        return reply(c, "Email isn't set up on this blog yet, so sign-in links can't be sent. Ask the owner.");
    }
    return reply(c, generic);
});

publicRoutes.get("/api/account/verify", async (c) =>
{
    const key = `signin:${await sha256Hex(c.req.query("c") ?? "")}`;
    const subscriberId = await c.env.CACHE.get(key);
    if (!subscriberId)
    {
        return c.html(messagePage(await renderContext(c), "Link expired", "That sign-in link has expired. Request a new one.", { label: "Sign in", href: "/account" }), 400);
    }
    await c.env.CACHE.delete(key);
    const row = await c.env.DB.prepare("SELECT token FROM subscribers WHERE id = ? AND site_id = ?").bind(subscriberId, c.get("site").id).first<{ token: string }>();
    if (row)
    {
        setReaderCookie(c, row.token);
    }
    return c.redirect("/account", 303);
});

publicRoutes.post("/api/account", async (c) =>
{
    const reader = await loadReader(c);
    if (!reader)
    {
        throw new ApiError(401, "unauthorized", "Sign in first.");
    }
    const form = await formOrJson(c);
    const wantsEmail = form.email_enabled === "1";
    await c.env.DB.prepare("UPDATE subscribers SET name = ?, email_enabled = ?, status = ? WHERE id = ?")
        .bind((form.name ?? "").trim().slice(0, 80), wantsEmail ? 1 : 0, wantsEmail ? "active" : "unsubscribed", reader.id).run();
    return reply(c, "Saved.");
});

// Opens Stripe's billing portal so a paid member can change their card or cancel.
publicRoutes.post("/api/account/billing", async (c) =>
{
    const reader = await loadReader(c);
    if (!reader)
    {
        throw new ApiError(401, "unauthorized", "Sign in first.");
    }
    const url = await createBillingPortal(c.env, c.get("site").id, reader.id, `${origin(c)}/account`);
    if (wantsJson(c))
    {
        return c.json({ ok: true, message: "Opening billing…", redirect: url });
    }
    return c.redirect(url, 303);
});

publicRoutes.post("/api/account/signout", (c) =>
{
    deleteCookie(c, READER_COOKIE, { path: "/", secure: true });
    return c.redirect("/", 303);
});

// ---------- Comments ----------

publicRoutes.post("/api/comments", async (c) =>
{
    const site = c.get("site");
    const mode = site.settings.commentsMode;
    const form = await formOrJson(c);
    await verifyTurnstile(c.env, form["cf-turnstile-response"], c.req.header("cf-connecting-ip") ?? null);
    const reader = await loadReader(c);
    if (mode === "off")
    {
        throw new ApiError(403, "comments_off", "Comments are off.");
    }
    if ((mode === "members" || mode === "paid") && !reader)
    {
        throw new ApiError(401, "members_only", "Sign in as a member to comment.");
    }
    if (mode === "paid" && reader && reader.tier === "free")
    {
        throw new ApiError(403, "paid_only", "Only paid members can comment.");
    }
    const post = await c.env.DB.prepare("SELECT id FROM posts WHERE id = ? AND site_id = ? AND status IN ('published', 'unlisted')").bind(form.post_id ?? "", site.id).first<{ id: string }>();
    if (!post)
    {
        throw new ApiError(404, "not_found", "That post doesn't exist.");
    }
    const body = (form.body ?? "").trim().slice(0, 4000);
    const name = (reader?.name || reader?.email.split("@")[0] || form.name || "").trim().slice(0, 80);
    if (!body || !name)
    {
        throw new ApiError(400, "invalid_request", "Write a comment and your name.");
    }
    // A comment full of links is almost always spam.
    const linkCount = (body.match(/https?:\/\//g) ?? []).length;
    const status = linkCount > 2 ? "spam" : site.settings.commentsModeration && !reader ? "pending" : "approved";
    await c.env.DB.prepare("INSERT INTO comments (id, site_id, post_id, subscriber_id, name, body, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(newId(), site.id, post.id, reader?.id ?? null, name, body, status, now()).run();
    return reply(c, status === "approved" ? "Comment posted. Reload to see it." : "Thanks! Your comment will appear once it's approved.");
});

// ---------- Analytics ----------

async function dailySalt(env: HonoEnv["Bindings"]): Promise<string>
{
    const day = new Date().toISOString().slice(0, 10);
    const key = `salt:${day}`;
    let salt = await env.CACHE.get(key);
    if (!salt)
    {
        salt = randomHex(16);
        await env.CACHE.put(key, salt, { expirationTtl: 2 * 86400 });
    }
    return salt;
}

publicRoutes.post("/api/p", async (c) =>
{
    const userAgent = c.req.header("user-agent") ?? "";
    const device = deviceOf(userAgent);
    if (device === "bot")
    {
        return c.body(null, 204);
    }
    const data = await c.req.json<{ p?: string; r?: string; q?: string; id?: string }>().catch(() => null);
    if (!data?.p)
    {
        return c.body(null, 204);
    }
    const site = c.get("site");
    const host = new URL(c.req.url).hostname;
    let referrer = "";
    try
    {
        referrer = data.r ? new URL(data.r).hostname.replace(/^www\./, "") : "";
    }
    catch
    {
        referrer = "";
    }
    if (referrer === host)
    {
        referrer = "";
    }
    const params = new URLSearchParams(data.q ?? "");
    const ip = c.req.header("cf-connecting-ip") ?? "";
    const visitor = (await sha256Hex(`${await dailySalt(c.env)}|${site.id}|${ip}|${userAgent}`)).slice(0, 16);
    const country = (c.req.raw.cf?.country as string | undefined) ?? "";
    c.executionCtx.waitUntil(
        c.env.DB.prepare("INSERT INTO pageviews (site_id, created_at, path, post_id, visitor, referrer, country, device, utm_source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
            .bind(site.id, now(), data.p.slice(0, 300), data.id ?? null, visitor, referrer.slice(0, 200), country, device, (params.get("utm_source") ?? params.get("ref") ?? "").slice(0, 100))
            .run()
    );
    return c.body(null, 204);
});

const PIXEL = Uint8Array.from(atob("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"), (char) => char.charCodeAt(0));

publicRoutes.get("/api/e/o/:email/:sub", async (c) =>
{
    c.executionCtx.waitUntil(
        c.env.DB.prepare("INSERT INTO email_events (email_id, subscriber_id, type, created_at) SELECT ?, ?, 'open', ? WHERE EXISTS (SELECT 1 FROM emails WHERE id = ? AND site_id = ?)")
            .bind(c.req.param("email"), c.req.param("sub"), now(), c.req.param("email"), c.get("site").id).run()
    );
    return c.body(PIXEL, 200, { "Content-Type": "image/gif", "Cache-Control": "no-store" });
});

publicRoutes.get("/api/e/c/:email/:sub", async (c) =>
{
    const target = c.req.query("u") ?? "/";
    if (!/^https?:\/\//.test(target))
    {
        return c.redirect("/", 302);
    }
    c.executionCtx.waitUntil(
        c.env.DB.prepare("INSERT INTO email_events (email_id, subscriber_id, type, url, created_at) SELECT ?, ?, 'click', ?, ? WHERE EXISTS (SELECT 1 FROM emails WHERE id = ? AND site_id = ?)")
            .bind(c.req.param("email"), c.req.param("sub"), target.slice(0, 500), now(), c.req.param("email"), c.get("site").id).run()
    );
    return c.redirect(target, 302);
});

// ---------- Payments ----------

publicRoutes.post("/api/checkout", async (c) =>
{
    const site = c.get("site");
    if (!getEntitlements(c.env, site).canUsePaidMembers || !site.settings.paidEnabled)
    {
        throw new ApiError(403, "paid_off", "Paid memberships aren't available on this blog.");
    }
    const form = await formOrJson(c);
    const reader = await loadReader(c);
    const email = reader?.email ?? checkEmail(form.email);
    const url = await createCheckout(c.env, site, {
        tierId: form.tier_id ?? "",
        interval: form.interval === "year" ? "year" : "month",
        email,
        origin: origin(c),
        provider: form.provider === "paypal" ? "paypal" : form.provider === "stripe" ? "stripe" : undefined,
    });
    if (wantsJson(c))
    {
        return c.json({ ok: true, message: "Opening checkout…", redirect: url });
    }
    return c.redirect(url, 303);
});

publicRoutes.post("/api/webhooks/stripe/:account", async (c) =>
{
    await handleStripeWebhook(c.env, c.get("site"), c.req.param("account"), c.req.raw);
    return c.json({ received: true });
});

publicRoutes.post("/api/webhooks/paypal/:account", async (c) =>
{
    await handlePayPalWebhook(c.env, c.get("site"), c.req.param("account"), c.req.raw);
    return c.json({ received: true });
});

// ---------- Generated social images ----------

publicRoutes.get("/og/:file{[a-z0-9][a-z0-9-]*\\.png}", async (c) =>
{
    const site = c.get("site");
    const slug = c.req.param("file").replace(/\.png$/, "");
    const poweredBy = !(site.settings.hidePoweredBy && getEntitlements(c.env, site).canHidePoweredBy);
    const requestOrigin = new URL(c.req.url).origin;
    if (slug === "home")
    {
        const card = { title: site.description || site.title, eyebrow: site.title, footer: new URL(origin(c)).host, poweredBy };
        return cachedOgResponse(c.req.raw, cardVersion(site, card.title, card.footer, String(poweredBy)), c.executionCtx, () =>
        {
            return renderOgImage(c.env, requestOrigin, site, card);
        });
    }
    const post = await findBySlug(c.env.DB, site, slug);
    if (!post)
    {
        return c.notFound();
    }
    const date = post.type === "post" ? formatDate({ site } as RenderContext, post.published_at) : "";
    const footer = [post.authors.map((author) => author.name).join(", "), date].filter(Boolean).join("  ·  ");
    const card = { title: post.title, eyebrow: site.title, footer: footer || new URL(origin(c)).host, poweredBy };
    return cachedOgResponse(c.req.raw, cardVersion(site, post.updated_at, card.footer, String(poweredBy)), c.executionCtx, () =>
    {
        return renderOgImage(c.env, requestOrigin, site, card);
    });
});

// ---------- Posts and pages (last, so fixed paths win) ----------

publicRoutes.get("/:slug{[a-z0-9][a-z0-9-]*}", async (c) =>
{
    const ctx = await renderContext(c);
    if (ctx.site.status === "waitlist")
    {
        return c.redirect("/", 302);
    }
    const post = await findBySlug(c.env.DB, ctx.site, c.req.param("slug"));
    if (!post)
    {
        return c.html(notFoundPage(ctx), 404);
    }
    const mode = ctx.site.settings.commentsMode;
    const [related, comments] = await Promise.all([
        post.type === "post" ? relatedPosts(c.env.DB, ctx.site, post) : Promise.resolve([]),
        post.type === "post" && mode !== "off" ? approvedComments(c.env.DB, post.id) : Promise.resolve([]),
    ]);
    let commentsOpen = mode === "all";
    let commentNote = "";
    if (mode === "members")
    {
        commentsOpen = ctx.reader !== null;
        commentNote = "Subscribe or sign in to join the conversation.";
    }
    if (mode === "paid")
    {
        commentsOpen = ctx.reader !== null && ctx.reader.tier !== "free";
        commentNote = "Comments are for paid members.";
    }
    if (!canRead(post, ctx.reader))
    {
        commentsOpen = false;
        commentNote = "Comments are for members who can read this post.";
    }
    return c.html(postPage(ctx, post, { related, comments, commentsOpen, commentNote }));
});

publicRoutes.notFound(async (c) =>
{
    return c.html(notFoundPage(await renderContext(c)), 404);
});
