-- Consecutive failed newsletter sends. Three in a row marks the subscriber as bounced.
ALTER TABLE subscribers ADD COLUMN failed_sends INTEGER NOT NULL DEFAULT 0;

-- Cloudflare for SaaS custom hostname id, so the hosted version can check and remove it.
ALTER TABLE sites ADD COLUMN custom_hostname_id TEXT;

-- Which follow-up emails each subscriber already got, so a step is never sent twice.
CREATE TABLE automation_sends (
    subscriber_id TEXT NOT NULL REFERENCES subscribers(id) ON DELETE CASCADE,
    step TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (subscriber_id, step)
);
