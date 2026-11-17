import type { AppEnv } from "../env";
import { ApiError } from "./http";

// Checks a Turnstile token when both keys are configured. Without keys, forms stay open.
export async function verifyTurnstile(env: AppEnv, token: string | null | undefined, ip: string | null): Promise<void>
{
    if (!env.TURNSTILE_SECRET_KEY || !env.TURNSTILE_SITE_KEY)
    {
        return;
    }
    const body = new FormData();
    body.append("secret", env.TURNSTILE_SECRET_KEY);
    body.append("response", token ?? "");
    if (ip)
    {
        body.append("remoteip", ip);
    }
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body });
    const result = await response.json<{ success: boolean }>().catch(() => ({ success: false }));
    if (!result.success)
    {
        throw new ApiError(403, "bot_check_failed", "The bot check failed. Reload the page and try again.");
    }
}
