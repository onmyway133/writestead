import { THEMES } from "../../shared/settings";
import { PRO_PRICE, TEAMS_PRICE } from "../../shared/plans";
import type { AppEnv } from "../env";
import { icon } from "./icons";

// The marketing site on the root domain of the hosted version. Static HTML from the Worker.

const REPO = "https://github.com/onmyway133/writestead";
const DEPLOY = `https://deploy.workers.cloudflare.com/?url=${REPO}`;

function esc(value: string): string
{
    return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

function shell(env: AppEnv, options: { title: string; description: string; path: string; body: string; noindex?: boolean }): string
{
    const origin = `https://${env.ROOT_DOMAIN || "writestead.com"}`;
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(options.title)}</title>
<meta name="description" content="${esc(options.description)}">
<link rel="canonical" href="${origin}${options.path}">
${options.noindex ? '<meta name="robots" content="noindex">' : ""}
<meta property="og:type" content="website">
<meta property="og:site_name" content="Writestead">
<meta property="og:title" content="${esc(options.title)}">
<meta property="og:description" content="${esc(options.description)}">
<meta property="og:url" content="${origin}${options.path}">
<meta property="og:image" content="${origin}/_ws/og.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#6e43f5">
<link rel="icon" href="/_ws/favicon.png" type="image/png">
<link rel="apple-touch-icon" href="/_ws/apple-touch-icon.png">
<link rel="preload" href="/_ws/fonts/geist.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/_ws/site.css">
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="nav-wrap">
  <nav class="nav" aria-label="Main">
    <a class="nav-brand" href="/" aria-label="Writestead home"><img src="/_ws/logo-128.png" alt="" width="28" height="28"><span>Writestead</span></a>
    <div class="nav-links" id="nav-links">
      <a href="/#features">Features</a>
      <a href="/#themes">Themes</a>
      <a href="/#self-host">Self-host</a>
      <a href="/#pricing">Pro</a>
      <a href="https://blog.${esc(env.ROOT_DOMAIN || "writestead.com")}">Blog</a>
    </div>
    <div class="nav-actions">
      <a class="btn btn-ghost btn-sm hide-sm" href="/login">Sign in</a>
      <a class="btn btn-primary btn-sm" href="/signup">Start free</a>
      <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="mobile-menu" aria-label="Open menu"><span></span><span></span></button>
    </div>
  </nav>
</header>
<div class="mobile-menu" id="mobile-menu" hidden>
  <a href="/#features">Features</a><a href="/#themes">Themes</a><a href="/#self-host">Self-host</a><a href="/#pricing">Pro</a>
  <a href="https://blog.${esc(env.ROOT_DOMAIN || "writestead.com")}">Blog</a><a href="/login">Sign in</a>
</div>
<main id="main">${options.body}</main>
<footer class="footer">
  <div class="container footer-grid">
    <div>
      <a class="nav-brand" href="/"><img src="/_ws/logo-128.png" alt="" width="28" height="28"><span>Writestead</span></a>
      <p class="caption-2 muted">Open source blogging and newsletters on Cloudflare.</p>
    </div>
    <div class="footer-col"><p class="title-4">Product</p><a href="/#features">Features</a><a href="/#pricing">Pro</a><a href="https://demo.${esc(env.ROOT_DOMAIN || "writestead.com")}">Live demo</a><a href="https://blog.${esc(env.ROOT_DOMAIN || "writestead.com")}">Blog</a></div>
    <div class="footer-col"><p class="title-4">Open source</p><a href="${REPO}">GitHub</a><a href="${REPO}#self-hosting">Self-hosting guide</a><a href="${DEPLOY}">Deploy to Cloudflare</a></div>
    <div class="footer-col"><p class="title-4">Legal</p><a href="/privacy">Privacy</a><a href="/terms">Terms</a></div>
  </div>
  <div class="container footer-meta caption-5 muted"><span>© ${new Date().getUTCFullYear()} Writestead</span><span>Made for writers who want to own their work.</span></div>
</footer>
<script>${SCRIPT}</script>
</body>
</html>`;
}

// Mobile menu, scroll reveals and the word-by-word tagline. No scroll listeners: IntersectionObserver only.
const SCRIPT = `(function(){
var t=document.querySelector(".menu-toggle"),m=document.getElementById("mobile-menu");
if(t){t.addEventListener("click",function(){var o=t.getAttribute("aria-expanded")==="true";t.setAttribute("aria-expanded",String(!o));t.setAttribute("aria-label",o?"Open menu":"Close menu");document.body.classList.toggle("menu-open",!o);if(o){m.hidden=true}else{m.hidden=false}});m.querySelectorAll("a").forEach(function(a){a.addEventListener("click",function(){t.click()})})}
var reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;
var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add("is-in");io.unobserve(e.target)}})},{rootMargin:"0px 0px -10% 0px"});
document.querySelectorAll("[data-reveal]").forEach(function(el){if(reduce){el.classList.add("is-in")}else{io.observe(el)}});
var words=document.querySelectorAll(".tagline .w");
if(reduce){words.forEach(function(w){w.classList.add("on")})}else{var wo=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add("on");wo.unobserve(e.target)}})},{rootMargin:"0px 0px -42% 0px"});words.forEach(function(w){wo.observe(w)})}
if(!reduce&&matchMedia("(pointer:fine)").matches){var hero=document.querySelector(".hero"),layers=hero?hero.querySelectorAll("[data-depth]"):[],tx=0,ty=0,raf=0;
if(hero)hero.addEventListener("pointermove",function(e){var r=hero.getBoundingClientRect();tx=(e.clientX-r.left)/r.width-.5;ty=(e.clientY-r.top)/r.height-.5;if(!raf)raf=requestAnimationFrame(function(){raf=0;layers.forEach(function(l){var d=parseFloat(l.dataset.depth);l.style.setProperty("--px",(tx*d*14).toFixed(1)+"px");l.style.setProperty("--py",(ty*d*10).toFixed(1)+"px")})})});
document.querySelectorAll(".spot").forEach(function(c){c.addEventListener("pointermove",function(e){var r=c.getBoundingClientRect();c.style.setProperty("--mx",(e.clientX-r.left)+"px");c.style.setProperty("--my",(e.clientY-r.top)+"px")})})}
document.querySelectorAll(".billing-toggle button").forEach(function(b){b.addEventListener("click",function(){document.querySelectorAll(".billing-toggle button").forEach(function(x){x.setAttribute("aria-pressed",String(x===b))});document.body.dataset.billing=b.dataset.billing})});
})();`;

// ==phrase== in copy becomes a highlighter mark that sweeps in when the reader hovers the paragraph.
function marks(copy: string): string
{
    return copy.replace(/==(.+?)==/g, '<mark class="hl">$1</mark>');
}

const MARQUEE = ["Import from Ghost", "WordPress", "Substack", "Medium", "Markdown", "Stripe", "PayPal", "RSS and Atom", "Sitemap and JSON-LD", "Custom domains", "Turnstile", "Webhooks", "Content API", "10 themes", "Cookieless analytics", "Follow-up emails", "Paid posts", "Team roles"];

// Illustrated icons for the hosted landing page live in public/_ws/brand, which is gitignored because
// their license forbids redistribution. When they're missing, the Phosphor icon underneath shows instead.
function art(name: string, fallback: string, size = 48): string
{
    return `<span class="art" style="--art:${size}px"><img src="/_ws/brand/${name}.webp" alt="" width="${size}" height="${size}" loading="lazy" decoding="async" onerror="this.remove()">${icon(fallback, Math.round(size * 0.5))}</span>`;
}

function tagline(text: string): string
{
    return text.split(/(\n)/).map((part) => (part === "\n" ? "<br>" : part.split(" ").map((word) => `<span class="w">${esc(word)}</span>`).join(" "))).join("");
}

const FEATURES: { icon: string; art: string; title: string; text: string }[] = [
    { icon: "pen-nib", art: "edit", title: "An editor that stays out of the way", text: "Markdown with a ==live preview==. Drag in images, paste a YouTube, X, CodePen or gist link to ==embed it==, and get highlighted code blocks. ==Autosave and revision history== included." },
    { icon: "envelope-simple", art: "email", title: "Every post can be a newsletter", text: "==Double opt-in== forms, an embeddable signup widget, ==welcome emails==, segments by label or plan, and ==email-only posts==. Sending runs through Cloudflare Queues." },
    { icon: "crown-simple", art: "shop", title: "Paid memberships, your money", text: "Free and paid tiers, members-only posts, and a ==preview, then paywall== split. Connect Stripe or PayPal accounts. ==Money goes straight to you.==" },
    { icon: "chart-line-up", art: "compass", title: "Analytics without cookies", text: "Views, ==unique visitors==, top posts, referrers, countries, devices and UTM sources. Plus ==opens, clicks==, subscriber growth, churn and ==MRR==." },
    { icon: "palette", art: "gallery", title: "Ten themes, no code needed", text: "Minimal, magazine, newsletter, photo, docs, dark, retro and more. Pick ==colors, fonts, logo and layout==, and ==preview before you switch==." },
    { icon: "arrows-left-right", art: "download", title: "Come in from anywhere, leave anytime", text: "Import from ==Ghost, WordPress, Substack, Medium== or Markdown files, images and subscribers included. ==Export everything== as JSON, Markdown or CSV whenever you like." },
];

const STEPS: { art: string; fallback: string; title: string; text: string }[] = [
    { art: "home", fallback: "globe", title: "Pick an address", text: "Claim yourname.writestead.com, or deploy your own copy to Cloudflare with one click." },
    { art: "pencil", fallback: "pen-nib", title: "Write or import", text: "Start a post, or bring your archive and subscribers over from the platform you're leaving." },
    { art: "upload", fallback: "lightning", title: "Publish and send", text: "Hit publish. Readers get it on the web, in their feed reader and in their inbox." },
];

type Faq = { q: string; a: string };

function faqs(env: AppEnv): Faq[]
{
    const root = env.ROOT_DOMAIN || "writestead.com";
    return [
        { q: "Is Writestead really free?", a: `Yes. The free plan on ${root} includes unlimited posts, comments, RSS, analytics for the last 30 days and up to 1,000 subscribers. Self-hosting is free with every feature unlocked.` },
        { q: "What does self-hosting cost?", a: "Writestead runs on your own Cloudflare account. A personal blog fits in Cloudflare's free Workers plan. You need to enable R2 for images, and sending newsletters needs a domain set up in Cloudflare Email Service. Check Cloudflare's pricing page for current limits." },
        { q: "Can I use my own domain?", a: "Yes. Custom domains are part of Pro on the hosted version and free when you self-host. Cloudflare issues the SSL certificate for you." },
        { q: "How do paid memberships work?", a: "You connect your own Stripe account and set monthly and yearly prices. Readers pay you directly. Writestead takes no cut of your revenue." },
        { q: "Can I move my blog from Ghost, WordPress or Substack?", a: "Yes. Upload your export file in Settings, then Import. Posts, pages, tags, images and subscribers come across. Paid members are carried over as complimentary members until they subscribe through your Stripe." },
        { q: "Will I be locked in?", a: "No. Export your posts, pages, settings and subscribers as JSON or CSV at any time. The code is open source, so you can also take the whole platform with you." },
        { q: "Do the analytics need a cookie banner?", a: "Writestead stores no cookies and no personal data for analytics. Visitors are counted with a hash that changes every day, so nobody can be followed across days or sites." },
        { q: "Is it open source?", a: "Yes, under the AGPL 3.0 license. The hosted version runs the same code you can deploy yourself." },
    ];
}

export function landingPage(env: AppEnv): string
{
    const root = env.ROOT_DOMAIN || "writestead.com";
    const body = marks(`
<section class="hero">
  <div class="hero-bg" aria-hidden="true"><div class="blob-layer"><span class="blob b1"></span><span class="blob b2"></span><span class="blob b3"></span><span class="blob b4"></span><span class="blob b5"></span></div><div class="grain"></div></div>
  <div class="hero-icons" aria-hidden="true">
    <span class="hi hi1" data-depth="3">${art("notes", "pen-nib", 72)}</span>
    <span class="hi hi2" data-depth="-2.4">${art("calendar", "calendar-dots", 64)}</span>
    <span class="hi hi3" data-depth="4">${art("message", "chat-circle", 56)}</span>
    <span class="hi hi4" data-depth="-3.2">${art("news", "rss", 60)}</span>
    <span class="hi hi5" data-depth="2">${art("share", "globe", 52)}</span>
  </div>
  <div class="container hero-inner" data-depth="0.4">
    <a class="pill caption-1" href="${REPO}"><span class="pill-dot"></span>Open source and runs on Cloudflare ${icon("arrow-right", 14)}</a>
    <h1 class="heading-1 hero-title">Write it here.<br><span class="shine">Own it forever.</span></h1>
    <p class="hero-sub body-3">A blog, a newsletter and paid memberships in one place.<br class="hide-sm"> Start free on ${root}, or deploy your own copy in one click.</p>
    <form class="hero-form" action="/signup" method="get">
      <label class="sr-only" for="hero-name">Choose your blog address</label>
      <div class="address-field"><input id="hero-name" name="name" placeholder="yourname" autocomplete="off" pattern="[a-z0-9-]{3,32}" title="3 to 32 lowercase letters, numbers or dashes"><span class="suffix">.${root}</span></div>
      <button class="btn btn-primary btn-lg" type="submit">Start your blog free</button>
    </form>
    <p class="caption-2 hero-note">No credit card. Or <a href="${DEPLOY}">deploy to your own Cloudflare</a>.</p>
  </div>
  <div class="container mock-stage">
    ${productMock()}
    <div class="floater f1" data-depth="2.2" aria-hidden="true">${art("contact", "users-three", 40)}<span><b>+24 subscribers</b><small>today</small></span></div>
    <div class="floater f2" data-depth="1.4" aria-hidden="true">${art("email", "envelope-simple", 40)}<span><b>58.3% opened</b><small>Sunday letter</small></span></div>
    <div class="floater f3" data-depth="2.8" aria-hidden="true">${art("star", "crown-simple", 40)}<span><b>New paid member</b><small>Supporter, yearly</small></span></div>
    <div class="floater f4" data-depth="1.8" aria-hidden="true">${art("bell", "lightning", 40)}<span><b>Published</b><small>web, email and RSS</small></span></div>
  </div>
</section>

<section class="marquee" aria-label="What's included">
  <div class="marquee-track">${[...MARQUEE, ...MARQUEE].map((item, index) => `<span class="marquee-item"${index >= MARQUEE.length ? ' aria-hidden="true"' : ""}>${icon("sparkle", 14)}${item}</span>`).join("")}</div>
</section>


<section class="section container" id="features">
  <div class="section-head" data-reveal>
    <p class="eyebrow caption-3">Everything a writer needs</p>
    <h2 class="heading-3">One home for your posts,<br>your list and your income</h2>
    <p class="body-3 muted hl-text">The parts you'd usually stitch together from ==three different tools==, built in and ==working together==.</p>
  </div>
  <div class="feature-grid">
    ${FEATURES.map((feature) => `<article class="feature card spot hl-text" data-reveal><span class="feature-icon">${art(feature.art, feature.icon, 56)}</span><h3 class="title-2">${feature.title}</h3><p class="body-6 muted">${marks(feature.text)}</p></article>`).join("")}
  </div>
</section>

<section class="words-band" aria-hidden="true">
  <div class="words-row row-a">Write <i>✦</i> Publish <i>✦</i> Send <i>✦</i> Earn <i>✦</i> Own <i>✦</i> Write <i>✦</i> Publish <i>✦</i> Send</div>
  <div class="words-row row-b">Blog <i>✦</i> Newsletter <i>✦</i> Members <i>✦</i> Analytics <i>✦</i> Themes <i>✦</i> Blog <i>✦</i> Newsletter</div>
</section>

<section class="tagline-section" aria-label="Why Writestead">
  <p class="tagline heading-2 container">${tagline("Your words, your readers, your domain.\nNo algorithm in between, nothing to rent.")}</p>
</section>

<section class="section container" id="how">
  <div class="section-head" data-reveal>
    <p class="eyebrow caption-3">How it works</p>
    <h2 class="heading-3">From blank page to inbox<br>in three steps</h2>
  </div>
  <ol class="steps">
    ${STEPS.map((step, index) => `<li class="step card" data-reveal><span class="step-art">${art(step.art, step.fallback, 64)}<span class="step-number caption-3">${index + 1}</span></span><h3 class="title-2">${step.title}</h3><p class="body-6 muted">${step.text}</p></li>`).join("")}
  </ol>
</section>

<section class="section section-tint" id="themes">
  <div class="container">
    <div class="section-head" data-reveal>
      <p class="eyebrow caption-3">Themes</p>
      <h2 class="heading-3">Ten looks, all fast,<br>all readable on a phone</h2>
      <p class="body-3 muted">Change colors, fonts, logo and layout from the dashboard. Add your own CSS if you want to go further.</p>
    </div>
    <div class="theme-grid">
      ${THEMES.map((theme) => `<article class="theme-card" data-reveal>
        <div class="theme-preview" style="--bg:${theme.swatch[0]};--fg:${theme.swatch[1]};--ac:${theme.swatch[2]}" aria-hidden="true">
          <span class="tp-bar"></span><span class="tp-title"></span><span class="tp-line"></span><span class="tp-line short"></span>
          <span class="tp-cards"><i></i><i></i><i></i></span>
        </div>
        <div class="theme-meta"><p class="title-4">${theme.name}</p><p class="caption-5 muted">${theme.style}${theme.premium ? ' <span class="tag-pro">Pro</span>' : ""}</p></div>
      </article>`).join("")}
    </div>
    <p class="center"><a class="btn btn-secondary" href="https://demo.${root}">See the live demo blog ${icon("arrow-right", 16)}</a></p>
  </div>
</section>

<section class="section container split" id="analytics">
  <div data-reveal>
    <p class="eyebrow caption-3">Analytics</p>
    <h2 class="heading-3">Know what lands,<br>without tracking anyone</h2>
    <p class="body-3 muted hl-text">Built-in, ==cookieless stats== for the web and your newsletter. See ==which posts bring subscribers== and ==which emails get read==.</p>
    <ul class="checks body-6">
      ${["Views, visitors, top posts and referrers", "Countries, devices and UTM sources", "Open and click rates for every send", "Subscriber growth, churn and free to paid conversions", "MRR, new and cancelled paid members"].map((item) => `<li>${icon("check", 18)}${item}</li>`).join("")}
    </ul>
  </div>
  <div class="stats-mock card spot tilt" data-reveal aria-hidden="true">
    <div class="sm-row"><div><p class="caption-4 muted">Visitors</p><p class="heading-5">8,412</p></div><div><p class="caption-4 muted">Subscribers</p><p class="heading-5">1,937</p></div><div><p class="caption-4 muted">Open rate</p><p class="heading-5">58.3%</p></div></div>
    <svg class="sm-chart" viewBox="0 0 400 140" preserveAspectRatio="none"><path d="M0 120 C40 112 60 96 90 98 S150 70 180 74 S240 40 270 52 S330 22 360 30 L400 18 L400 140 L0 140Z" fill="rgba(110,67,245,.12)"/><path d="M0 120 C40 112 60 96 90 98 S150 70 180 74 S240 40 270 52 S330 22 360 30 L400 18" fill="none" stroke="#6e43f5" stroke-width="3"/></svg>
    <div class="sm-list caption-2"><p><span>news.ycombinator.com</span><span>2,104</span></p><p><span>Newsletter</span><span>1,388</span></p><p><span>google.com</span><span>941</span></p></div>
    <p class="caption-5 muted">Sample numbers</p>
  </div>
</section>

<section class="section section-ink" id="self-host">
  <div class="container split">
    <div data-reveal>
      ${art("settings", "code", 64)}
      <p class="eyebrow caption-3">Self-host</p>
      <h2 class="heading-3">Your own copy on Cloudflare,<br>every feature unlocked</h2>
      <p class="body-3 hl-text">Click the button, connect your Cloudflare account, and Writestead creates ==the Worker, the D1 database, the R2 bucket, the KV namespace and the queue== for you. ==Updates are a pull from upstream.==</p>
      <div class="cta-row"><a class="btn btn-primary" href="${DEPLOY}">${icon("cloud", 18)} Deploy to Cloudflare</a><a class="btn btn-on-dark" href="${REPO}">${icon("github-logo", 18)} View on GitHub</a></div>
    </div>
    <pre class="code-card caption-2" data-reveal aria-label="Manual setup commands"><code><span class="c"># or set it up by hand</span>
git clone ${REPO}
cd writestead &amp;&amp; npm install
npx wrangler login
npm run deploy
<span class="c"># then open /admin to create your account</span></code></pre>
  </div>
</section>

<section class="section container" id="pricing">
  <div class="section-head" data-reveal>
    <p class="eyebrow caption-3">Pricing</p>
    <h2 class="heading-3">Free for a personal blog.<br>Pro or Teams when you grow.</h2>
    <div class="billing-toggle" role="group" aria-label="Billing period"><button type="button" data-billing="monthly" aria-pressed="true">Monthly</button><button type="button" data-billing="yearly" aria-pressed="false">Yearly</button></div>
  </div>
  <div class="pricing-grid">
    ${plan({ name: "Free", art: ["love", "sparkle"], price: "$0", note: "forever", text: "Everything a personal blog needs.", cta: "Start free", href: "/signup", features: [`yourname.${root}`, "Unlimited posts and pages", "4 free themes", "Up to 1,000 subscribers", "10,000 emails a month", "30 days of analytics", "Comments, RSS, sitemap, search", "Import and export"] })}
    ${plan({ name: "Pro", art: ["diamond", "crown-simple"], price: `<span class="m">$${PRO_PRICE.monthly}</span><span class="y">$${PRO_PRICE.yearly}</span>`, note: '<span class="m">per month</span><span class="y">per year</span>', text: "For one writer building an audience or a business.", cta: "Start with Pro", href: "/signup?plan=pro", featured: true, features: ["Everything in Free", "Custom domain with SSL", "All 10 themes", "Paid memberships with your Stripe", "Up to 10,000 subscribers", "100,000 emails a month", "Full analytics history and revenue", "Custom CSS and code injection", "API and webhooks", "Remove “Powered by Writestead”"] })}
    ${plan({ name: "Teams", art: ["user", "users-three"], price: `<span class="m">$${TEAMS_PRICE.monthly}</span><span class="y">$${TEAMS_PRICE.yearly}</span>`, note: '<span class="m">per month</span><span class="y">per year</span>', text: "For publications with editors, authors and admins.", cta: "Start with Teams", href: "/signup?plan=teams", features: ["Everything in Pro", "Unlimited team members", "Admin, editor, author and contributor roles", "Up to 25,000 subscribers", "250,000 emails a month"] })}
    ${plan({ name: "Self-hosted", art: ["protection", "shield-check"], price: "$0", note: "on your Cloudflare", text: "The whole platform on your own account.", cta: "Deploy to Cloudflare", href: DEPLOY, features: ["Every Pro and Teams feature", "No subscriber or email caps from us", "Your data in your own D1 and R2", "Cloudflare bills you for usage", "AGPL 3.0 open source"] })}
  </div>
</section>

<section class="section container faq" id="faq">
  <div class="section-head" data-reveal><p class="eyebrow caption-3">FAQ</p><h2 class="heading-3">Questions, answered</h2></div>
  <div class="faq-list">
    ${faqs(env).map((item) => `<details class="faq-item"><summary class="title-3">${esc(item.q)}<span class="faq-icon">${icon("plus", 18)}</span></summary><p class="body-6 muted hl-text">${esc(item.a).replace(/^([^.]+\.)/, '<mark class="hl">$1</mark>')}</p></details>`).join("")}
  </div>
</section>

<section class="final-cta">
  <div class="hero-bg" aria-hidden="true"><span class="blob b1"></span><span class="blob b3"></span><span class="blob b5"></span></div>
  <div class="container center" data-reveal>
    <h2 class="heading-3">Your next post deserves<br>a home you own</h2>
    <p class="body-3">Free to start. Free to leave. Open source either way.</p>
    <div class="cta-row center-row"><a class="btn btn-primary btn-lg" href="/signup">Start your blog free</a></div>
  </div>
</section>
<script type="application/ld+json">${JSON.stringify({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faqs(env).map((item) => ({ "@type": "Question", name: item.q, acceptedAnswer: { "@type": "Answer", text: item.a } })),
    }).replace(/</g, "\\u003c")}</script>`);
    return shell(env, {
        title: "Writestead: open source blogging and newsletters on Cloudflare",
        description: "Publish posts, send newsletters and run paid memberships from one place. Start free on writestead.com or self-host on your own Cloudflare account.",
        path: "/",
        body,
    });
}

function plan(options: { name: string; art?: [string, string]; price: string; note: string; text: string; cta: string; href: string; features: string[]; featured?: boolean }): string
{
    return `<article class="plan card${options.featured ? " plan-featured" : ""}" data-reveal>
      ${options.featured ? '<span class="plan-badge caption-3">Most popular</span>' : ""}
      <h3 class="title-1 plan-name">${options.art ? art(options.art[0], options.art[1], 40) : ""}${options.name}</h3>
      <p class="plan-price"><span class="heading-3">${options.price}</span><span class="caption-2 muted">${options.note}</span></p>
      <p class="body-6 muted">${options.text}</p>
      <a class="btn ${options.featured ? "btn-primary" : "btn-secondary"} btn-block" href="${options.href}">${options.cta}</a>
      <ul class="checks body-6">${options.features.map((feature) => `<li>${icon("check", 18)}${feature}</li>`).join("")}</ul>
    </article>`;
}

// A drawn product shot: the editor with a post open and the publish panel.
function productMock(): string
{
    return `<div class="mock" aria-label="The Writestead editor" role="img">
  <div class="mock-bar"><span></span><span></span><span></span><p class="caption-4">yourname.writestead.com/admin</p></div>
  <div class="mock-body">
    <aside class="mock-side">
      <p class="mock-brand title-4"><img src="/_ws/logo-128.png" alt="" width="20" height="20">My Notebook</p>
      ${["Dashboard", "Posts", "Pages", "Subscribers", "Newsletters", "Analytics", "Themes", "Settings"].map((item, index) => `<p class="mock-nav caption-1${index === 1 ? " on" : ""}">${item}</p>`).join("")}
    </aside>
    <div class="mock-editor">
      <p class="caption-4 muted">Draft · saved just now</p>
      <p class="mock-h heading-5">The quiet joy of a slow morning</p>
      <p class="body-6 muted">I used to start every day by checking three apps before I got out of bed. This winter I tried something different, and it changed how I write.</p>
      <div class="mock-img"></div>
      <p class="body-6 muted">The first week was hard. The second week, I started noticing things.</p>
      <p class="mock-code caption-2"><span>https://youtu.be/…</span> becomes an embed</p>
    </div>
    <aside class="mock-panel">
      <p class="title-4">Publish</p>
      <div class="mock-seg caption-4"><span class="on">Web + email</span><span>Web</span></div>
      <p class="caption-4 muted">Send to</p><p class="mock-field caption-2">All subscribers · 1,937</p>
      <p class="caption-4 muted">Access</p><p class="mock-field caption-2">Paid after preview</p>
      <span class="btn btn-primary btn-sm btn-block">Publish and send</span>
    </aside>
  </div>
</div>`;
}

export function marketingNotFound(env: AppEnv, title: string, message: string): string
{
    return shell(env, {
        title: `${title} · Writestead`,
        description: message,
        path: "/404",
        noindex: true,
        body: `<section class="hero hero-small"><div class="hero-bg" aria-hidden="true"><span class="blob b2"></span><span class="blob b4"></span></div><div class="container hero-inner center"><h1 class="heading-2 hero-title">${esc(title)}</h1><p class="hero-sub body-3">${esc(message)}</p><div class="cta-row center-row"><a class="btn btn-primary" href="https://${esc(env.ROOT_DOMAIN || "writestead.com")}/signup">Start a blog</a><a class="btn btn-secondary" href="https://${esc(env.ROOT_DOMAIN || "writestead.com")}/">Go home</a></div></div></section>`,
    });
}

export function legalPage(env: AppEnv, kind: "privacy" | "terms"): string
{
    const privacy = `<h1 class="heading-3">Privacy</h1>
<p>Writestead is built to collect as little as possible.</p>
<h2 class="heading-6">Readers of blogs hosted on Writestead</h2>
<p>Page views are counted without cookies. We store the page, the referring site, the country from the request and a device type. Visitors are counted with a hash of the IP address and browser, salted with a value that changes every day and is never stored with the data, so a person can't be followed across days. If you subscribe to a blog, the blog's owner gets your email address and name, and sees whether you opened or clicked their emails.</p>
<h2 class="heading-6">Writers</h2>
<p>We store your account details, your posts and your settings to run the service. Payments for memberships go through the writer's own Stripe account.</p>
<h2 class="heading-6">Where data lives</h2>
<p>Everything runs on Cloudflare (Workers, D1, R2, KV). We don't sell data or use third party ad trackers.</p>
<h2 class="heading-6">Contact</h2>
<p>Questions or deletion requests: open an issue on <a href="${REPO}">GitHub</a>.</p>`;
    const terms = `<h1 class="heading-3">Terms</h1>
<p>By using the hosted version of Writestead you agree to these terms.</p>
<h2 class="heading-6">Your content</h2><p>You own what you publish. You give us permission to store and serve it so your blog works. You can export or delete it at any time.</p>
<h2 class="heading-6">Acceptable use</h2><p>No spam, malware, phishing, illegal content or content that harasses people. We may suspend blogs that break this rule.</p>
<h2 class="heading-6">Emails</h2><p>Send newsletters only to people who asked to receive them. Subscriber forms use double opt-in.</p>
<h2 class="heading-6">Service</h2><p>The service is provided as is. The open source code is licensed under the AGPL 3.0.</p>`;
    return shell(env, {
        title: `${kind === "privacy" ? "Privacy" : "Terms"} · Writestead`,
        description: kind === "privacy" ? "How Writestead handles data." : "Terms for the hosted version of Writestead.",
        path: `/${kind}`,
        body: `<article class="container legal body-3">${kind === "privacy" ? privacy : terms}</article>`,
    });
}

export function marketingRobots(env: AppEnv): string
{
    return `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\n\nSitemap: https://${env.ROOT_DOMAIN}/sitemap.xml\n`;
}

export function marketingSitemap(env: AppEnv): string
{
    const origin = `https://${env.ROOT_DOMAIN}`;
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${["/", "/privacy", "/terms"].map((path) => `<url><loc>${origin}${path}</loc></url>`).join("")}</urlset>`;
}
