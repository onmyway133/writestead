import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";

// Errors carry a stable code the app can switch on, plus a sentence a person can read.
export class ApiError extends HTTPException
{
    constructor(status: 400 | 401 | 402 | 403 | 404 | 409 | 413 | 429 | 500 | 503, readonly code: string, message: string)
    {
        super(status, { message });
    }
}

export function badRequest(message: string, code = "invalid_request"): ApiError
{
    return new ApiError(400, code, message);
}

export function forbidden(message = "You don't have access to do that."): ApiError
{
    return new ApiError(403, "forbidden", message);
}

export function notFound(message = "Not found."): ApiError
{
    return new ApiError(404, "not_found", message);
}

export function errorResponse(error: Error, c: Context)
{
    if (error instanceof ApiError)
    {
        return c.json({ error: error.message, code: error.code }, error.status);
    }
    if (error instanceof HTTPException)
    {
        return c.json({ error: error.message, code: "http_error" }, error.status);
    }
    console.error(error);
    return c.json({ error: "Something went wrong. Try again.", code: "internal" }, 500);
}

// Reads a JSON body, treating a missing or broken body as an empty object.
export async function readJson<T extends object>(c: Context): Promise<Partial<T>>
{
    const body = await c.req.json().catch(() => ({}));
    return body !== null && typeof body === "object" ? (body as Partial<T>) : {};
}

export function text(value: unknown, { max = 500, field = "Value" }: { max?: number; field?: string } = {}): string
{
    if (typeof value !== "string")
    {
        return "";
    }
    const trimmed = value.trim();
    if (trimmed.length > max)
    {
        throw badRequest(`${field} is too long (at most ${max} characters).`);
    }
    return trimmed;
}

export function now(): number
{
    return Math.floor(Date.now() / 1000);
}

export function newId(): string
{
    return crypto.randomUUID().replaceAll("-", "");
}
