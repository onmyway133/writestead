import { api } from "../../lib/api";

export async function uploadMedia(file: File): Promise<string>
{
    const form = new FormData();
    form.append("file", file);
    const result = await api<{ url: string }>("/admin/media", { form });
    return result.url;
}

// Seconds since epoch to the value a datetime-local input wants, in local time.
export function toLocalInput(seconds: number | null): string
{
    if (!seconds)
    {
        return "";
    }
    const date = new Date(seconds * 1000);
    const pad = (value: number) => String(value).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function fromLocalInput(value: string): number | null
{
    if (!value)
    {
        return null;
    }
    const time = new Date(value).getTime();
    return Number.isFinite(time) ? Math.floor(time / 1000) : null;
}
