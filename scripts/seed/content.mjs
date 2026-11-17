// Sample content for scripts/seed.mjs. Field Notes and its writer are fictional.

export const DEMO = {
    subdomain: "demo",
    title: "Field Notes",
    description: "A weekly letter about writing, attention and building a calmer creative life.",
    author: {
        name: "Mara Lindqvist",
        slug: "mara",
        bio: "Writer and former product designer. I send Field Notes every Sunday from a small flat full of plants.",
    },
    settings: {
        theme: "stead",
        layout: "list",
        accent: "",
        commentsMode: "all",
        paidEnabled: false,
        subscribeTitle: "Get Field Notes every Sunday",
        subscribeText: "One short letter a week about writing and paying attention. Free, and easy to leave.",
        navigation: [
            { label: "Home", url: "/" },
            { label: "Essays", url: "/tag/essays" },
            { label: "Guides", url: "/tag/guides" },
            { label: "Archive", url: "/archive" },
            { label: "About", url: "/about" },
        ],
        social: { x: "", github: "", mastodon: "", bluesky: "", instagram: "", linkedin: "" },
    },
    pages: [
        {
            title: "About",
            slug: "about",
            content: `Hi, I'm Mara. I spent eight years designing apps that wanted your attention, and now I write about getting it back.

**Field Notes** is a weekly letter about writing, focus and making things slowly. Most issues are short. Some are long. All of them are written by a person, at a kitchen table, usually with too much coffee.

## What you'll find here

- **Essays** about attention, habits and the creative life
- **Guides** for writers who want to publish on their own terms
- **Members-only notes** where I share drafts, plans and the messy parts

## Say hello

Reply to any newsletter. I read every email, even if it takes me a week to answer.

*This is a demo blog for [Writestead](https://writestead.com). Mara is fictional, but every feature you see here is real.*`,
        },
    ],
    posts: [
        {
            title: "The quiet joy of a slow morning",
            slug: "the-quiet-joy-of-a-slow-morning",
            excerpt: "I used to check three apps before I got out of bed. This winter I tried something different, and it changed how I write.",
            cover: "slow-morning.webp",
            tags: ["Essays", "Attention"],
            featured: true,
            daysAgo: 2,
            content: `For years, my mornings started with a glowing rectangle. Email, then messages, then whatever the algorithm decided I should care about before breakfast.

By the time I sat down to write, my head was full of other people's sentences.

## The experiment

In January I made one rule: **no screens until I've written something by hand.** Not a page. Not a goal. Just something.

The first week was hard. I'd reach for my phone without thinking, the way you reach for a light switch in a dark room. The second week, I started noticing things. The radiator ticks before it warms up. The light on the wall moves about a hand's width every ten minutes.

> Attention is the beginning of devotion.
> (Mary Oliver)

## What changed

I didn't become a morning person. I didn't write a novel. But three things happened:

1. My first sentences of the day became *mine* again.
2. I stopped starting the day already behind.
3. Ideas I'd scribble at 7am kept turning into Sunday letters.

## Try it for a week

You don't need a ritual or a fancy notebook. Put the phone in another room, make something warm to drink, and write one sentence about what you see.

That's it. Tell me how it goes.`,
        },
        {
            title: "What I learned writing 100 newsletters",
            slug: "what-i-learned-writing-100-newsletters",
            excerpt: "Consistency beats brilliance, short beats long, and your readers want to hear from a person, not a brand.",
            cover: "letters.webp",
            tags: ["Writing"],
            featured: true,
            daysAgo: 9,
            content: `Last Sunday I sent issue 100. Here's what two years of weekly letters taught me.

## 1. Show up on the same day

Readers build a habit around you. When I moved from "whenever" to "every Sunday," replies doubled. The day matters less than keeping it.

## 2. Write to one person

Every letter starts with a real reader in mind. Not "my audience." One person who wrote back once and said the thing I wrote helped.

## 3. Short is a kindness

My most-opened issues are under 500 words. A long letter is fine when it earns it. Most don't need to.

## 4. Own your list

I've moved platforms twice. Both times the thing that mattered was having my subscribers and my archive in a file I could take with me. Now I publish on my own domain and export everything once a month, just because I can.

## 5. Ask questions

Ending with a question turned my newsletter from a broadcast into a conversation. So:

**What's one thing you'd want me to write about next?**`,
        },
        {
            title: "A tiny guide to Markdown for writers",
            slug: "a-tiny-guide-to-markdown-for-writers",
            excerpt: "Everything you need to format a post with plain text, in five minutes. No code experience needed.",
            cover: "desk.webp",
            tags: ["Guides", "Writing"],
            daysAgo: 15,
            content: `Markdown is a way to format text with plain characters. You type a few symbols and your words come out bold, linked or turned into lists. It's how I write every post here.

## The basics

| You type | You get |
|---|---|
| \`**bold**\` | **bold** |
| \`*italic*\` | *italic* |
| \`[a link](https://example.com)\` | [a link](https://example.com) |
| \`> a quote\` | a block quote |
| \`- item\` | a bullet list |

## Headings

Start a line with \`#\` signs. Two for a section, three for a smaller one:

\`\`\`markdown
## A section
### A smaller section
\`\`\`

## Code, if you need it

Wrap code in three backticks and name the language. It gets highlighted:

\`\`\`js
function greet(name) {
    return \`Hello, \${name}!\`;
}
\`\`\`

## Embeds

Paste a YouTube, X, CodePen or GitHub gist link on its own line and it turns into an embed. No buttons, no menus.

## One more trick

Put \`<!--paywall-->\` on its own line and everything after it is only for members. Everything before it becomes a free preview.

That's honestly all you need. Go write something.`,
        },
        {
            title: "Notes from a week without notifications",
            slug: "notes-from-a-week-without-notifications",
            excerpt: "I turned off every notification on my phone for seven days. Nothing broke. A few things got better.",
            tags: ["Essays", "Attention"],
            daysAgo: 22,
            content: `On Monday I went into Settings and switched off every notification. Every single one. Here's the log.

**Monday.** Checked my phone 41 times out of habit. Nothing was there, which felt like a small loss each time.

**Tuesday.** Missed a message from my sister for four hours. She survived. So did I.

**Wednesday.** Wrote for 90 minutes straight for the first time in months.

**Thursday.** Noticed I was checking less. Started leaving the phone on the shelf by the door.

**Friday.** A friend asked if I was okay because I replied slowly. I said yes, better than okay.

**Weekend.** Read a whole book. An actual paper one.

## What I kept

I turned two things back on: calls from family, and calendar alerts. Everything else can wait until I go looking for it.

The surprising part wasn't the quiet. It was how little I'd actually been missing.`,
        },
        {
            title: "My writing setup in 2026",
            slug: "my-writing-setup-in-2026",
            excerpt: "The tools, the desk and the one habit that matters more than both.",
            tags: ["Tools"],
            daysAgo: 30,
            content: `People ask about my setup more than anything else, so here it is. Fair warning: it's boring on purpose.

## Hardware

- An old laptop with the Wi-Fi off while drafting
- A small mechanical keyboard, because it sounds like progress
- A paper notebook for everything before the first draft

## Software

- A plain text editor for drafts
- My blog's editor for the final pass, since it shows the preview right next to the text
- A timer set to 45 minutes

## The habit

None of the tools matter as much as this: **I write first and edit later, on a different day.** Mixing the two is how I used to lose whole mornings.

Here's a short video about deep work that pushed me in this direction:

https://www.youtube.com/watch?v=gTaJhjQHcf8

What does your setup look like? Reply and tell me, I'm collecting them for a future issue.`,
        },
        {
            title: "How I plan a month of posts",
            slug: "how-i-plan-a-month-of-posts",
            excerpt: "My exact planning ritual: one hour, one wall calendar, and a list of questions readers sent me.",
            cover: "calendar.webp",
            tags: ["Writing", "Guides"],
            visibility: "members",
            daysAgo: 37,
            content: `On the last Sunday of every month I spend one hour planning the next four letters. It's the most useful hour of my month.

## Step one: empty the inbox of ideas

I keep a running list of everything readers ask me. Before planning I read it top to bottom and star anything that made me think "oh, I have opinions about that."

<!--paywall-->

## Step two: one theme per month

Four letters, one loose theme. It keeps the month coherent without making it feel like a course.

## Step three: the wall

Each idea gets a sticky note. I move them around the calendar until the order tells a story: a light start, the meatiest piece in week three, and something personal to close.

## Step four: draft the first lines only

I write the first sentence of each letter that evening. That's it. On writing day I never start from a blank page.

## The template

Here's the checklist I use, copy it if it helps:

1. What question am I answering?
2. Who asked it, or who needs it?
3. What's the one thing they should remember?
4. What will I ask them at the end?

Thanks for being a member. You make the free letters possible.`,
        },
        {
            title: "Welcome to Field Notes",
            slug: "welcome-to-field-notes",
            excerpt: "What this letter is, who it's for, and what to expect every Sunday.",
            tags: ["Announcements"],
            daysAgo: 60,
            content: `Hello, and welcome.

**Field Notes** is a weekly letter about writing, attention and building a calmer creative life. It arrives every Sunday morning. It's free, it's short, and you can leave any time with one click.

Some weeks I'll share an essay. Some weeks a practical guide. Once a month, members get my planning notes and the drafts that didn't make it.

If you'd like to say hi, reply to any email. It goes straight to me.

See you Sunday.

Mara`,
        },
    ],
};

export const FLAGSHIP = {
    subdomain: "blog",
    title: "Writestead Blog",
    description: "News, guides and changelogs from the team building Writestead.",
    author: {
        name: "Khoa Pham",
        slug: "khoa",
        bio: "Maker of Writestead. Writes code and, now and then, blog posts about it.",
        website: "https://writestead.com",
    },
    settings: {
        theme: "stead",
        layout: "list",
        accent: "#6e43f5",
        commentsMode: "all",
        subscribeTitle: "Get Writestead updates",
        subscribeText: "Release notes and guides, about once a month.",
        navigation: [
            { label: "Home", url: "/" },
            { label: "Writestead", url: "https://writestead.com" },
            { label: "Demo", url: "https://demo.writestead.com" },
            { label: "GitHub", url: "https://github.com/onmyway133/writestead" },
        ],
    },
    pages: [
        {
            title: "About",
            slug: "about",
            content: `This is the official blog of [Writestead](https://writestead.com), an open source platform for blogs, newsletters and paid memberships that runs on Cloudflare.

You're reading it on Writestead itself.`,
        },
    ],
    posts: [
        {
            title: "Introducing Writestead",
            slug: "introducing-writestead",
            excerpt: "An open source home for your blog, your newsletter and your paid members. Start free on writestead.com, or run your own copy on Cloudflare with one click.",
            cover: "gradient.webp",
            tags: ["Announcements"],
            featured: true,
            daysAgo: 0,
            content: `Today we're launching **Writestead**: a blog, a newsletter and paid memberships in one place, open source, built to run on Cloudflare.

## Why another blogging platform?

Writers keep getting stuck between two bad options. Hosted platforms are easy, but your list, your archive and your income live on someone else's terms. Self-hosting gives you control, but usually means a server to babysit.

Writestead tries to give you both. It's one Cloudflare Worker with a D1 database, an R2 bucket for images and a queue for email. There's no server to patch, and a personal blog fits in Cloudflare's free plan.

## What's in it

- **An editor that stays out of the way.** Markdown with live preview, drag and drop images, embeds for YouTube, X, CodePen and gists, highlighted code, autosave and revision history.
- **Newsletters built in.** Double opt-in forms, an embeddable signup widget, welcome emails, segments and email-only posts.
- **Paid memberships.** Free and paid tiers, members-only posts and preview-then-paywall, paid straight into your own Stripe account.
- **Analytics without cookies.** Visitors, top posts, referrers, countries, devices and UTM sources, plus opens, clicks, growth, churn and MRR.
- **Ten themes** you can tweak without code, with a live preview.
- **No lock-in.** Import from Ghost, WordPress, Substack, Medium or Markdown. Export everything as JSON, Markdown or CSV whenever you want.

## Two ways to use it

**Hosted:** grab \`yourname.writestead.com\` and start writing in a minute. The free plan is meant to be enough for a personal blog.

**Self-hosted:** click *Deploy to Cloudflare* on [GitHub](https://github.com/onmyway133/writestead) and you get your own copy with every feature unlocked. You pay Cloudflare for what you use, and nothing to us.

Want to look around first? The [demo blog](https://demo.writestead.com) runs the same code, and its dashboard is open in read-only mode.

## What's next

Writestead is young. Some things are rough, and some are still on the list, like PayPal checkout and generated social images. The [task list](https://github.com/onmyway133/writestead/blob/main/TASKS.md) is public, and issues and pull requests are welcome.

Thanks for reading, and happy writing.`,
        },
        {
            title: "Self-host Writestead on Cloudflare in five minutes",
            slug: "self-host-writestead-on-cloudflare",
            excerpt: "One button, one Cloudflare account, and your own blog with every feature unlocked.",
            tags: ["Guides"],
            daysAgo: 0,
            content: `Here's the whole process, start to finish.

## Before you start

- A Cloudflare account. The free plan works for a personal blog.
- R2 enabled once in the Cloudflare dashboard (Storage, then R2). Cloudflare may ask for a payment method even for the free tier.

## 1. Click the button

Open the [repository](https://github.com/onmyway133/writestead) and click **Deploy to Cloudflare**. Cloudflare copies the code into your GitHub account and creates the Worker, the D1 database, the R2 bucket, the KV namespace and the queue.

## 2. Fill in the secrets

The deploy screen asks for a few values. Only one matters on day one:

- \`OWNER_EMAIL\`: your email. Only this address can claim the blog.

Email sending (\`EMAIL_FROM\`) and bot protection (Turnstile) can wait.

## 3. Open /admin

Visit your Worker's URL plus \`/admin\` and create your account. The database sets itself up on the first request.

## 4. Add your domain

In the Cloudflare dashboard, open the Worker, then *Settings*, *Domains and Routes*, and add a custom domain. Cloudflare handles DNS and SSL.

## Prefer the command line?

\`\`\`bash
git clone https://github.com/onmyway133/writestead
cd writestead && npm install
npx wrangler login
npm run deploy
\`\`\`

That's it. Write something.`,
        },
    ],
};
