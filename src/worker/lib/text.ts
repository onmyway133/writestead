export function slugify(value: string): string
{
    return value
        .normalize("NFKD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80) || "untitled";
}

export function stripMarkdown(markdown: string): string
{
    return markdown
        .replace(/```[\s\S]*?```/g, " ")
        .replace(/<!--[\s\S]*?-->/g, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
        .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
        .replace(/[#>*_`~|-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

// Only the part before the paywall marker, so an excerpt never leaks paid content.
export function excerptOf(markdown: string, length = 180): string
{
    const plain = stripMarkdown(markdown.split("<!--paywall-->")[0].replace(/^https?:\/\/\S+$/gm, ""));
    if (plain.length <= length)
    {
        return plain;
    }
    return plain.slice(0, length).replace(/\s+\S*$/, "") + "…";
}

export function readingMinutes(markdown: string): number
{
    const words = stripMarkdown(markdown).split(" ").filter(Boolean).length;
    return Math.max(1, Math.round(words / 230));
}

export function escapeXml(value: string): string
{
    return value.replace(/[<>&'"]/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[char]!);
}
