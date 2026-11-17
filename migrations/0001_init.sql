-- Times are integer UTC seconds. Money is integer minor units. Booleans are 0/1.

CREATE TABLE sites (
    id TEXT PRIMARY KEY,
    subdomain TEXT UNIQUE,
    custom_domain TEXT UNIQUE,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    -- Theme, navigation, social links, code injection and other settings as JSON.
    settings TEXT NOT NULL DEFAULT '{}',
    plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro')),
    -- 'waitlist' shows a pre-launch page that only collects emails.
    status TEXT NOT NULL DEFAULT 'live' CHECK (status IN ('live', 'waitlist')),
    -- Demo sites refuse writes from the dashboard so visitors can look around safely.
    is_demo INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
);

CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    bio TEXT NOT NULL DEFAULT '',
    avatar TEXT NOT NULL DEFAULT '',
    website TEXT NOT NULL DEFAULT '',
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    created_at INTEGER NOT NULL
);

CREATE TABLE site_members (
    site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'editor', 'author', 'contributor')),
    created_at INTEGER NOT NULL,
    PRIMARY KEY (site_id, user_id)
);
CREATE INDEX site_members_user ON site_members(user_id);

CREATE TABLE sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
);
CREATE INDEX sessions_user ON sessions(user_id);

CREATE TABLE posts (
    id TEXT PRIMARY KEY,
    site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    type TEXT NOT NULL DEFAULT 'post' CHECK (type IN ('post', 'page')),
    title TEXT NOT NULL DEFAULT '',
    slug TEXT NOT NULL,
    excerpt TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL DEFAULT '',
    cover_image TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'published', 'unlisted')),
    -- Who can read the full post. 'paid' and 'members' posts show a preview up to the paywall marker.
    visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'members', 'paid')),
    featured INTEGER NOT NULL DEFAULT 0,
    -- 'web' only on the blog, 'both' also emailed, 'email' sent but not shown on the blog.
    delivery TEXT NOT NULL DEFAULT 'web' CHECK (delivery IN ('web', 'both', 'email')),
    -- Who gets the email when the post is published: 'all', 'free', 'paid' or 'label:<name>'.
    email_segment TEXT NOT NULL DEFAULT 'all',
    meta_title TEXT NOT NULL DEFAULT '',
    meta_description TEXT NOT NULL DEFAULT '',
    canonical_url TEXT NOT NULL DEFAULT '',
    og_image TEXT NOT NULL DEFAULT '',
    published_at INTEGER,
    emailed_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE (site_id, type, slug)
);
CREATE INDEX posts_site_status ON posts(site_id, type, status, published_at);

CREATE TABLE post_authors (
    post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sort INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (post_id, user_id)
);
CREATE INDEX post_authors_user ON post_authors(user_id);

CREATE TABLE tags (
    id TEXT PRIMARY KEY,
    site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    UNIQUE (site_id, slug)
);

CREATE TABLE post_tags (
    post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    sort INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (post_id, tag_id)
);
CREATE INDEX post_tags_tag ON post_tags(tag_id);

CREATE TABLE revisions (
    id TEXT PRIMARY KEY,
    post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id TEXT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL
);
CREATE INDEX revisions_post ON revisions(post_id, created_at);

CREATE TABLE media (
    id TEXT PRIMARY KEY,
    site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    key TEXT NOT NULL UNIQUE,
    filename TEXT NOT NULL,
    mime TEXT NOT NULL,
    size INTEGER NOT NULL,
    created_at INTEGER NOT NULL
);
CREATE INDEX media_site ON media(site_id, created_at);

CREATE TABLE subscribers (
    id TEXT PRIMARY KEY,
    site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'unsubscribed', 'bounced')),
    tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'paid', 'comp')),
    -- Comma separated labels used for segments.
    labels TEXT NOT NULL DEFAULT '',
    source TEXT NOT NULL DEFAULT '',
    -- Secret token for confirm, unsubscribe and the reader account link.
    token TEXT NOT NULL,
    email_enabled INTEGER NOT NULL DEFAULT 1,
    paid_since INTEGER,
    amount INTEGER NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'usd',
    interval TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    confirmed_at INTEGER,
    unsubscribed_at INTEGER,
    UNIQUE (site_id, email)
);
CREATE INDEX subscribers_site_status ON subscribers(site_id, status, created_at);
CREATE INDEX subscribers_token ON subscribers(token);

-- One row per newsletter send.
CREATE TABLE emails (
    id TEXT PRIMARY KEY,
    site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    post_id TEXT REFERENCES posts(id) ON DELETE SET NULL,
    subject TEXT NOT NULL,
    -- Who receives it: 'all', 'free', 'paid', or 'label:<name>'.
    segment TEXT NOT NULL DEFAULT 'all',
    status TEXT NOT NULL DEFAULT 'sending' CHECK (status IN ('sending', 'sent', 'failed')),
    recipients INTEGER NOT NULL DEFAULT 0,
    delivered INTEGER NOT NULL DEFAULT 0,
    failed INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
);
CREATE INDEX emails_site ON emails(site_id, created_at);

CREATE TABLE email_events (
    email_id TEXT NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
    subscriber_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('open', 'click')),
    url TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL
);
CREATE INDEX email_events_email ON email_events(email_id, type);

-- Cookieless page views. visitor is a daily-salted hash, so it can't follow anyone across days.
CREATE TABLE pageviews (
    site_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    path TEXT NOT NULL,
    post_id TEXT,
    visitor TEXT NOT NULL,
    referrer TEXT NOT NULL DEFAULT '',
    country TEXT NOT NULL DEFAULT '',
    device TEXT NOT NULL DEFAULT '',
    utm_source TEXT NOT NULL DEFAULT ''
);
CREATE INDEX pageviews_site_time ON pageviews(site_id, created_at);

-- Subscriber and membership changes, for growth, churn and revenue charts.
CREATE TABLE member_events (
    site_id TEXT NOT NULL,
    subscriber_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('subscribed', 'unsubscribed', 'upgraded', 'cancelled')),
    amount INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
);
CREATE INDEX member_events_site ON member_events(site_id, created_at);

CREATE TABLE comments (
    id TEXT PRIMARY KEY,
    site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    subscriber_id TEXT,
    name TEXT NOT NULL,
    body TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'spam')),
    created_at INTEGER NOT NULL
);
CREATE INDEX comments_post ON comments(post_id, status, created_at);
CREATE INDEX comments_site ON comments(site_id, status, created_at);

-- Payment accounts. A site can connect several Stripe and PayPal accounts.
CREATE TABLE payment_accounts (
    id TEXT PRIMARY KEY,
    site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN ('stripe', 'paypal')),
    label TEXT NOT NULL,
    -- Secret keys never go back to the browser; the API returns a masked hint.
    secret TEXT NOT NULL,
    public_key TEXT NOT NULL DEFAULT '',
    -- Stripe webhook signing secret for this account's endpoint (/api/webhooks/stripe/<id>).
    webhook_secret TEXT NOT NULL DEFAULT '',
    is_default INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
);

CREATE TABLE tiers (
    id TEXT PRIMARY KEY,
    site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    monthly_price INTEGER NOT NULL DEFAULT 0,
    yearly_price INTEGER NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'usd',
    benefits TEXT NOT NULL DEFAULT '',
    active INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL
);

CREATE TABLE api_keys (
    id TEXT PRIMARY KEY,
    site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    key_hash TEXT NOT NULL UNIQUE,
    hint TEXT NOT NULL,
    created_at INTEGER NOT NULL
);

CREATE TABLE webhooks (
    id TEXT PRIMARY KEY,
    site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    event TEXT NOT NULL,
    url TEXT NOT NULL,
    secret TEXT NOT NULL,
    created_at INTEGER NOT NULL
);
CREATE INDEX webhooks_site ON webhooks(site_id, event);
