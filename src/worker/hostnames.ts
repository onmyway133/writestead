import type { AppEnv } from "./env";

// Hosted version only: a blog's custom domain becomes a Cloudflare for SaaS custom hostname on the
// root zone, so Cloudflare issues its certificate and routes it to this Worker (route */*).
// Needs CF_API_TOKEN (SSL and Certificates: Edit) and CF_ZONE_ID. Without them, domains are saved
// and an operator adds the hostname by hand.

export type HostnameStatus = { status: string; ssl: string; records: { type: string; name: string; value: string }[] };

type CloudflareResult<T> = { success: boolean; errors: { message: string }[]; result: T };

type CustomHostname = {
    id: string;
    status: string;
    ssl?: { status?: string; validation_records?: { txt_name?: string; txt_value?: string; http_url?: string; http_body?: string }[] };
    ownership_verification?: { type?: string; name?: string; value?: string };
};

export function hostnamesEnabled(env: AppEnv): boolean
{
    return Boolean(env.CF_API_TOKEN && env.CF_ZONE_ID);
}

async function cloudflare<T>(env: AppEnv, method: string, path: string, body?: unknown): Promise<T>
{
    const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${env.CF_ZONE_ID}/custom_hostnames${path}`, {
        method,
        headers: { Authorization: `Bearer ${env.CF_API_TOKEN}`, "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
    });
    const data = await response.json<CloudflareResult<T>>();
    if (!data.success)
    {
        throw new Error(data.errors.map((error) => error.message).join("; ") || `Cloudflare API ${response.status}`);
    }
    return data.result;
}

export async function createHostname(env: AppEnv, hostname: string): Promise<string>
{
    const result = await cloudflare<CustomHostname>(env, "POST", "", { hostname, ssl: { method: "http", type: "dv" } });
    return result.id;
}

export async function deleteHostname(env: AppEnv, id: string): Promise<void>
{
    await cloudflare(env, "DELETE", `/${id}`);
}

export async function hostnameStatus(env: AppEnv, id: string): Promise<HostnameStatus>
{
    const result = await cloudflare<CustomHostname>(env, "GET", `/${id}`);
    const records: HostnameStatus["records"] = [];
    if (result.ownership_verification?.name && result.ownership_verification.value)
    {
        records.push({ type: (result.ownership_verification.type ?? "txt").toUpperCase(), name: result.ownership_verification.name, value: result.ownership_verification.value });
    }
    for (const record of result.ssl?.validation_records ?? [])
    {
        if (record.txt_name && record.txt_value)
        {
            records.push({ type: "TXT", name: record.txt_name, value: record.txt_value });
        }
    }
    return { status: result.status, ssl: result.ssl?.status ?? "", records };
}
