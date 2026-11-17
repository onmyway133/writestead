import type { SiteWithSettings } from "../shared/types";
import { emailConfigured, followUpEmail, newsletterEmail, type NewsletterJob, type NewsletterPost, queueNewsletter, type Recipient, sendEmail } from "./email";
import { type AppEnv, siteUrl } from "./env";
import { now } from "./lib/http";
import { loadSite } from "./site";
import { fireWebhooks } from "./webhooks";

// Queue consumer: sends one chunk of a newsletter. Counters update once per chunk.
export async function sendNewsletterChunk(env: AppEnv, job: NewsletterJob): Promise<void>
{
    const site = await loadSite(env, job.siteId);
    const post = await env.DB.prepare("SELECT id, title, slug, excerpt, content, cover_image, visibility FROM posts WHERE id = ? AND site_id = ?").bind(job.postId, job.siteId).first<NewsletterPost>();
    if (!site || !post)
    {
        return;
    }
    const marks = job.subscriberIds.map(() => "?").join(",");
    const { results } = await env.DB
        .prepare(`SELECT id, email, name, tier, token FROM subscribers WHERE site_id = ? AND id IN (${marks}) AND status = 'active' AND email_enabled = 1`)
        .bind(job.siteId, ...job.subscriberIds)
        .all<Recipient>();
    let delivered = 0;
    let failed = 0;
    const failedIds: string[] = [];
    const deliveredIds: string[] = [];
    for (const recipient of results)
    {
        const message = newsletterEmail(env, site, post, job.emailId, recipient);
        const outcome = await sendEmail(env, { to: recipient.email, ...message, fromName: site.settings.newsletterName || site.title });
        if (outcome.sent)
        {
            delivered++;
            deliveredIds.push(recipient.id);
        }
        else
        {
            failed++;
            failedIds.push(recipient.id);
        }
    }
    await trackBounces(env, deliveredIds, failedIds);
    await env.DB.prepare(
        `UPDATE emails SET delivered = delivered + ?, failed = failed + ?,
         status = CASE WHEN delivered + ? + failed + ? >= recipients THEN CASE WHEN delivered + ? = 0 THEN 'failed' ELSE 'sent' END ELSE status END WHERE id = ?`
    ).bind(delivered, failed, delivered, failed, delivered, job.emailId).run();
}

// A failure only counts against a subscriber when other emails in the same chunk went out;
// if everything failed, the problem is the sending setup, not the addresses.
async function trackBounces(env: AppEnv, deliveredIds: string[], failedIds: string[]): Promise<void>
{
    const statements: D1PreparedStatement[] = [];
    if (deliveredIds.length > 0)
    {
        statements.push(env.DB.prepare(`UPDATE subscribers SET failed_sends = 0 WHERE failed_sends > 0 AND id IN (${deliveredIds.map(() => "?").join(",")})`).bind(...deliveredIds));
        if (failedIds.length > 0)
        {
            const marks = failedIds.map(() => "?").join(",");
            statements.push(env.DB.prepare(`UPDATE subscribers SET failed_sends = failed_sends + 1 WHERE id IN (${marks})`).bind(...failedIds));
            statements.push(env.DB.prepare(`UPDATE subscribers SET status = 'bounced' WHERE failed_sends >= 3 AND status = 'active' AND id IN (${marks})`).bind(...failedIds));
        }
    }
    if (statements.length > 0)
    {
        await env.DB.batch(statements);
    }
}

// Cron: sends follow-up emails that are due. Only people who confirmed within a week of the due
// date get one, so turning on a new step doesn't email the whole existing list.
export async function sendFollowUps(env: AppEnv): Promise<void>
{
    if (!emailConfigured(env))
    {
        return;
    }
    const { results: sites } = await env.DB.prepare("SELECT id FROM sites WHERE settings LIKE '%\"followUps\":[{%'").all<{ id: string }>();
    let budget = 40;
    for (const { id } of sites)
    {
        const site = await loadSite(env, id);
        if (!site)
        {
            continue;
        }
        for (const step of site.settings.followUps.filter((item) => item.enabled && item.subject && item.delayDays > 0))
        {
            if (budget <= 0)
            {
                return;
            }
            const due = now() - step.delayDays * 86400;
            const { results } = await env.DB.prepare(
                `SELECT id, email, name, tier, token FROM subscribers s WHERE site_id = ? AND status = 'active' AND email_enabled = 1
                 AND confirmed_at <= ? AND confirmed_at > ? AND NOT EXISTS (SELECT 1 FROM automation_sends a WHERE a.subscriber_id = s.id AND a.step = ?) LIMIT ?`
            ).bind(site.id, due, due - 7 * 86400, step.id, budget).all<Recipient>();
            for (const recipient of results)
            {
                budget--;
                // Record first, so a crash mid-send never emails the same step twice.
                await env.DB.prepare("INSERT OR IGNORE INTO automation_sends (subscriber_id, step, created_at) VALUES (?, ?, ?)").bind(recipient.id, step.id, now()).run();
                await sendEmail(env, { to: recipient.email, ...followUpEmail(site, step, `${siteUrl(env, site)}/api/unsubscribe?t=${recipient.token}`), fromName: site.settings.newsletterName || site.title });
            }
        }
    }
}

// Cron: publishes due scheduled posts and emails the ones marked for email.
export async function publishScheduled(env: AppEnv): Promise<void>
{
    const { results } = await env.DB
        .prepare("SELECT id, site_id, title, slug, delivery, email_segment, emailed_at FROM posts WHERE status = 'scheduled' AND published_at <= ? LIMIT 100")
        .bind(now())
        .all<{ id: string; site_id: string; title: string; slug: string; delivery: string; email_segment: string; emailed_at: number | null }>();
    const sites = new Map<string, SiteWithSettings | null>();
    for (const post of results)
    {
        await env.DB.prepare("UPDATE posts SET status = 'published', updated_at = ? WHERE id = ? AND status = 'scheduled'").bind(now(), post.id).run();
        if (!sites.has(post.site_id))
        {
            sites.set(post.site_id, await loadSite(env, post.site_id));
        }
        const site = sites.get(post.site_id);
        if (!site)
        {
            continue;
        }
        if (post.delivery !== "web" && !post.emailed_at)
        {
            await queueNewsletter(env, site, post, post.email_segment || "all").catch((error) =>
            {
                // Over the monthly limit: the post is still published, only the email is skipped.
                console.error("Scheduled newsletter not sent", post.id, error);
            });
        }
        await fireWebhooks(env, site.id, "post.published", { id: post.id, title: post.title, slug: post.slug });
    }
    // Keep raw page views for 13 months; older rows only cost space.
    await env.DB.prepare("DELETE FROM pageviews WHERE created_at < ?").bind(now() - 400 * 86400).run();
}
