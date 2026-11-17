import type { SiteWithSettings } from "../shared/types";
import { newsletterEmail, type NewsletterJob, type NewsletterPost, queueNewsletter, type Recipient, sendEmail } from "./email";
import type { AppEnv } from "./env";
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
    for (const recipient of results)
    {
        const message = newsletterEmail(env, site, post, job.emailId, recipient);
        const outcome = await sendEmail(env, { to: recipient.email, ...message, fromName: site.settings.newsletterName || site.title });
        if (outcome.sent)
        {
            delivered++;
        }
        else
        {
            failed++;
        }
    }
    await env.DB.prepare(
        `UPDATE emails SET delivered = delivered + ?, failed = failed + ?,
         status = CASE WHEN delivered + ? + failed + ? >= recipients THEN CASE WHEN delivered + ? = 0 THEN 'failed' ELSE 'sent' END ELSE status END WHERE id = ?`
    ).bind(delivered, failed, delivered, failed, delivered, job.emailId).run();
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
            await queueNewsletter(env, site, post, post.email_segment || "all");
        }
        await fireWebhooks(env, site.id, "post.published", { id: post.id, title: post.title, slug: post.slug });
    }
    // Keep raw page views for 13 months; older rows only cost space.
    await env.DB.prepare("DELETE FROM pageviews WHERE created_at < ?").bind(now() - 400 * 86400).run();
}
