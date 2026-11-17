import type { AppEnv } from "./env";

// Uploaded files live in R2. When an install has no R2 bucket bound (R2 isn't enabled on the
// account yet), they go to KV instead, which holds values up to 25 MB. Reads check both, so
// switching to R2 later keeps older files working.

const KV_PREFIX = "media:";

export async function putMedia(env: AppEnv, key: string, body: ArrayBuffer | ReadableStream, contentType: string): Promise<void>
{
    if (env.MEDIA)
    {
        await env.MEDIA.put(key, body, { httpMetadata: { contentType } });
        return;
    }
    const bytes = body instanceof ArrayBuffer ? body : await new Response(body).arrayBuffer();
    await env.CACHE.put(KV_PREFIX + key, bytes, { metadata: { contentType } });
}

export async function getMedia(env: AppEnv, key: string): Promise<Response | null>
{
    const headers = new Headers({ "Cache-Control": "public, max-age=31536000, immutable" });
    const object = env.MEDIA ? await env.MEDIA.get(key) : null;
    if (object)
    {
        object.writeHttpMetadata(headers);
        headers.set("ETag", object.httpEtag);
        return new Response(object.body, { headers });
    }
    const stored = await env.CACHE.getWithMetadata<{ contentType: string }>(KV_PREFIX + key, "stream");
    if (!stored.value)
    {
        return null;
    }
    headers.set("Content-Type", stored.metadata?.contentType ?? "application/octet-stream");
    return new Response(stored.value, { headers });
}

export async function deleteMedia(env: AppEnv, key: string): Promise<void>
{
    await Promise.all([env.MEDIA?.delete(key), env.CACHE.delete(KV_PREFIX + key)]);
}
