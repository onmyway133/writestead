const encoder = new TextEncoder();

export function toHex(bytes: ArrayBuffer | Uint8Array): string
{
    return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function randomHex(byteCount: number): string
{
    return toHex(crypto.getRandomValues(new Uint8Array(byteCount)));
}

export async function sha256Hex(value: string): Promise<string>
{
    return toHex(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
}

// Workers caps PBKDF2 at 100,000 iterations.
export async function hashPassword(password: string, salt: string): Promise<string>
{
    const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, [
        "deriveBits",
    ]);
    const bits = await crypto.subtle.deriveBits(
        { name: "PBKDF2", hash: "SHA-256", salt: encoder.encode(salt), iterations: 100_000 },
        key,
        256
    );
    return toHex(bits);
}

export function timingSafeEqual(a: string, b: string): boolean
{
    if (a.length !== b.length)
    {
        return false;
    }
    let difference = 0;
    for (let index = 0; index < a.length; index++)
    {
        difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
    }
    return difference === 0;
}
