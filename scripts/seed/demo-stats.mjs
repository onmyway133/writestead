// Prints SQL with made-up readers, page views, newsletter sends and comments for the demo blog,
// so its dashboard has something to show. Only for the demo; every row is fictional.
//
//   node scripts/seed/demo-stats.mjs <site-id> > /tmp/demo-stats.sql
//   npx wrangler d1 execute DB --remote --file /tmp/demo-stats.sql
import { randomBytes, randomUUID } from "node:crypto";

const siteId = process.argv[2];
if (!siteId || !/^[0-9a-f]{32}$/.test(siteId))
{
    console.error("Usage: node scripts/seed/demo-stats.mjs <site-id>");
    process.exit(1);
}

// A seeded random generator keeps the numbers stable between runs.
let state = 20261117;
function random()
{
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
}
function pick(items, weights)
{
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    let roll = random() * total;
    for (const [index, weight] of weights.entries())
    {
        roll -= weight;
        if (roll <= 0)
        {
            return items[index];
        }
    }
    return items.at(-1);
}
const id = () => randomUUID().replaceAll("-", "");
const quote = (value) => (value === null ? "NULL" : typeof value === "number" ? String(value) : `'${String(value).replaceAll("'", "''")}'`);
const now = Math.floor(Date.now() / 1000);
const day = 86400;
const out = [];

function insert(table, columns, rows)
{
    for (let index = 0; index < rows.length; index += 200)
    {
        out.push(`INSERT INTO ${table} (${columns.join(", ")}) VALUES\n${rows.slice(index, index + 200).map((row) => `(${row.map(quote).join(", ")})`).join(",\n")};`);
    }
}

const paths = [
    ["/", 30], ["/the-quiet-joy-of-a-slow-morning", 22], ["/what-i-learned-writing-100-newsletters", 18], ["/a-tiny-guide-to-markdown-for-writers", 14],
    ["/notes-from-a-week-without-notifications", 9], ["/my-writing-setup-in-2026", 8], ["/how-i-plan-a-month-of-posts", 6], ["/about", 5], ["/archive", 3], ["/welcome-to-field-notes", 2],
];
const referrers = [["", 38], ["news.ycombinator.com", 14], ["google.com", 16], ["bsky.app", 7], ["mastodon.social", 5], ["reddit.com", 6], ["duckduckgo.com", 4], ["substack.com", 2]];
const countries = [["US", 34], ["GB", 10], ["DE", 9], ["SE", 7], ["CA", 6], ["NL", 5], ["FR", 5], ["AU", 4], ["IN", 5], ["JP", 3], ["BR", 3], ["VN", 2]];
const devices = [["desktop", 58], ["mobile", 37], ["tablet", 5]];
const utm = [["", 85], ["newsletter", 10], ["bluesky", 3], ["hn", 2]];

const views = [];
for (let daysAgo = 89; daysAgo >= 0; daysAgo--)
{
    const growth = 1 + (89 - daysAgo) / 60;
    const weekday = new Date((now - daysAgo * day) * 1000).getUTCDay();
    const base = Math.round((28 + random() * 18) * growth * (weekday === 0 ? 1.6 : weekday === 6 ? 0.8 : 1));
    const visitors = Array.from({ length: Math.ceil(base * 0.7) }, () => randomBytes(8).toString("hex"));
    for (let view = 0; view < base; view++)
    {
        const at = now - daysAgo * day - Math.floor(random() * day);
        if (at > now)
        {
            continue;
        }
        views.push([siteId, at, pick(paths.map((path) => path[0]), paths.map((path) => path[1])), null, visitors[Math.floor(random() * visitors.length)],
            pick(referrers.map((item) => item[0]), referrers.map((item) => item[1])), pick(countries.map((item) => item[0]), countries.map((item) => item[1])),
            pick(devices.map((item) => item[0]), devices.map((item) => item[1])), pick(utm.map((item) => item[0]), utm.map((item) => item[1]))]);
    }
}
insert("pageviews", ["site_id", "created_at", "path", "post_id", "visitor", "referrer", "country", "device", "utm_source"], views);

const first = ["Ana", "Ben", "Chloe", "Dev", "Elif", "Finn", "Grace", "Hugo", "Iris", "Jonas", "Kofi", "Lena", "Mateo", "Nora", "Omar", "Priya", "Quinn", "Rosa", "Sam", "Tariq", "Uma", "Viktor", "Wen", "Yara", "Zoe"];
const last = ["Berg", "Costa", "Dubois", "Eriksen", "Fischer", "Garcia", "Hall", "Ito", "Jensen", "Khan", "Lopez", "Moreau", "Nguyen", "Okafor", "Park", "Rossi", "Silva", "Tanaka", "Weber", "Young"];
const sources = [["home", 30], ["post", 40], ["subscribe-page", 15], ["embed", 8], ["import", 7]];
const subscribers = [];
const events = [];
for (let index = 0; index < 412; index++)
{
    const created = now - Math.floor(Math.pow(random(), 0.7) * 120 * day);
    const name = `${first[Math.floor(random() * first.length)]} ${last[Math.floor(random() * last.length)]}`;
    const roll = random();
    const status = roll < 0.06 ? "unsubscribed" : roll < 0.09 ? "pending" : "active";
    const paid = status === "active" && random() < 0.08;
    const subscriberId = id();
    subscribers.push([subscriberId, siteId, `reader${index + 1}@example.com`, name, status, paid ? "paid" : "free", random() < 0.2 ? "early-reader" : "",
        pick(sources.map((item) => item[0]), sources.map((item) => item[1])), randomBytes(24).toString("hex"), paid ? created + 5 * day : null, paid ? 600 : 0, "usd", paid ? "month" : "",
        created, status === "pending" ? null : created + 600, status === "unsubscribed" ? created + 20 * day : null]);
    if (status !== "pending")
    {
        events.push([siteId, subscriberId, "subscribed", 0, created + 600]);
    }
    if (status === "unsubscribed" && created + 20 * day < now)
    {
        events.push([siteId, subscriberId, "unsubscribed", 0, created + 20 * day]);
    }
    if (paid && created + 5 * day < now)
    {
        events.push([siteId, subscriberId, "upgraded", 600, created + 5 * day]);
    }
}
insert("subscribers", ["id", "site_id", "email", "name", "status", "tier", "labels", "source", "token", "paid_since", "amount", "currency", "interval", "created_at", "confirmed_at", "unsubscribed_at"], subscribers);
insert("member_events", ["site_id", "subscriber_id", "type", "amount", "created_at"], events);

const sends = [["The quiet joy of a slow morning", 2, 0.61, 0.14], ["What I learned writing 100 newsletters", 9, 0.57, 0.19], ["A tiny guide to Markdown for writers", 15, 0.52, 0.23], ["Notes from a week without notifications", 22, 0.55, 0.09]];
const emailRows = [];
const emailEvents = [];
const active = subscribers.filter((row) => row[4] === "active");
for (const [subject, daysAgo, openRate, clickRate] of sends)
{
    const emailId = id();
    const recipients = active.filter((row) => row[13] < now - daysAgo * day);
    emailRows.push([emailId, siteId, null, subject, "all", "sent", recipients.length, recipients.length, 0, now - daysAgo * day]);
    for (const row of recipients)
    {
        if (random() < openRate)
        {
            emailEvents.push([emailId, row[0], "open", "", now - daysAgo * day + Math.floor(random() * 2 * day)]);
            if (random() < clickRate / openRate)
            {
                emailEvents.push([emailId, row[0], "click", pick(["https://demo.writestead.com/" + subject.toLowerCase().replace(/[^a-z0-9]+/g, "-"), "https://www.youtube.com/watch?v=gTaJhjQHcf8", "https://writestead.com"], [70, 20, 10]), now - daysAgo * day + Math.floor(random() * 2 * day)]);
            }
        }
    }
}
insert("emails", ["id", "site_id", "post_id", "subject", "segment", "status", "recipients", "delivered", "failed", "created_at"], emailRows);
insert("email_events", ["email_id", "subscriber_id", "type", "url", "created_at"], emailEvents);

const comments = [
    ["the-quiet-joy-of-a-slow-morning", "Priya Khan", "Tried this for three days now. The radiator detail made me laugh because mine does the exact same thing.", "approved"],
    ["the-quiet-joy-of-a-slow-morning", "Jonas Weber", "Phone in another room is the whole trick, isn't it. Thanks for the nudge.", "approved"],
    ["what-i-learned-writing-100-newsletters", "Rosa Silva", "Number 2 changed how I write my own letters. Congrats on 100!", "approved"],
    ["a-tiny-guide-to-markdown-for-writers", "Ben Hall", "Sending this to my whole writing group.", "approved"],
    ["notes-from-a-week-without-notifications", "Yara Okafor", "Did you keep any app notifications on after the week?", "pending"],
];
out.push(...comments.map(([slug, name, body, status], index) =>
    `INSERT INTO comments (id, site_id, post_id, name, body, status, created_at) SELECT ${quote(id())}, ${quote(siteId)}, id, ${quote(name)}, ${quote(body)}, ${quote(status)}, ${now - (index + 1) * 3600 * 7} FROM posts WHERE site_id = ${quote(siteId)} AND slug = ${quote(slug)};`));

console.log(out.join("\n"));
