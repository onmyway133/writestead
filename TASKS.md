# Tasks

Progress on Writestead. `[x]` done and checked, `[~]` partly done (the note says what's missing), `[ ]` not started.

## Foundation
- [x] Research Ghost, WordPress, Substack, Beehiiv, Buttondown, Bear Blog, Write.as (`docs/RESEARCH.md`)
- [x] One Worker with D1, R2, KV, Queues, Cron Triggers and Email Service bindings (`wrangler.jsonc`)
- [x] Schema and self-applying migrations (`migrations/`, `src/worker/db/migrate.ts`)
- [x] Single-tenant mode (self-host) and multi-tenant mode (subdomains of `ROOT_DOMAIN`)
- [x] Free, Pro and self-hosted entitlements checked on the server (`src/shared/plans.ts`, `getEntitlements`)
- [x] `.dev.vars.example` with placeholder names only, Deploy to Cloudflare button, self-hosting guide in the README
- [x] Unit tests for Markdown, CSV and importers (`npm test`)

## Writing
- [x] Markdown editor with live preview, toolbar, drag and drop and paste image upload to R2
- [x] Embeds: YouTube, Vimeo, X, CodePen, GitHub gists
- [x] Code blocks with syntax highlighting
- [x] Post fields: title, slug, cover, excerpt, tags, authors, featured
- [x] SEO fields: meta title and description, canonical URL, OG/Twitter image, search and social preview
- [x] Auto-generated OG images (`/og/<slug>.png`, `/og/home.png`; satori 0.32 + resvg WASM)
- [x] Statuses: draft, scheduled, published, unlisted
- [x] Autosave and revision history with restore
- [x] Static pages and navigation menu editor
- [x] Sitemap, RSS, Atom, robots.txt, JSON-LD

## Import and export
- [x] Import Ghost JSON, WordPress WXR, Substack ZIP/CSV, Medium ZIP, Markdown files (parsed in the browser)
- [x] Copy imported images into R2
- [x] Import subscribers (paid members come in as complimentary)
- [x] Export JSON, Markdown ZIP, subscribers CSV
- [x] Export media as a ZIP (built in the browser)

## Themes
- [x] 10 themes: Stead, Journal, Letter, Midnight, Paper, Lens, Manual, Arcade, Bloom, Press
- [x] Theme settings: accent color, fonts, logo, icon, cover, layout, color scheme
- [x] Custom CSS and head/footer code injection (Pro on hosted)
- [x] Live theme preview before switching

## Subscribers and newsletters
- [x] Subscribe forms with double opt-in, embeddable signup widget
- [x] Subscriber list, search, labels, filters, CSV import/export, unsubscribe (link and one-click POST)
- [x] Bounce tracking: three failed sends in a row mark a subscriber bounced (only counted when others in the batch went out)
- [x] Send posts as newsletters, email-only posts, segments (all, free, paid, label)
- [x] Welcome email
- [x] Follow-up emails a set number of days after subscribing (Settings, Members and email)
- [~] Paid memberships: tiers, paywalled posts, Stripe and PayPal checkout with several accounts and webhooks. Not tested against live Stripe or PayPal accounts yet.
- [x] PayPal checkout (subscriptions API, webhook verification)
- [x] Stripe billing portal for paid members (Manage billing on the account page)
- [x] Pre-launch waitlist page

## Analytics
- [x] Cookieless page views: visitors, views, top pages, referrers, countries, devices, UTM
- [x] Newsletter: sends, opens, clicks, top links
- [x] Members: growth, churn, upgrades, signup sources
- [x] Revenue: MRR, new and cancelled revenue (Pro)

## Other
- [x] Staff roles (owner, admin, editor, author, contributor) and invites
- [x] Comments with moderation, members-only and paid-only modes
- [x] Search on the public blog
- [~] Custom domains: self-hosted works through the Cloudflare dashboard. Hosted creates Cloudflare for SaaS custom hostnames when `CF_API_TOKEN` and `CF_ZONE_ID` are set; the fallback origin `custom.writestead.com` and the `*/*` route still need setting up on the zone.
- [x] Turnstile on public forms and signup (when keys are set)
- [x] Content API (`/api/v1/posts`, `/api/v1/tags`) and webhooks
- [x] Reader account page: sign in by email link, email preferences, sign out

## Hosted version
- [x] Landing page: animated gradient hero with mouse and scroll parallax, floating cards, marquee, highlighter text, features, themes, analytics, self-host, pricing (Free, Pro, Teams, Self-hosted), FAQ, privacy, terms
- [x] Signup with subdomain check, blog picker for people with several blogs
- [x] Plans: Free and Pro for one writer, Teams ($27/month, 3x Pro) with unlimited teammates
- [~] Billing for Pro and Teams: Stripe checkout, portal and webhook are built; live once `PLATFORM_STRIPE_SECRET_KEY` and `PLATFORM_STRIPE_WEBHOOK_SECRET` are set
- [x] Monthly email limit enforcement
- [x] Deployed: writestead.com, demo.writestead.com (read-only dashboard, sample data), blog.writestead.com
- [x] Flagship blog at blog.writestead.com

## Launch
- [x] Tagline, Product Hunt listing, X thread, Show HN post, announcement post (`docs/LAUNCH.md`)
- [x] GitHub repo is public

## Waiting on account setup
- [x] R2 enabled; the hosted deploy uses the `writestead-media` bucket (files uploaded before then stay in KV and still load)
- [ ] Wildcard DNS `* AAAA 100::` (proxied) so new signups at `<name>.writestead.com` resolve
- [ ] Cloudflare Email Sending for writestead.com and the `EMAIL_FROM` secret, so confirmations and newsletters go out
- [ ] Platform Stripe keys for Pro and Teams billing
