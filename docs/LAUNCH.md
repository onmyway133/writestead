# Launch kit

## Tagline

**Write it here. Own it forever.**

Alternatives:
- Your blog, newsletter and paid members, on your own Cloudflare.
- The open source home for writers who want to keep what they build.

## Product Hunt

**Name:** Writestead

**Tagline (60 chars max):** Open source blog + newsletter + memberships on Cloudflare

**Description (260 chars max):**
Writestead puts your blog, newsletter and paid memberships in one place. Start free on writestead.com, or deploy your own copy to Cloudflare in one click. Cookieless analytics, 10 themes, imports from Ghost, WordPress and Substack. AGPL.

**First comment:**

Hi Product Hunt! I'm Khoa, the maker of Writestead.

I kept seeing writers stuck between two options. Hosted platforms are easy, but your list and your archive live on someone else's terms. Self-hosting gives you control, but usually means a server to look after.

Writestead tries to give you both. It's a single Cloudflare Worker with D1, R2 and Queues, so there's no server to patch, and a personal blog fits in Cloudflare's free plan.

What's in it:
- A Markdown editor with live preview, image drag and drop, embeds and revision history
- Newsletters with double opt-in, segments and open and click stats
- Paid memberships with your own Stripe account, and no revenue share
- Cookieless analytics: visitors, referrers, opens, clicks, churn and MRR
- 10 themes you can tweak without code
- Import from Ghost, WordPress, Substack, Medium and Markdown. Export everything, anytime.

You can poke around the demo at demo.writestead.com (the dashboard is open in read-only mode). I'd love to hear what's missing for you to move your blog over.

**Topics:** Writing, Newsletters, Open Source, Developer Tools

## Launch thread for X

1/
Today I'm launching Writestead: an open source blog, newsletter and paid membership platform that runs on Cloudflare.

Start free at writestead.com, or deploy your own copy in one click.

2/
Why? Writers keep choosing between easy and owned.

Hosted platforms are easy, but your list and archive live on their terms. Self-hosting means a server to babysit.

Writestead is one Cloudflare Worker. No server. A personal blog fits in the free plan.

3/
The editor is Markdown with live preview. Drag in images, paste a YouTube, X, CodePen or gist link to embed it, and code blocks come out highlighted. Autosave and revision history included.

4/
Every post can go out as a newsletter. Double opt-in, signup widget, welcome email, segments, email-only posts. Sending runs through Cloudflare Queues.

5/
Paid memberships use your own Stripe account. Free and paid tiers, members-only posts, and a "preview, then paywall" split. No cut of your revenue.

6/
Analytics without cookies: visitors, top posts, referrers, countries, devices, UTM. Plus opens, clicks, subscriber growth, churn and MRR.

7/
10 themes. Change colors, fonts, logo and layout from the dashboard and preview before you switch.

8/
No lock-in. Import from Ghost, WordPress, Substack, Medium or Markdown. Export JSON, Markdown or CSV whenever you want.

9/
It's AGPL and the hosted version runs the same code.

Demo: demo.writestead.com
Code: github.com/onmyway133/writestead
Start: writestead.com

## Show HN

**Title:** Show HN: Writestead, an open source Ghost/Substack alternative on Cloudflare Workers

**Text:**

Hi HN, I built Writestead, a blog plus newsletter plus paid membership platform that runs as a single Cloudflare Worker.

Stack: Hono on Workers renders the public blog as plain HTML (no client framework on the reader side), D1 for data, R2 for images, KV for sign-in links and a daily analytics salt, Queues for newsletter sending, Cron Triggers for scheduled posts. The dashboard is a React app served as static assets. The Worker applies its own D1 migrations on the first request, so the Deploy to Cloudflare button is the whole install.

Some details that might interest you:

- Analytics are cookieless. A visitor is sha256(daily random salt + site + IP + user agent), truncated, and the salt lives in KV with a two day TTL, so the same person can't be linked across days.
- Paid posts split at a `<!--paywall-->` marker. The server only ever renders the part above it for non-members, in pages, RSS, the API and emails.
- Importers for Ghost, WordPress WXR, Substack and Medium exports run in the browser (fflate for ZIPs), so a large archive never hits Worker CPU limits. Images are then copied into R2 one request at a time.
- The same code runs single-tenant for self-hosters and multi-tenant on subdomains for the hosted version, switched by one env var.

It's AGPL-3.0. Things that are still missing are listed honestly in TASKS.md (PayPal, generated OG images, Pro billing on the hosted side).

Demo with a read-only dashboard: https://demo.writestead.com
Code: https://github.com/onmyway133/writestead

I'd love feedback, especially from anyone who has moved a newsletter between platforms.

## Announcement post

The announcement is published at https://blog.writestead.com/introducing-writestead. Its source is in `scripts/seed/content.mjs` (`FLAGSHIP.posts[0]`).
