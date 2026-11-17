export class ApiError extends Error
{
    constructor(message: string, readonly status: number, readonly code?: string)
    {
        super(message);
    }
}

export const SIGNED_OUT_EVENT = "writestead:signed-out";

type Options = { method?: string; body?: unknown; form?: FormData };

export async function api<T>(path: string, options: Options = {}): Promise<T>
{
    const hasJson = options.body !== undefined;
    const response = await fetch(`/api${path}`, {
        method: options.method ?? (hasJson || options.form ? "POST" : "GET"),
        headers: hasJson ? { "Content-Type": "application/json" } : undefined,
        body: options.form ?? (hasJson ? JSON.stringify(options.body) : undefined),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok)
    {
        if (response.status === 401 && !path.startsWith("/auth/"))
        {
            window.dispatchEvent(new Event(SIGNED_OUT_EVENT));
        }
        throw new ApiError(data.error ?? `Request failed (${response.status})`, response.status, data.code);
    }
    return data as T;
}

export function errorMessage(error: unknown): string
{
    return error instanceof Error ? error.message : "Something went wrong.";
}
