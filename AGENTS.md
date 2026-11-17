# AGENTS.md

Guidance for AI coding agents working in this repo.

## What this is

Writestead is an open source (AGPL-3.0) blogging, newsletter and paid membership platform that runs
as one Cloudflare Worker. Self-hosters deploy it with the Deploy to Cloudflare button (`MODE=single`,
one blog, everything unlocked). The hosted version at writestead.com runs the same code with
`MODE=multi`: a landing page on the root domain and blogs on subdomains.

## Rules that cause real damage when broken

- **No secrets, account IDs, resource IDs or our hosted domains in `wrangler.jsonc`.** Every
  self-hoster deploys that file. Hosted settings are passed on the command line at deploy time
  (`--var`, `--route`). Secrets live in Worker secrets; list each in `.dev.vars.example` and
  describe it in `package.json` → `cloudflare.bindings`.
- **A schema change is a new file in `migrations/`, never an edit to an applied one.** The Worker
  applies pending migrations on its first request (`src/worker/db/migrate.ts`).
- **Every query is scoped to the site.** Admin routes get the site from the hostname
  (`resolveHost`) and check the user's role with `requireStaff` and `requirePermission`.
- **Paid features are checked on the server** through `getEntitlements()` in `src/worker/env.ts`.
  Gate on a named entitlement (`canUsePaidMembers`, `subscriberLimit`), never on the plan name.
- **Paid content never leaks.** Gated posts render only the part before `<!--paywall-->` (or the
  excerpt) in pages, feeds, the API and emails. Excerpts are built from the free part only.
- **Demo sites are read-only.** `blockDemoWrites` rejects every non-GET admin request on a site with
  `is_demo = 1`.
- **Shared code stays pure.** `src/shared/` (Markdown, importers, CSV, settings) has no Worker or
  DOM APIs so the dashboard and the Worker use the same code. Importers have tests in `test/`.

## Layout

```
src/worker/          Hono app: index.ts routes by hostname
  routes/auth.ts     setup, signup, login, invites
  routes/admin/      dashboard API (content, audience, analytics, site settings)
  routes/public.ts   blog pages, subscribe, comments, beacon, feeds, media, checkout
  routes/v1.ts       read-only content API
  blog/              data queries, HTML templates, feeds
  landing/           marketing site for the root domain (multi mode)
  email.ts jobs.ts   newsletter rendering, queue consumer, cron
src/app/             React dashboard at /admin (Tailwind 4, Phosphor icons)
src/shared/          code used by both sides
public/_ws/          blog themes (blog.css), landing styles (site.css), fonts, logo
migrations/          D1 schema
scripts/seed.mjs     creates the demo and flagship blogs through the API
```

## Commands

```bash
npm run dev      # Vite + local workerd with local D1, R2, KV and queues
npm run check    # tsc -b and vitest
npm run build
npm run deploy   # build + wrangler deploy (self-hosted)
```

Local hosted mode: put `MODE=multi` and `ROOT_DOMAIN=localhost` in `.dev.vars`, then use
`http://localhost:<port>` and `http://<name>.localhost:<port>`.

## Style

4-space indent, braces on their own line, closure bodies on a new line. Comments explain why.
UI copy is sentence case with no em or en dashes. Selected states use a tinted background, never
an outline.
