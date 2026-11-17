export function deviceOf(userAgent: string): "mobile" | "tablet" | "desktop" | "bot"
{
    const ua = userAgent.toLowerCase();
    if (/bot|crawl|spider|slurp|preview|fetch|monitor|headless|lighthouse/.test(ua))
    {
        return "bot";
    }
    if (/ipad|tablet|kindle|silk/.test(ua) || (/android/.test(ua) && !/mobile/.test(ua)))
    {
        return "tablet";
    }
    if (/mobi|iphone|ipod|android/.test(ua))
    {
        return "mobile";
    }
    return "desktop";
}
