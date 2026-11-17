export function formatDate(seconds: number | null | undefined, withTime = false): string
{
    if (!seconds)
    {
        return "";
    }
    return new Intl.DateTimeFormat(undefined, withTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" }).format(new Date(seconds * 1000));
}

export function timeAgo(seconds: number): string
{
    const diff = Math.round(Date.now() / 1000 - seconds);
    const format = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
    if (Math.abs(diff) < 60)
    {
        return "just now";
    }
    if (Math.abs(diff) < 3600)
    {
        return format.format(-Math.round(diff / 60), "minute");
    }
    if (Math.abs(diff) < 86400)
    {
        return format.format(-Math.round(diff / 3600), "hour");
    }
    if (Math.abs(diff) < 86400 * 30)
    {
        return format.format(-Math.round(diff / 86400), "day");
    }
    return formatDate(seconds);
}

export function number(value: number | null | undefined): string
{
    return new Intl.NumberFormat().format(value ?? 0);
}

export function percent(value: number): string
{
    return `${(value * 100).toFixed(1)}%`;
}

export function money(minor: number, currency = "usd"): string
{
    return new Intl.NumberFormat(undefined, { style: "currency", currency: currency.toUpperCase() }).format(minor / 100);
}

export function change(current: number, previous: number): number | null
{
    if (!previous)
    {
        return null;
    }
    return (current - previous) / previous;
}
