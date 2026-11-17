import type { AppEnv } from "./env";
import { toHex } from "./lib/crypto";

export const WEBHOOK_EVENTS = ["post.published", "post.updated", "post.deleted", "subscriber.created", "subscriber.deleted"] as const;

// Posts the event to every matching endpoint, signed with HMAC-SHA256 of the body.
export async function fireWebhooks(env: AppEnv, siteId: string, event: string, data: unknown): Promise<void>
{
    const { results } = await env.DB.prepare("SELECT url, secret FROM webhooks WHERE site_id = ? AND event = ?").bind(siteId, event).all<{ url: string; secret: string }>();
    const body = JSON.stringify({ event, created_at: Math.floor(Date.now() / 1000), data });
    await Promise.all(results.map(async (hook) =>
    {
        const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(hook.secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
        const signature = toHex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)));
        await fetch(hook.url, { method: "POST", headers: { "Content-Type": "application/json", "X-Writestead-Signature": signature }, body })
            .catch((error) =>
            {
                console.error("Webhook failed", hook.url, error);
            });
    }));
}
