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
- [ ] Auto-generated OG images (needs a PNG renderer in the Worker, e.g. Satori + resvg WASM)
- [x] Statuses: draft, scheduled, published, unlisted
- [x] Autosave and revision history with restore
- [x] Static pages and navigation menu editor
- [x] Sitemap, RSS, Atom, robots.txt, JSON-LD

## Import and export
- [x] Import Ghost JSON, WordPress WXR, Substack ZIP/CSV, Medium ZIP, Markdown files (parsed in the browser)
- [x] Copy imported images into R2
- [x] Import subscribers (paid members come in as complimentary)
- [x] Export JSON, Markdown ZIP, subscribers CSV
- [ ] Export media as a ZIP (the JSON lists every media URL today)

## Themes
- [x] 10 themes: Stead, Journal, Letter, Midnight, Paper, Lens, Manual, Arcade, Bloom, Press
- [x] Theme settings: accent color, fonts, logo, icon, cover, layout, color scheme
- [x] Custom CSS and head/footer code injection (Pro on hosted)
- [x] Live theme preview before switching

## Subscribers and newsletters
- [x] Subscribe forms with double opt-in, embeddable signup widget
- [x] Subscriber list, search, labels, filters, CSV import/export, unsubscribe (link and one-click POST)
- [~] Bounce tracking: the `bounced` status exists, but nothing sets it yet (Email Service bounce events not wired)
- [x] Send posts as newsletters, email-only posts, segments (all, free, paid, label)
- [x] Welcome email
- [ ] More automations (drip sequences)
- [~] Paid memberships: tiers, paywalled posts (full and preview), Stripe Checkout with several accounts and webhooks. Not tested against a live Stripe account yet.
- [ ] PayPal checkout (accounts can't be added yet)
- [ ] Customer portal for paid members to cancel or change card (Stripe Billing Portal)
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
- [~] Custom domains: self-hosted works through the Cloudflare dashboard. Hosted needs Cloudflare for SaaS (custom hostnames) set up on writestead.com; the dashboard field and DNS instructions exist, the custom hostname is not created automatically yet.
- [x] Turnstile on public forms and signup (when keys are set)
- [x] Content API (`/api/v1/posts`, `/api/v1/tags`) and webhooks
- [x] Reader account page: sign in by email link, email preferences, sign out

## Hosted version
- [x] Landing page: hero with animated gradient, features, themes, analytics, self-host, pricing, FAQ, privacy, terms
- [x] Signup with subdomain check, blog picker for people with several blogs
- [x] Plans: Free and Pro for one writer, Teams ($27/month, 3x Pro) with unlimited teammates
- [ ] Billing for Pro and Teams (no checkout yet; today a plan is changed in D1)
- [ ] Monthly email limit enforcement (limit is defined, sends aren't counted yet)
- [x] Demo blog at demo.writestead.com (read-only dashboard, sample data)
- [x] Flagship blog at blog.writestead.com

## Launch
- [x] Tagline, Product Hunt listing, X thread, Show HN post, announcement post (`docs/LAUNCH.md`)
- [ ] Make the GitHub repo public (the Deploy button needs a public repo)
