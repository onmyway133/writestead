import { html, raw } from "hono/html";
import type { HtmlEscapedString } from "hono/utils/html";
import { escapeHtml, renderMarkdown, splitPaywall } from "../../shared/markdown";
import { findTheme, fontStack, type NavItem } from "../../shared/settings";
import type { SiteWithSettings } from "../../shared/types";
import { readingMinutes } from "../lib/text";
import type { Author, PublicPost, Tag } from "./data";

type Html = HtmlEscapedString | Promise<HtmlEscapedString>;

export type Reader = { id: string; email: string; name: string; tier: "free" | "paid" | "comp"; status: string; token: string; provider?: string };

export type RenderContext = {
    site: SiteWithSettings;
    origin: string;
    reader: Reader | null;
    poweredBy: boolean;
    customCode: boolean;
    turnstileSiteKey: string;
    // Shown when the theme is previewed from the dashboard instead of the saved one.
    themeOverride?: string;
    marketingUrl: string;
};

export function formatDate(ctx: RenderContext, seconds: number, style: "long" | "short" = "long"): string
{
    try
    {
        return new Intl.DateTimeFormat(ctx.site.settings.language || "en", {
            dateStyle: style === "long" ? "long" : "medium",
            timeZone: ctx.site.settings.timezone || "UTC",
        }).format(new Date(seconds * 1000));
    }
    catch
    {
        return new Date(seconds * 1000).toISOString().slice(0, 10);
    }
}

function themeStyle(ctx: RenderContext): string
{
    const settings = ctx.site.settings;
    const theme = findTheme(ctx.themeOverride ?? settings.theme);
    const rules: string[] = [];
    const accent = /^#[0-9a-f]{3,8}$/i.test(settings.accent) ? settings.accent : theme.accent;
    rules.push(`--accent:${accent}`);
    const heading = fontStack(settings.headingFont);
    const body = fontStack(settings.bodyFont);
    if (heading)
    {
        rules.push(`--font-heading:${heading}`);
    }
    if (body)
    {
        rules.push(`--font-body:${body}`);
    }
    return `:root{${rules.join(";")}}`;
}

function navLinks(items: NavItem[], current: string): Html
{
    return html`${items.map((item) => html`<a href="${item.url}"${current === item.url ? raw(' aria-current="page"') : ""}>${item.label}</a>`)}`;
}

function socialLinks(ctx: RenderContext): Html
{
    const social = ctx.site.settings.social;
    const links: [string, string][] = [];
    if (social.x)
    {
        links.push(["X", social.x.startsWith("http") ? social.x : `https://x.com/${social.x.replace(/^@/, "")}`]);
    }
    if (social.github)
    {
        links.push(["GitHub", social.github.startsWith("http") ? social.github : `https://github.com/${social.github}`]);
    }
    if (social.mastodon)
    {
        links.push(["Mastodon", social.mastodon]);
    }
    if (social.bluesky)
    {
        links.push(["Bluesky", social.bluesky.startsWith("http") ? social.bluesky : `https://bsky.app/profile/${social.bluesky}`]);
    }
    if (social.instagram)
    {
        links.push(["Instagram", social.instagram.startsWith("http") ? social.instagram : `https://instagram.com/${social.instagram}`]);
    }
    if (social.linkedin)
    {
        links.push(["LinkedIn", social.linkedin]);
    }
    return html`${links.map(([label, url]) => html`<a href="${url}" rel="me noopener" target="_blank">${label}</a>`)}`;
}

export function layout(ctx: RenderContext, page: {
    title: string;
    description?: string;
    path: string;
    canonical?: string;
    image?: string;
    type?: "website" | "article";
    jsonLd?: object;
    body: Html;
    postId?: string;
    noindex?: boolean;
}): Html
{
    const { site } = ctx;
    const settings = site.settings;
    const theme = findTheme(ctx.themeOverride ?? settings.theme);
    const description = page.description || site.description;
    const canonical = page.canonical || `${ctx.origin}${page.path}`;
    // Without a chosen image, link previews use the card generated at /og/home.png.
    const image = page.image || settings.coverImage || "/og/home.png";
    const scheme = theme.id === "midnight" || theme.id === "lens" ? "dark" : settings.colorScheme;
    const showSubscribe = settings.membersEnabled;
    return html`<!doctype html>
<html lang="${settings.language || "en"}" data-theme="${theme.id}" data-scheme="${scheme}" data-layout="${settings.layout || theme.layout}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${page.title}</title>
${description ? html`<meta name="description" content="${description}">` : ""}
<link rel="canonical" href="${canonical}">
${page.noindex ? html`<meta name="robots" content="noindex">` : ""}
<meta property="og:site_name" content="${site.title}">
<meta property="og:type" content="${page.type ?? "website"}">
<meta property="og:title" content="${page.title}">
${description ? html`<meta property="og:description" content="${description}">` : ""}
<meta property="og:url" content="${canonical}">
${image ? html`<meta property="og:image" content="${absolute(ctx, image)}">` : ""}
<meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}">
<meta name="twitter:title" content="${page.title}">
${description ? html`<meta name="twitter:description" content="${description}">` : ""}
${image ? html`<meta name="twitter:image" content="${absolute(ctx, image)}">` : ""}
${settings.social.x ? html`<meta name="twitter:site" content="@${settings.social.x.replace(/^@|https?:\/\/(x|twitter)\.com\//g, "")}">` : ""}
<link rel="alternate" type="application/rss+xml" title="${site.title}" href="${ctx.origin}/rss.xml">
<link rel="alternate" type="application/atom+xml" title="${site.title}" href="${ctx.origin}/atom.xml">
${settings.icon ? html`<link rel="icon" href="${settings.icon}">` : html`<link rel="icon" href="/_ws/favicon.png" type="image/png">`}
<link rel="stylesheet" href="/_ws/blog.css">
<style>${raw(themeStyle(ctx))}</style>
${page.jsonLd ? html`<script type="application/ld+json">${raw(JSON.stringify(page.jsonLd).replace(/</g, "\\u003c"))}</script>` : ""}
${ctx.customCode && settings.customCss ? html`<style>${raw(settings.customCss.replace(/<\/style/gi, ""))}</style>` : ""}
${ctx.customCode && settings.headCode ? raw(settings.headCode) : ""}
${ctx.turnstileSiteKey ? html`<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>` : ""}
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="site-header">
  <div class="wrap header-row">
    <a class="brand" href="/">${settings.logo ? html`<img src="${settings.logo}" alt="${site.title}">` : html`<span>${site.title}</span>`}</a>
    <nav class="nav" aria-label="Main">${navLinks(settings.navigation, page.path)}</nav>
    <div class="header-actions">
      <a class="icon-link" href="/search" aria-label="Search"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg></a>
      ${ctx.reader
        ? html`<a class="btn btn-ghost" href="/account">Account</a>`
        : showSubscribe ? html`<a class="btn btn-ghost hide-sm" href="/account">Sign in</a><a class="btn" href="/subscribe">Subscribe</a>` : ""}
    </div>
  </div>
</header>
<main id="main">${page.body}</main>
<footer class="site-footer">
  <div class="wrap footer-row">
    <div class="footer-brand"><strong>${site.title}</strong>${site.description ? html`<p>${site.description}</p>` : ""}</div>
    <nav class="footer-nav" aria-label="Footer">${navLinks(settings.footerNavigation, page.path)}${socialLinks(ctx)}</nav>
  </div>
  <div class="wrap footer-meta">
    <span>© ${new Date().getUTCFullYear()} ${site.title}</span>
    ${ctx.poweredBy ? html`<a class="powered" href="${ctx.marketingUrl}" target="_blank" rel="noopener">Powered by Writestead</a>` : ""}
  </div>
</footer>
<script>${raw(beacon(page.postId))}</script>
${ctx.customCode && settings.footerCode ? raw(settings.footerCode) : ""}
</body>
</html>`;
}

// Cookieless page view ping. The server hashes the visitor with a daily salt; nothing is stored here.
function beacon(postId?: string): string
{
    const payload = `{p:location.pathname,r:document.referrer,q:location.search${postId ? `,id:${JSON.stringify(postId)}` : ""}}`;
    return `(function(){try{if(navigator.webdriver)return;var d=JSON.stringify(${payload});navigator.sendBeacon?navigator.sendBeacon("/api/p",d):fetch("/api/p",{method:"POST",body:d,keepalive:true})}catch(e){}})();`;
}

function absolute(ctx: RenderContext, url: string): string
{
    return url.startsWith("http") ? url : `${ctx.origin}${url.startsWith("/") ? "" : "/"}${url}`;
}

function authorLine(ctx: RenderContext, post: PublicPost): Html
{
    const settings = ctx.site.settings;
    return html`<div class="byline">
      ${settings.showAuthor && post.authors.length > 0 ? html`<span class="authors">${post.authors.map((author, index) => html`${index > 0 ? ", " : ""}<a href="/author/${author.slug}">${author.name}</a>`)}</span><span class="dot">·</span>` : ""}
      <time datetime="${new Date(post.published_at * 1000).toISOString()}">${formatDate(ctx, post.published_at, "short")}</time>
      ${settings.showReadingTime ? html`<span class="dot">·</span><span>${readingMinutes(post.content)} min read</span>` : ""}
      ${post.visibility !== "public" ? html`<span class="badge">${post.visibility === "paid" ? "Paid" : "Members"}</span>` : ""}
    </div>`;
}

export function postCard(ctx: RenderContext, post: PublicPost, variant: "row" | "card" | "hero" = "row"): Html
{
    const tag = post.tags[0];
    return html`<article class="post-card post-card-${variant}${post.featured ? " is-featured" : ""}">
      ${post.cover_image && variant !== "row" ? html`<a class="post-card-image" href="/${post.slug}" tabindex="-1" aria-hidden="true"><img src="${post.cover_image}" alt="" loading="lazy" decoding="async"></a>` : ""}
      <div class="post-card-body">
        ${tag ? html`<a class="eyebrow" href="/tag/${tag.slug}">${tag.name}</a>` : ""}
        <h2 class="post-card-title"><a href="/${post.slug}">${post.title}</a></h2>
        ${post.excerpt ? html`<p class="post-card-excerpt">${post.excerpt}</p>` : ""}
        ${authorLine(ctx, post)}
      </div>
      ${post.cover_image && variant === "row" ? html`<a class="post-card-thumb" href="/${post.slug}" tabindex="-1" aria-hidden="true"><img src="${post.cover_image}" alt="" loading="lazy" decoding="async"></a>` : ""}
    </article>`;
}

export function postList(ctx: RenderContext, posts: PublicPost[], layoutName?: string): Html
{
    const mode = layoutName ?? (ctx.site.settings.layout || findTheme(ctx.site.settings.theme).layout);
    if (posts.length === 0)
    {
        return html`<p class="empty">No posts yet. Check back soon.</p>`;
    }
    if (mode === "magazine")
    {
        const [first, ...rest] = posts;
        return html`<div class="magazine">${postCard(ctx, first, "hero")}<div class="grid">${rest.map((post) => postCard(ctx, post, "card"))}</div></div>`;
    }
    if (mode === "grid")
    {
        return html`<div class="grid">${posts.map((post) => postCard(ctx, post, "card"))}</div>`;
    }
    return html`<div class="list">${posts.map((post) => postCard(ctx, post, "row"))}</div>`;
}

export function pagination(page: number, total: number, size: number, base: string): Html
{
    const pages = Math.ceil(total / size);
    if (pages <= 1)
    {
        return html``;
    }
    const link = (target: number) => (target === 1 ? base : `${base}${base.includes("?") ? "&" : "?"}page=${target}`);
    return html`<nav class="pagination" aria-label="Pagination">
      ${page > 1 ? html`<a class="btn btn-ghost" href="${link(page - 1)}" rel="prev">← Newer</a>` : html`<span></span>`}
      <span class="muted">Page ${page} of ${pages}</span>
      ${page < pages ? html`<a class="btn btn-ghost" href="${link(page + 1)}" rel="next">Older →</a>` : html`<span></span>`}
    </nav>`;
}

export function turnstile(ctx: RenderContext): Html
{
    return ctx.turnstileSiteKey ? html`<div class="cf-turnstile" data-sitekey="${ctx.turnstileSiteKey}" data-size="flexible"></div>` : html``;
}

export function subscribeForm(ctx: RenderContext, options: { compact?: boolean; source?: string } = {}): Html
{
    const settings = ctx.site.settings;
    if (!settings.membersEnabled)
    {
        return html``;
    }
    if (ctx.reader)
    {
        return html``;
    }
    return html`<section class="subscribe${options.compact ? " subscribe-compact" : ""}">
      <h2>${settings.subscribeTitle}</h2>
      <p>${settings.subscribeText}</p>
      <form class="subscribe-form" method="post" action="/api/subscribe" data-ws-form>
        <input type="hidden" name="source" value="${options.source ?? "web"}">
        <label class="sr-only" for="sub-email-${options.source ?? "web"}">Email address</label>
        <input id="sub-email-${options.source ?? "web"}" type="email" name="email" required placeholder="you@example.com" autocomplete="email">
        <button class="btn" type="submit">Subscribe</button>
        ${turnstile(ctx)}
        <p class="form-status" role="status" aria-live="polite"></p>
      </form>
    </section>
    <script>${raw(FORM_SCRIPT)}</script>`;
}

// Progressive enhancement: forms work without JS (the API redirects), and with JS they stay in place.
const FORM_SCRIPT = `(function(){document.querySelectorAll("form[data-ws-form]:not([data-ready])").forEach(function(f){f.dataset.ready="1";f.addEventListener("submit",function(e){e.preventDefault();var s=f.querySelector(".form-status"),b=f.querySelector("button[type=submit]");b.disabled=true;s.textContent="";fetch(f.action,{method:"POST",body:new FormData(f),headers:{Accept:"application/json"}}).then(function(r){return r.json().then(function(j){return{ok:r.ok,j:j}})}).then(function(x){s.textContent=x.ok?(x.j.message||"Done."):(x.j.error||"Something went wrong.");s.dataset.tone=x.ok?"ok":"error";if(x.ok){f.reset();if(x.j.redirect)location.href=x.j.redirect}}).catch(function(){s.textContent="Network error. Try again.";s.dataset.tone="error"}).finally(function(){b.disabled=false;if(window.turnstile)try{turnstile.reset()}catch(e){}})})})})();`;

export function homePage(ctx: RenderContext, data: { posts: PublicPost[]; featured: PublicPost[]; total: number; page: number; tags: (Tag & { count: number })[] }, pageSize: number): Html
{
    const { site } = ctx;
    const theme = findTheme(ctx.themeOverride ?? site.settings.theme);
    const showHero = data.page === 1;
    const showFeatured = data.page === 1 && data.featured.length > 0 && theme.id !== "letter";
    const featuredIds = new Set(showFeatured ? data.featured.map((post) => post.id) : []);
    const posts = data.posts.filter((post) => !featuredIds.has(post.id));
    const body = html`
      ${showHero ? html`<section class="hero${site.settings.coverImage ? " hero-cover" : ""}"${site.settings.coverImage ? raw(` style="--cover:url('${escapeHtml(site.settings.coverImage)}')"`) : ""}>
        <div class="wrap">
          <h1 class="hero-title">${site.title}</h1>
          ${site.description ? html`<p class="hero-text">${site.description}</p>` : ""}
          ${theme.id === "letter" || theme.id === "bloom" ? subscribeForm(ctx, { compact: true, source: "hero" }) : ""}
        </div>
      </section>` : ""}
      <div class="wrap content-area">
        ${theme.id === "manual" ? docsSidebar(data.tags) : ""}
        <div class="feed">
          ${showFeatured ? html`<section class="featured" aria-label="Featured"><h2 class="section-title">Featured</h2><div class="grid">${data.featured.slice(0, 3).map((post) => postCard(ctx, post, "card"))}</div></section>` : ""}
          ${showFeatured ? html`<h2 class="section-title">Latest</h2>` : ""}
          ${postList(ctx, posts)}
          ${pagination(data.page, data.total, pageSize, "/")}
        </div>
      </div>
      ${theme.id !== "letter" && theme.id !== "bloom" ? html`<div class="wrap">${subscribeForm(ctx, { source: "home" })}</div>` : ""}`;
    return layout(ctx, {
        title: data.page > 1 ? `${site.title} (page ${data.page})` : site.title,
        path: data.page > 1 ? `/?page=${data.page}` : "/",
        body,
        jsonLd: {
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: site.title,
            description: site.description,
            url: ctx.origin,
            potentialAction: { "@type": "SearchAction", target: `${ctx.origin}/search?q={query}`, "query-input": "required name=query" },
        },
    });
}

function docsSidebar(tags: (Tag & { count: number })[]): Html
{
    return html`<aside class="docs-sidebar" aria-label="Topics"><p class="eyebrow">Topics</p>${tags.map((tag) => html`<a href="/tag/${tag.slug}">${tag.name}<span>${tag.count}</span></a>`)}<a href="/archive">All posts</a></aside>`;
}

export type Access = "full" | "preview";

export function canRead(post: PublicPost, reader: Reader | null): boolean
{
    if (post.visibility === "public")
    {
        return true;
    }
    if (!reader || reader.status !== "active")
    {
        return false;
    }
    return post.visibility === "members" || reader.tier === "paid" || reader.tier === "comp";
}

export function postPage(ctx: RenderContext, post: PublicPost, extra: { related: PublicPost[]; comments: { id: string; name: string; body: string; created_at: number }[]; commentsOpen: boolean; commentNote: string }): Html
{
    const { site } = ctx;
    const readable = canRead(post, ctx.reader);
    let contentHtml: string;
    if (readable)
    {
        contentHtml = renderMarkdown(post.content.replace("<!--paywall-->", ""));
    }
    else
    {
        const { preview, hasMarker } = splitPaywall(post.content);
        contentHtml = hasMarker ? renderMarkdown(preview) : `<p>${escapeHtml(post.excerpt)}</p>`;
    }
    const url = `${ctx.origin}/${post.slug}`;
    const isPage = post.type === "page";
    const title = post.meta_title || post.title;
    const body = html`<article class="post${isPage ? " is-page" : ""}">
      <header class="post-header wrap-narrow">
        ${!isPage && post.tags[0] ? html`<a class="eyebrow" href="/tag/${post.tags[0].slug}">${post.tags[0].name}</a>` : ""}
        <h1 class="post-title">${post.title}</h1>
        ${post.excerpt && !isPage ? html`<p class="post-excerpt">${post.excerpt}</p>` : ""}
        ${!isPage ? authorLine(ctx, post) : ""}
      </header>
      ${post.cover_image ? html`<figure class="post-cover wrap-wide"><img src="${post.cover_image}" alt="" decoding="async"></figure>` : ""}
      <div class="post-content wrap-narrow${readable ? "" : " is-gated"}">${raw(contentHtml)}</div>
      ${readable ? "" : paywall(ctx, post)}
      ${!isPage ? html`<footer class="post-footer wrap-narrow">
        ${post.tags.length > 0 ? html`<div class="tags">${post.tags.map((tag) => html`<a class="tag" href="/tag/${tag.slug}">${tag.name}</a>`)}</div>` : ""}
        <div class="share" aria-label="Share">
          <span class="muted">Share</span>
          <a href="https://x.com/intent/post?url=${encodeURIComponent(url)}&text=${encodeURIComponent(post.title)}" target="_blank" rel="noopener">X</a>
          <a href="https://bsky.app/intent/compose?text=${encodeURIComponent(`${post.title} ${url}`)}" target="_blank" rel="noopener">Bluesky</a>
          <a href="https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}" target="_blank" rel="noopener">LinkedIn</a>
          <a href="mailto:?subject=${encodeURIComponent(post.title)}&body=${encodeURIComponent(url)}">Email</a>
        </div>
        ${post.authors.map((author) => authorBox(author))}
      </footer>` : ""}
    </article>
    ${!isPage && readable ? html`<div class="wrap-narrow">${subscribeForm(ctx, { source: "post" })}</div>` : ""}
    ${!isPage ? commentsSection(ctx, post, extra) : ""}
    ${extra.related.length > 0 ? html`<section class="wrap related"><h2 class="section-title">Keep reading</h2><div class="grid">${extra.related.map((item) => postCard(ctx, item, "card"))}</div></section>` : ""}`;
    return layout(ctx, {
        title: isPage ? `${title} · ${site.title}` : title,
        description: post.meta_description || post.excerpt,
        path: `/${post.slug}`,
        canonical: post.canonical_url || undefined,
        image: post.og_image || post.cover_image || `/og/${post.slug}.png`,
        type: isPage ? "website" : "article",
        postId: post.id,
        body,
        jsonLd: isPage ? undefined : {
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            headline: post.title,
            description: post.meta_description || post.excerpt,
            image: absolute(ctx, post.og_image || post.cover_image || `/og/${post.slug}.png`),
            datePublished: new Date(post.published_at * 1000).toISOString(),
            dateModified: new Date(post.updated_at * 1000).toISOString(),
            author: post.authors.map((author) => ({ "@type": "Person", name: author.name, url: `${ctx.origin}/author/${author.slug}` })),
            publisher: { "@type": "Organization", name: site.title, url: ctx.origin },
            mainEntityOfPage: url,
            isAccessibleForFree: post.visibility === "public",
        },
    });
}

function paywall(ctx: RenderContext, post: PublicPost): Html
{
    const paid = post.visibility === "paid";
    const signedIn = ctx.reader !== null;
    return html`<section class="paywall wrap-narrow">
      <h2>${paid ? "This post is for paid members" : "This post is for subscribers"}</h2>
      <p>${paid
        ? signedIn ? "Upgrade your membership to keep reading and support this publication." : "Become a paid member to read the rest and support this publication."
        : "Subscribe for free to read the rest of this post."}</p>
      <div class="paywall-actions">
        ${paid && signedIn ? html`<a class="btn" href="/account#upgrade">Upgrade</a>` : html`<a class="btn" href="/subscribe${paid ? "?plan=paid" : ""}">${paid ? "See plans" : "Subscribe free"}</a>`}
        ${signedIn ? "" : html`<a class="btn btn-ghost" href="/account">I already have an account</a>`}
      </div>
    </section>`;
}

function authorBox(author: Author): Html
{
    return html`<div class="author-box">
      ${author.avatar ? html`<img src="${author.avatar}" alt="" width="48" height="48">` : html`<span class="avatar">${author.name.slice(0, 1)}</span>`}
      <div><a href="/author/${author.slug}"><strong>${author.name}</strong></a>${author.bio ? html`<p>${author.bio}</p>` : ""}</div>
    </div>`;
}

function commentsSection(ctx: RenderContext, post: PublicPost, extra: { comments: { id: string; name: string; body: string; created_at: number }[]; commentsOpen: boolean; commentNote: string }): Html
{
    const mode = ctx.site.settings.commentsMode;
    if (mode === "off")
    {
        return html``;
    }
    return html`<section class="comments wrap-narrow" id="comments">
      <h2 class="section-title">${extra.comments.length === 0 ? "Comments" : `${extra.comments.length} comment${extra.comments.length === 1 ? "" : "s"}`}</h2>
      ${extra.comments.map((comment) => html`<div class="comment"><div class="comment-meta"><strong>${comment.name}</strong><span class="muted">${formatDate(ctx, comment.created_at, "short")}</span></div><p>${comment.body}</p></div>`)}
      ${extra.commentsOpen
        ? html`<form class="comment-form" method="post" action="/api/comments" data-ws-form>
            <input type="hidden" name="post_id" value="${post.id}">
            ${ctx.reader ? "" : html`<label class="label" for="comment-name">Name</label><input id="comment-name" name="name" required maxlength="80" autocomplete="name">`}
            <label class="label" for="comment-body">Comment</label>
            <textarea id="comment-body" name="body" required maxlength="4000" rows="4"></textarea>
            ${turnstile(ctx)}
            <button class="btn" type="submit">Post comment</button>
            <p class="form-status" role="status" aria-live="polite"></p>
          </form><script>${raw(FORM_SCRIPT)}</script>`
        : html`<p class="muted">${extra.commentNote}</p>`}
    </section>`;
}

export function listingPage(ctx: RenderContext, options: { title: string; description?: string; eyebrow?: string; path: string; posts: PublicPost[]; page: number; total: number; pageSize: number; avatar?: string; jsonLd?: object }): Html
{
    const body = html`<section class="page-header wrap">
        ${options.avatar ? html`<img class="page-avatar" src="${options.avatar}" alt="" width="72" height="72">` : ""}
        ${options.eyebrow ? html`<p class="eyebrow">${options.eyebrow}</p>` : ""}
        <h1>${options.title}</h1>
        ${options.description ? html`<p class="page-description">${options.description}</p>` : ""}
      </section>
      <div class="wrap">${postList(ctx, options.posts)}${pagination(options.page, options.total, options.pageSize, options.path)}</div>`;
    return layout(ctx, { title: `${options.title} · ${ctx.site.title}`, description: options.description, path: options.path, body, jsonLd: options.jsonLd });
}

export function archivePage(ctx: RenderContext, posts: { title: string; slug: string; published_at: number }[]): Html
{
    const byYear = new Map<number, typeof posts>();
    for (const post of posts)
    {
        const year = new Date(post.published_at * 1000).getUTCFullYear();
        byYear.set(year, [...(byYear.get(year) ?? []), post]);
    }
    const body = html`<section class="page-header wrap"><h1>Archive</h1><p class="page-description">${posts.length} posts</p></section>
      <div class="wrap-narrow archive">${[...byYear.entries()].map(([year, items]) => html`<h2 class="archive-year">${year}</h2><ul>${items.map((item) => html`<li><a href="/${item.slug}">${item.title}</a><time>${formatDate(ctx, item.published_at, "short")}</time></li>`)}</ul>`)}</div>`;
    return layout(ctx, { title: `Archive · ${ctx.site.title}`, path: "/archive", body });
}

export function searchPage(ctx: RenderContext, query: string, results: PublicPost[] | null): Html
{
    const body = html`<section class="page-header wrap"><h1>Search</h1>
        <form class="search-form" action="/search" role="search"><label class="sr-only" for="q">Search posts</label><input id="q" name="q" type="search" value="${query}" placeholder="Search posts" autofocus><button class="btn" type="submit">Search</button></form>
      </section>
      <div class="wrap">${results === null ? "" : results.length === 0 ? html`<p class="empty">No posts match “${query}”.</p>` : postList(ctx, results, "list")}</div>`;
    return layout(ctx, { title: `Search · ${ctx.site.title}`, path: "/search", body, noindex: true });
}

export function messagePage(ctx: RenderContext, title: string, message: string, action?: { label: string; href: string }): Html
{
    const body = html`<section class="message wrap-narrow"><h1>${title}</h1><p>${message}</p>${action ? html`<a class="btn" href="${action.href}">${action.label}</a>` : ""}</section>`;
    return layout(ctx, { title: `${title} · ${ctx.site.title}`, path: "/", body, noindex: true });
}

export function subscribePage(ctx: RenderContext, tiers: { id: string; name: string; description: string; monthly_price: number; yearly_price: number; currency: string; benefits: string }[], wantsPaid: boolean, providers: string[] = []): Html
{
    // With both providers connected the reader picks; with one, checkout uses it without asking.
    const choosePay = (tierId: string) => providers.length > 1
        ? html`<div class="interval" role="radiogroup" aria-label="Pay with">${providers.map((provider, index) => html`<label><input type="radio" name="provider" value="${provider}" id="pay-${provider}-${tierId}"${index === 0 ? raw(" checked") : ""}> ${provider === "paypal" ? "PayPal" : "Card"}</label>`)}</div>`
        : html``;
    const settings = ctx.site.settings;
    const body = html`<section class="page-header wrap-narrow center">
        <h1>${settings.subscribeTitle}</h1><p class="page-description">${settings.subscribeText}</p>
      </section>
      <div class="wrap tiers">
        <div class="tier">
          <h2>Free</h2><p class="price">$0</p><p class="muted">New posts by email. Read all public and members-only posts.</p>
          ${ctx.reader ? html`<p class="muted">You're subscribed as ${ctx.reader.email}.</p>` : html`<form class="subscribe-form" method="post" action="/api/subscribe" data-ws-form>
            <input type="hidden" name="source" value="subscribe-page">
            <label class="sr-only" for="sp-email">Email</label><input id="sp-email" type="email" name="email" required placeholder="you@example.com" autocomplete="email">
            <button class="btn" type="submit">Subscribe free</button>${turnstile(ctx)}<p class="form-status" role="status" aria-live="polite"></p>
          </form>`}
        </div>
        ${settings.paidEnabled ? tiers.map((tier) => html`<div class="tier tier-paid${wantsPaid ? " is-highlighted" : ""}">
          <h2>${tier.name}</h2>
          <p class="price">${money(tier.monthly_price, tier.currency)}<span>/month</span></p>
          ${tier.yearly_price ? html`<p class="muted">or ${money(tier.yearly_price, tier.currency)} a year</p>` : ""}
          ${tier.description ? html`<p>${tier.description}</p>` : ""}
          ${tier.benefits ? html`<ul class="benefits">${tier.benefits.split("\n").filter(Boolean).map((benefit) => html`<li>${benefit}</li>`)}</ul>` : ""}
          <form method="post" action="/api/checkout" data-ws-form>
            <input type="hidden" name="tier_id" value="${tier.id}">
            ${ctx.reader ? "" : html`<label class="sr-only" for="ck-${tier.id}">Email</label><input id="ck-${tier.id}" type="email" name="email" required placeholder="you@example.com">`}
            <div class="interval"><label><input type="radio" name="interval" value="month" checked> Monthly</label>${tier.yearly_price ? html`<label><input type="radio" name="interval" value="year"> Yearly</label>` : ""}</div>
            ${choosePay(tier.id)}
            <button class="btn" type="submit">Join ${tier.name}</button>
            <p class="form-status" role="status" aria-live="polite"></p>
          </form>
        </div>`) : ""}
      </div><script>${raw(FORM_SCRIPT)}</script>`;
    return layout(ctx, { title: `Subscribe · ${ctx.site.title}`, path: "/subscribe", body });
}

export function money(minor: number, currency: string): string
{
    try
    {
        return new Intl.NumberFormat("en", { style: "currency", currency: currency.toUpperCase(), minimumFractionDigits: minor % 100 === 0 ? 0 : 2 }).format(minor / 100);
    }
    catch
    {
        return `${(minor / 100).toFixed(2)} ${currency.toUpperCase()}`;
    }
}

export function accountPage(ctx: RenderContext, sent: boolean): Html
{
    const reader = ctx.reader;
    const body = reader
        ? html`<section class="page-header wrap-narrow"><p class="eyebrow">Your account</p><h1>${reader.name || reader.email}</h1><p class="page-description">${reader.email}</p></section>
          <div class="wrap-narrow account">
            <div class="account-card">
              <h2>Membership</h2>
              <p><span class="badge">${reader.tier === "paid" ? "Paid member" : reader.tier === "comp" ? "Complimentary" : "Free member"}</span> ${reader.status === "unsubscribed" ? html`<span class="muted">Email paused</span>` : ""}</p>
              ${reader.tier === "free" && ctx.site.settings.paidEnabled ? html`<a id="upgrade" class="btn" href="/subscribe?plan=paid">Upgrade to paid</a>` : ""}
              ${reader.tier === "paid" && reader.provider === "stripe" ? html`<form method="post" action="/api/account/billing" data-ws-form><button class="btn btn-ghost" type="submit">Manage billing</button><p class="form-status" role="status" aria-live="polite"></p></form>` : ""}
              ${reader.tier === "paid" && reader.provider === "paypal" ? html`<p class="muted">Your membership is billed through PayPal. Manage or cancel it from your PayPal account.</p>` : ""}
            </div>
            <form class="account-card" method="post" action="/api/account" data-ws-form>
              <h2>Profile and email</h2>
              <label class="label" for="acc-name">Name</label>
              <input id="acc-name" name="name" value="${reader.name}" maxlength="80" autocomplete="name">
              <label class="check"><input type="checkbox" name="email_enabled" value="1"${reader.status === "active" ? raw(" checked") : ""}> Send me new posts by email</label>
              <button class="btn" type="submit">Save</button>
              <p class="form-status" role="status" aria-live="polite"></p>
            </form>
            <form class="account-card" method="post" action="/api/account/signout"><button class="btn btn-ghost" type="submit">Sign out</button></form>
          </div><script>${raw(FORM_SCRIPT)}</script>`
        : html`<section class="page-header wrap-narrow center"><h1>Sign in</h1><p class="page-description">${sent ? "Check your inbox for a sign-in link." : "Enter the email you subscribed with and we'll send you a sign-in link."}</p></section>
          <div class="wrap-narrow"><form class="subscribe-form" method="post" action="/api/account/link" data-ws-form>
            <label class="sr-only" for="signin-email">Email</label><input id="signin-email" type="email" name="email" required placeholder="you@example.com" autocomplete="email">
            <button class="btn" type="submit">Send link</button>${turnstile(ctx)}<p class="form-status" role="status" aria-live="polite"></p>
          </form></div><script>${raw(FORM_SCRIPT)}</script>`;
    return layout(ctx, { title: `Account · ${ctx.site.title}`, path: "/account", body, noindex: true });
}

export function waitlistPage(ctx: RenderContext): Html
{
    const settings = ctx.site.settings;
    const body = html`<section class="waitlist wrap-narrow center">
        ${settings.logo ? html`<img class="waitlist-logo" src="${settings.logo}" alt="">` : ""}
        <p class="eyebrow">${ctx.site.title}</p>
        <h1>${settings.waitlistTitle}</h1>
        <p class="page-description">${settings.waitlistText}</p>
        <form class="subscribe-form" method="post" action="/api/subscribe" data-ws-form>
          <input type="hidden" name="source" value="waitlist">
          <label class="sr-only" for="wl-email">Email</label><input id="wl-email" type="email" name="email" required placeholder="you@example.com" autocomplete="email">
          <button class="btn" type="submit">Join the waitlist</button>${turnstile(ctx)}<p class="form-status" role="status" aria-live="polite"></p>
        </form>
      </section><script>${raw(FORM_SCRIPT)}</script>`;
    return layout(ctx, { title: ctx.site.title, path: "/", body });
}

export function notFoundPage(ctx: RenderContext): Html
{
    return messagePage(ctx, "Page not found", "The page you're looking for doesn't exist or has moved.", { label: "Go home", href: "/" });
}
