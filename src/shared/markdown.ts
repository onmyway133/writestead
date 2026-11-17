import hljs from "highlight.js/lib/common";
import { Marked } from "marked";

// Posts are Markdown. Raw HTML is allowed because only staff write posts, like most blog engines.
// This module has no Worker or DOM APIs so the editor preview and the blog render the same way.

export const PAYWALL_MARKER = "<!--paywall-->";

const marked = new Marked({
    gfm: true,
    breaks: false,
    renderer: {
        code({ text, lang })
        {
            const language = (lang ?? "").split(/\s/)[0];
            const highlighted = language && hljs.getLanguage(language)
                ? hljs.highlight(text, { language }).value
                : hljs.highlightAuto(text).value;
            const label = language ? `<span class="code-lang">${escapeHtml(language)}</span>` : "";
            return `<pre class="code">${label}<code class="hljs">${highlighted}</code></pre>\n`;
        },
        image({ href, title, text })
        {
            const caption = title ? `<figcaption>${escapeHtml(title)}</figcaption>` : "";
            return `<figure><img src="${escapeAttr(href)}" alt="${escapeAttr(text)}" loading="lazy" decoding="async">${caption}</figure>`;
        },
    },
});

export function escapeHtml(value: string): string
{
    return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

function escapeAttr(value: string): string
{
    return escapeHtml(value);
}

// A URL alone on its own line becomes an embed when we know the provider.
export function embedFor(url: string): string | null
{
    let parsed: URL;
    try
    {
        parsed = new URL(url);
    }
    catch
    {
        return null;
    }
    const host = parsed.hostname.replace(/^www\./, "");
    if (host === "youtube.com" || host === "youtu.be" || host === "m.youtube.com")
    {
        const id = host === "youtu.be" ? parsed.pathname.slice(1) : parsed.searchParams.get("v") ?? parsed.pathname.split("/shorts/")[1];
        if (id && /^[\w-]{6,20}$/.test(id))
        {
            return `<div class="embed embed-video"><iframe src="https://www.youtube-nocookie.com/embed/${id}" title="YouTube video" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen></iframe></div>`;
        }
    }
    if (host === "vimeo.com")
    {
        const id = parsed.pathname.split("/").filter(Boolean)[0];
        if (id && /^\d+$/.test(id))
        {
            return `<div class="embed embed-video"><iframe src="https://player.vimeo.com/video/${id}" title="Vimeo video" loading="lazy" allow="fullscreen; picture-in-picture" allowfullscreen></iframe></div>`;
        }
    }
    if ((host === "x.com" || host === "twitter.com") && /^\/\w+\/status\/\d+/.test(parsed.pathname))
    {
        const link = `https://twitter.com${parsed.pathname}`;
        return `<div class="embed embed-tweet"><blockquote class="twitter-tweet"><a href="${escapeAttr(link)}">View post on X</a></blockquote><script async src="https://platform.twitter.com/widgets.js"></script></div>`;
    }
    if (host === "codepen.io")
    {
        const match = parsed.pathname.match(/^\/([\w-]+)\/(?:pen|full)\/([\w-]+)/);
        if (match)
        {
            return `<div class="embed embed-code"><iframe src="https://codepen.io/${match[1]}/embed/${match[2]}?default-tab=result" title="CodePen" loading="lazy" allowfullscreen></iframe></div>`;
        }
    }
    if (host === "gist.github.com")
    {
        const match = parsed.pathname.match(/^\/([\w-]+)\/([0-9a-f]+)\/?$/);
        if (match)
        {
            return `<div class="embed embed-gist"><script src="https://gist.github.com/${match[1]}/${match[2]}.js"></script></div>`;
        }
    }
    return null;
}

function expandEmbeds(markdown: string): string
{
    let inFence = false;
    return markdown.split("\n").map((line) =>
    {
        if (/^\s*(```|~~~)/.test(line))
        {
            inFence = !inFence;
            return line;
        }
        const trimmed = line.trim();
        if (inFence || !/^https?:\/\/\S+$/.test(trimmed))
        {
            return line;
        }
        const embed = embedFor(trimmed);
        return embed ? `\n${embed}\n` : line;
    }).join("\n");
}

export function renderMarkdown(markdown: string): string
{
    return marked.parse(expandEmbeds(markdown), { async: false });
}

// Splits a post at the paywall marker. Without a marker, gated posts show only the excerpt.
export function splitPaywall(markdown: string): { preview: string; hasMarker: boolean }
{
    const index = markdown.indexOf(PAYWALL_MARKER);
    if (index === -1)
    {
        return { preview: "", hasMarker: false };
    }
    return { preview: markdown.slice(0, index), hasMarker: true };
}
