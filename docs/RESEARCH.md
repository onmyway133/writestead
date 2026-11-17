# Research notes

What the common blogging and newsletter platforms offer, and what Writestead took from that. Checked on 2026-11-17 from public pages and reviews; prices change often, so verify before quoting them.

## What everyone has

Every platform people move between covers the same core:

- A post editor with images, embeds and scheduling
- Tags or categories, static pages, a menu
- RSS, sitemap and decent SEO tags
- A subscribe form, a subscriber list, CSV import and export
- Sending posts by email, with unsubscribe handling

These are table stakes, so Writestead ships all of them on the free plan.

## Where they differ

| Area | What the leaders do | Writestead |
|---|---|---|
| Analytics | Ghost 6 added built-in web analytics (visitors, sources, filters by audience) plus per-newsletter open and click reports and member and MRR charts. Beehiiv and Substack focus on subscriber growth and email engagement. | Cookieless web stats, newsletter opens and clicks, growth, churn, upgrades and MRR |
| Paid memberships | Ghost and Substack: free and paid tiers, paywalled posts. Substack takes a revenue share. | Free and paid tiers, preview then paywall, writer's own Stripe, no revenue share |
| Free tier | Beehiiv: free up to 2,500 subscribers (several sources agree). Buttondown: free up to 100 subscribers. Bear Blog and Write.as: minimal, free personal blogs. | Free up to 1,000 subscribers, unlimited posts |
| Lock-in | Exports exist but importing elsewhere is often painful. | Imports from Ghost, WordPress, Substack, Medium and Markdown; exports JSON, Markdown and CSV |
| Self-hosting | Ghost and WordPress need a server or managed host. | One Worker on the writer's own Cloudflare account, free plan for a personal blog |
| Simplicity | Bear Blog and Write.as win on speed and a quiet writing experience. | Server-rendered pages with no client framework on the blog, Markdown editor |

## Decisions

- **Free plan is enough for a personal blog**: unlimited posts, comments, RSS, 4 themes, 1,000 subscribers, 30 days of analytics.
- **Pro ($9 a month or $90 a year, our assumption to revisit)** adds what a growing publication needs: custom domain, all themes, paid memberships, bigger lists, full analytics history and revenue, team seats, code injection, API and webhooks, and removing the badge.
- **Self-hosted gets everything**, because the writer already pays Cloudflare and the code is AGPL.

## Sources

- Ghost 6.0 changelog and analytics posts: https://ghost.org/changelog/6/, https://ghost.org/changelog/paid-member-analytics-improvements/
- Beehiiv pricing (free tier 2,500 subscribers per several reviews): https://www.beehiiv.com/pricing
- Buttondown pricing (first 100 subscribers free): https://buttondown.com/pricing
