import { escapeHtml, renderMarkdown, splitPaywall } from "../shared/markdown";
import type { SiteWithSettings } from "../shared/types";
import { type AppEnv, getEntitlements, siteUrl } from "./env";
import { ApiError, newId, now } from "./lib/http";

export type EmailOutcome = { sent: true } | { sent: false; reason: string | null };

export function emailConfigured(env: AppEnv): boolean
{
    return Boolean(env.EMAIL_FROM?.trim());
}

// Sends through the Cloudflare Email Service binding when EMAIL_FROM is set. Without it, callers
// fall back to showing links on screen, so a failure is reported, not thrown.
export async function sendEmail(env: AppEnv, message: { to: string; subject: string; text: string; html: string; fromName?: string }): Promise<EmailOutcome>
{
    const configured = env.EMAIL_FROM?.trim();
    if (!configured)
    {
        return { sent: false, reason: null };
    }
    // Keep the verified address but show the blog's name as the sender.
    const address = configured.match(/<([^>]+)>/)?.[1] ?? configured;
    const from = message.fromName ? `${message.fromName.replace(/[<>"]/g, "")} <${address}>` : configured;
    try
    {
        await env.EMAIL.send({ from, to: message.to, subject: message.subject, text: message.text, html: message.html });
        return { sent: true };
    }
    catch (error)
    {
        console.error("Email send failed", (error as { code?: string }).code ?? "", error);
        return { sent: false, reason: "The email couldn't be sent." };
    }
}

function shell(site: SiteWithSettings, accent: string, inner: string, footer: string): string
{
    return `<!doctype html><html><head><meta name="viewport" content="width=device-width"><meta charset="utf-8"></head>
<body style="margin:0;padding:32px 12px;background:#f5f4fa;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1c1a2e">
<div style="max-width:600px;margin:0 auto">
<p style="margin:0 0 16px;font-size:14px;font-weight:700;color:${accent}">${escapeHtml(site.settings.newsletterName || site.title)}</p>
<div style="background:#ffffff;border-radius:16px;padding:32px 28px;font-size:16px;line-height:1.65">${inner}</div>
<div style="padding:20px 8px;font-size:12px;line-height:1.6;color:#8a87a0;text-align:center">${footer}</div>
</div></body></html>`;
}

function button(href: string, label: string, accent: string): string
{
    return `<a href="${escapeHtml(href)}" style="display:inline-block;background:${accent};color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:10px">${escapeHtml(label)}</a>`;
}

function accentOf(site: SiteWithSettings): string
{
    return /^#[0-9a-f]{3,8}$/i.test(site.settings.accent) ? site.settings.accent : "#6d4aff";
}

export function confirmEmail(site: SiteWithSettings, link: string, waitlist: boolean)
{
    const accent = accentOf(site);
    const subject = waitlist ? `Confirm your spot on the ${site.title} waitlist` : `Confirm your subscription to ${site.title}`;
    const inner = `<h1 style="margin:0 0 12px;font-size:22px">Confirm your email</h1>
<p style="margin:0 0 24px;color:#55526b">Tap the button to confirm ${waitlist ? "your spot on the waitlist" : "your subscription"}. If you didn't sign up, ignore this email.</p>
${button(link, "Confirm my email", accent)}`;
    return { subject, html: shell(site, accent, inner, ""), text: `Confirm your email for ${site.title}: ${link}` };
}

export function signInEmail(site: SiteWithSettings, link: string)
{
    const accent = accentOf(site);
    const inner = `<h1 style="margin:0 0 12px;font-size:22px">Sign in to ${escapeHtml(site.title)}</h1>
<p style="margin:0 0 24px;color:#55526b">Tap the button to sign in. The link works for one hour.</p>${button(link, "Sign in", accent)}`;
    return { subject: `Your sign-in link for ${site.title}`, html: shell(site, accent, inner, ""), text: `Sign in to ${site.title}: ${link}` };
}

export function welcomeEmail(site: SiteWithSettings, accountLink: string)
{
    const accent = accentOf(site);
    const welcome = site.settings.welcomeEmail;
    const inner = `<h1 style="margin:0 0 12px;font-size:22px">${escapeHtml(welcome.subject)}</h1>
<div style="color:#3b3852">${renderMarkdown(welcome.body)}</div>`;
    const footer = `<a href="${escapeHtml(accountLink)}" style="color:#8a87a0">Manage your subscription</a>`;
    return { subject: welcome.subject, html: shell(site, accent, inner, footer), text: `${welcome.subject}\n\n${welcome.body}\n\nManage your subscription: ${accountLink}` };
}

export function followUpEmail(site: SiteWithSettings, step: { subject: string; body: string }, unsubscribeLink: string)
{
    const accent = accentOf(site);
    const inner = `<h1 style="margin:0 0 12px;font-size:22px">${escapeHtml(step.subject)}</h1><div style="color:#3b3852">${renderMarkdown(step.body)}</div>`;
    const footer = `<a href="${escapeHtml(unsubscribeLink)}" style="color:#8a87a0">Unsubscribe</a>`;
    return { subject: step.subject, html: shell(site, accent, inner, footer), text: `${step.body}\n\nUnsubscribe: ${unsubscribeLink}` };
}

export type NewsletterPost = { id: string; title: string; slug: string; excerpt: string; content: string; cover_image: string; visibility: string };
export type Recipient = { id: string; email: string; name: string; tier: string; token: string };

// Builds one subscriber's copy: tracked links, an open pixel and their own unsubscribe link.
export function newsletterEmail(env: AppEnv, site: SiteWithSettings, post: NewsletterPost, emailId: string, recipient: Recipient)
{
    const origin = siteUrl(env, site);
    const accent = accentOf(site);
    const postUrl = `${origin}/${post.slug}`;
    const canRead = post.visibility === "public"
        || (post.visibility === "members")
        || recipient.tier === "paid" || recipient.tier === "comp";
    let body: string;
    if (canRead)
    {
        body = renderMarkdown(post.content.replace("<!--paywall-->", ""));
    }
    else
    {
        const { preview, hasMarker } = splitPaywall(post.content);
        body = (hasMarker ? renderMarkdown(preview) : `<p>${escapeHtml(post.excerpt)}</p>`)
            + `<div style="margin:28px 0 0;padding:24px;border-radius:12px;background:#f5f4fa;text-align:center"><p style="margin:0 0 16px;font-weight:600">The rest of this post is for paid members</p>${button(`${origin}/subscribe?plan=paid`, "Upgrade to read", accent)}</div>`;
    }
    const track = (url: string) => `${origin}/api/e/c/${emailId}/${recipient.id}?u=${encodeURIComponent(url)}`;
    body = body.replace(/href="(https?:\/\/[^"]+)"/g, (_match, url: string) => `href="${track(url.replaceAll("&amp;", "&"))}"`);
    const inner = `${post.cover_image ? `<img src="${escapeHtml(post.cover_image.startsWith("http") ? post.cover_image : origin + post.cover_image)}" alt="" style="width:100%;border-radius:10px;margin:0 0 20px">` : ""}
<h1 style="margin:0 0 8px;font-size:26px;line-height:1.25"><a href="${escapeHtml(track(postUrl))}" style="color:#1c1a2e;text-decoration:none">${escapeHtml(post.title)}</a></h1>
${post.excerpt ? `<p style="margin:0 0 20px;color:#6b6883">${escapeHtml(post.excerpt)}</p>` : ""}
<div class="content">${body.replace(/<img /g, '<img style="max-width:100%;height:auto;border-radius:8px" ').replace(/<pre /g, '<pre style="background:#17151f;color:#eee;padding:14px;border-radius:8px;overflow:auto;font-size:13px" ')}</div>
<p style="margin:28px 0 0">${button(track(postUrl), "Read on the web", accent)}</p>
<img src="${origin}/api/e/o/${emailId}/${recipient.id}" width="1" height="1" alt="" style="display:block;border:0">`;
    const footer = `${site.settings.newsletterFooter ? `${escapeHtml(site.settings.newsletterFooter)}<br>` : ""}
You get this because you subscribed to ${escapeHtml(site.title)}.<br>
<a href="${origin}/api/unsubscribe?t=${recipient.token}" style="color:#8a87a0">Unsubscribe</a> · <a href="${origin}/account" style="color:#8a87a0">Email preferences</a>`;
    return {
        subject: post.title,
        html: shell(site, accent, inner, footer),
        text: `${post.title}\n\n${post.excerpt}\n\nRead it: ${postUrl}\n\nUnsubscribe: ${origin}/api/unsubscribe?t=${recipient.token}`,
    };
}

export type NewsletterJob = { kind: "newsletter"; siteId: string; emailId: string; postId: string; subscriberIds: string[] };

const SEGMENT_SQL: Record<string, string> = {
    all: "",
    free: "AND tier = 'free'",
    paid: "AND tier IN ('paid', 'comp')",
};

// Creates the send record and queues subscribers in chunks; the queue consumer does the sending.
export async function queueNewsletter(env: AppEnv, site: SiteWithSettings, post: { id: string; title: string }, segment: string): Promise<{ emailId: string; recipients: number }>
{
    let filter = SEGMENT_SQL[segment] ?? "";
    const binds: unknown[] = [site.id];
    if (segment.startsWith("label:"))
    {
        filter = "AND (',' || labels || ',') LIKE ?";
        binds.push(`%,${segment.slice(6)},%`);
    }
    const { results } = await env.DB
        .prepare(`SELECT id FROM subscribers WHERE site_id = ? AND status = 'active' AND email_enabled = 1 ${filter}`)
        .bind(...binds)
        .all<{ id: string }>();
    // Plans cap emails per calendar month; a send that would cross the cap is refused whole.
    const monthStart = Math.floor(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1) / 1000);
    const used = await env.DB.prepare("SELECT COALESCE(SUM(recipients), 0) AS n FROM emails WHERE site_id = ? AND created_at >= ?").bind(site.id, monthStart).first<{ n: number }>();
    const limit = getEntitlements(env, site).monthlyEmailLimit;
    if ((used?.n ?? 0) + results.length > limit)
    {
        throw new ApiError(402, "email_limit", `This send needs ${results.length} emails, but only ${Math.max(0, limit - (used?.n ?? 0))} are left this month on your plan.`);
    }
    const emailId = newId();
    await env.DB.batch([
        env.DB.prepare("INSERT INTO emails (id, site_id, post_id, subject, segment, status, recipients, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
            .bind(emailId, site.id, post.id, post.title, segment, results.length === 0 ? "sent" : "sending", results.length, now()),
        env.DB.prepare("UPDATE posts SET emailed_at = ? WHERE id = ?").bind(now(), post.id),
    ]);
    const chunks: NewsletterJob[] = [];
    for (let index = 0; index < results.length; index += 50)
    {
        chunks.push({ kind: "newsletter", siteId: site.id, emailId, postId: post.id, subscriberIds: results.slice(index, index + 50).map((row) => row.id) });
    }
    // sendBatch takes at most 100 messages per call.
    for (let index = 0; index < chunks.length; index += 100)
    {
        await env.EMAIL_QUEUE.sendBatch(chunks.slice(index, index + 100).map((body) => ({ body })));
    }
    return { emailId, recipients: results.length };
}
