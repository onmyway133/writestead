<p align="center"><img src="public/_ws/logo-512.png" width="128" alt="Writestead"></p>

<h1 align="center">Writestead</h1>

<p align="center">Open source blogging, newsletters and paid memberships on Cloudflare.<br>Start free at <a href="https://writestead.com">writestead.com</a>, or run your own copy in one click.</p>

<p align="center"><a href="https://deploy.workers.cloudflare.com/?url=https://github.com/onmyway133/writestead"><img src="https://deploy.workers.cloudflare.com/button" alt="Deploy to Cloudflare"></a></p>

<p align="center"><a href="https://demo.writestead.com">Live demo</a> · <a href="https://blog.writestead.com">Blog</a> · <a href="#self-hosting">Self-hosting guide</a></p>

---

## Features

- **Editor:** Markdown with live preview, drag and drop or paste images (stored in R2), embeds for YouTube, Vimeo, X, CodePen and GitHub gists, highlighted code blocks, autosave and revision history.
- **Posts and pages:** title, slug, cover, excerpt, tags, multiple authors, featured flag. Draft, scheduled, published and unlisted. Static pages and a navigation menu editor.
- **SEO:** meta title and description, canonical URL, Open Graph and Twitter tags, JSON-LD, sitemap, RSS and Atom feeds, robots.txt.
- **Newsletters:** double opt-in, embeddable signup widget, welcome email, segments by plan or label, email-only posts, sending through Cloudflare Queues with open and click tracking.
- **Subscribers:** search, labels, CSV import and export, unsubscribe handling, reader accounts with magic links.
- **Paid memberships:** free and paid tiers, members-only and paid posts with a free preview above a paywall marker, checkout through one or more connected Stripe accounts.
- **Analytics without cookies:** views, unique visitors, top pages, referrers, countries, devices and UTM sources. Opens, clicks, subscriber growth, churn, upgrades and MRR.
- **Ten themes:** Stead, Journal, Letter, Midnight, Paper, Lens, Manual, Arcade, Bloom and Press. Colors, fonts, logo and layout without code, live preview, custom CSS and code injection.
- **Team:** owner, admin, editor, author and contributor roles with invites.
- **Comments** with moderation, optionally members-only or paid-only.
- **Search, waitlist page** for pre-launch blogs, **Turnstile** bot protection on public forms.
- **Import** from Ghost, WordPress, Substack, Medium and Markdown, including images and subscribers. **Export** as JSON, Markdown ZIP and CSV.
- **Content API and webhooks.**

## How it runs

One Cloudflare Worker serves everything:

| Piece | Cloudflare product |
|---|---|
| Blog pages, landing page, API | Workers (Hono, server-rendered HTML) |
| Dashboard | React app served as static assets at `/admin` |
| Data | D1 |
| Images and media | R2 |
| Sign-in links, invites, daily analytics salt | KV |
| Newsletter sending | Queues + Email Service |
| Scheduled posts | Cron Triggers |

It runs in two modes, set with the `MODE` variable:

- `single` (default): one blog per deployment, every feature unlocked. This is what you get from the Deploy button.
- `multi`: many blogs on subdomains of `ROOT_DOMAIN`, with a marketing site on the root domain and Free, Pro and Teams plans. This is how writestead.com runs.

## Self-hosting

### What you need

- A Cloudflare account. A personal blog fits in the free Workers plan.
- R2 enabled on the account (Dashboard → Storage → R2). Cloudflare may ask for a payment method before enabling R2, even on the free tier.
- Optional: a domain onboarded to [Cloudflare Email Service](https://developers.cloudflare.com/email-service/) to send newsletters and confirmation emails. Without it, subscribers are confirmed right away and newsletters can't be sent.

Check Cloudflare's pricing pages for current limits; this README doesn't track them.

### One click

1. Click **Deploy to Cloudflare** above. Cloudflare copies the repository to your GitHub account and creates the Worker, D1 database, R2 bucket, KV namespace and queue.
2. Fill in the secrets it asks for. Only `OWNER_EMAIL` matters on day one.
3. Open `https://<your-worker>/admin` and create your account. The database sets itself up on the first request.
4. Add a custom domain: Worker → Settings → Domains and Routes → Add → Custom domain.

### By hand

```bash
git clone https://github.com/onmyway133/writestead
cd writestead
npm install
npx wrangler login
npm run deploy
```

Then set secrets with `npx wrangler secret put OWNER_EMAIL` (and the others below) and open `/admin`.

### Settings

Secrets (see `.dev.vars.example`):

| Name | Needed | What it does |
|---|---|---|
| `OWNER_EMAIL` | Recommended | Only this email can create the owner account. |
| `EMAIL_FROM` | For email | Sender, e.g. `My Blog <hello@example.com>`, on a domain onboarded to Cloudflare Email Service. |
| `TURNSTILE_SECRET_KEY` | Optional | Turnstile secret. Set `TURNSTILE_SITE_KEY` in `wrangler.jsonc` vars too. |

Paid memberships are configured in the dashboard (Settings → Paid memberships) with your own Stripe keys, stored in your D1 database. In Stripe, add a webhook for `checkout.session.completed` and `customer.subscription.deleted` pointing at the URL the dashboard shows.

### Updating

Pull from this repository into your copy (or sync your fork on GitHub) and push. Workers Builds redeploys, and the Worker applies new database migrations on its first request.

## Development

```bash
npm install
npm run dev        # http://localhost:5173, local D1, R2, KV and queues
npm run check      # typecheck and tests
npm run build
```

To try hosted mode locally, create `.dev.vars` with `MODE=multi` and `ROOT_DOMAIN=localhost`, then open `http://localhost:5173` for the landing page and `http://<name>.localhost:5173` for a blog.

`node scripts/seed.mjs demo --root http://localhost:5173 --email you@example.com --password 'something long'` creates the sample Field Notes blog.

## License

[AGPL-3.0](LICENSE). You can use, change and self-host Writestead for free. If you run a modified version as a service for others, you must share your changes under the same license.
