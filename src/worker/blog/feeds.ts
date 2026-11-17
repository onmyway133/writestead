import { renderMarkdown, splitPaywall } from "../../shared/markdown";
import type { SiteWithSettings } from "../../shared/types";
import { escapeXml } from "../lib/text";
import type { PublicPost } from "./data";

// Feeds carry full text for public posts and only the preview for gated ones.
function feedHtml(post: PublicPost): string
{
    if (post.visibility === "public")
    {
        return renderMarkdown(post.content.replace("<!--paywall-->", ""));
    }
    const { preview, hasMarker } = splitPaywall(post.content);
    return (hasMarker ? renderMarkdown(preview) : `<p>${escapeXml(post.excerpt)}</p>`) + "<p><em>Read the full post on the website.</em></p>";
}

export function rss(site: SiteWithSettings, origin: string, posts: PublicPost[]): string
{
    const items = posts.map((post) => `
    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${origin}/${post.slug}</link>
      <guid isPermaLink="false">${post.id}</guid>
      <pubDate>${new Date(post.published_at * 1000).toUTCString()}</pubDate>
      ${post.authors.map((author) => `<dc:creator>${escapeXml(author.name)}</dc:creator>`).join("")}
      ${post.tags.map((tag) => `<category>${escapeXml(tag.name)}</category>`).join("")}
      <description>${escapeXml(post.excerpt)}</description>
      <content:encoded><![CDATA[${feedHtml(post).replaceAll("]]>", "]]]]><![CDATA[>")}]]></content:encoded>
      ${post.cover_image ? `<enclosure url="${escapeXml(post.cover_image.startsWith("http") ? post.cover_image : origin + post.cover_image)}" type="image/jpeg" length="0"/>` : ""}
    </item>`).join("");
    return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(site.title)}</title>
    <link>${origin}</link>
    <description>${escapeXml(site.description)}</description>
    <language>${escapeXml(site.settings.language || "en")}</language>
    <atom:link href="${origin}/rss.xml" rel="self" type="application/rss+xml"/>
    <generator>Writestead</generator>${items}
  </channel>
</rss>`;
}

export function atom(site: SiteWithSettings, origin: string, posts: PublicPost[]): string
{
    const updated = new Date((posts[0]?.updated_at ?? site.created_at) * 1000).toISOString();
    const entries = posts.map((post) => `
  <entry>
    <title>${escapeXml(post.title)}</title>
    <link href="${origin}/${post.slug}"/>
    <id>${origin}/${post.slug}</id>
    <published>${new Date(post.published_at * 1000).toISOString()}</published>
    <updated>${new Date(post.updated_at * 1000).toISOString()}</updated>
    ${post.authors.map((author) => `<author><name>${escapeXml(author.name)}</name></author>`).join("")}
    <summary>${escapeXml(post.excerpt)}</summary>
    <content type="html">${escapeXml(feedHtml(post))}</content>
  </entry>`).join("");
    return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${escapeXml(site.title)}</title>
  <subtitle>${escapeXml(site.description)}</subtitle>
  <link href="${origin}/atom.xml" rel="self"/>
  <link href="${origin}"/>
  <id>${origin}/</id>
  <updated>${updated}</updated>
  <generator>Writestead</generator>${entries}
</feed>`;
}

export function sitemap(origin: string, entries: { path: string; updated: number }[]): string
{
    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries.map((entry) => `
  <url><loc>${escapeXml(origin + entry.path)}</loc><lastmod>${new Date(entry.updated * 1000).toISOString()}</lastmod></url>`).join("")}
</urlset>`;
}

export function robots(origin: string): string
{
    return `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\nDisallow: /account\n\nSitemap: ${origin}/sitemap.xml\n`;
}
