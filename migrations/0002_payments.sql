-- PayPal accounts can point at the sandbox or live API.
ALTER TABLE payment_accounts ADD COLUMN sandbox INTEGER NOT NULL DEFAULT 0;

-- PayPal needs a product and a billing plan per price. They're created on first checkout and reused
-- while the tier's price stays the same.
CREATE TABLE paypal_plans (
    account_id TEXT NOT NULL REFERENCES payment_accounts(id) ON DELETE CASCADE,
    tier_id TEXT NOT NULL REFERENCES tiers(id) ON DELETE CASCADE,
    interval TEXT NOT NULL CHECK (interval IN ('month', 'year')),
    amount INTEGER NOT NULL,
    currency TEXT NOT NULL,
    plan_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (account_id, tier_id, interval, amount, currency)
);
CREATE INDEX paypal_plans_plan ON paypal_plans(plan_id);

-- Which provider and account bills a paid member, so cancellations and the billing portal find them.
ALTER TABLE subscribers ADD COLUMN provider TEXT NOT NULL DEFAULT '';
ALTER TABLE subscribers ADD COLUMN payment_account_id TEXT NOT NULL DEFAULT '';
ALTER TABLE subscribers ADD COLUMN customer_id TEXT NOT NULL DEFAULT '';
ALTER TABLE subscribers ADD COLUMN subscription_id TEXT NOT NULL DEFAULT '';
CREATE INDEX subscribers_subscription ON subscribers(subscription_id);

-- Hosted version: the blog's own Pro or Teams subscription with the platform's Stripe account.
ALTER TABLE sites ADD COLUMN billing_customer_id TEXT NOT NULL DEFAULT '';
ALTER TABLE sites ADD COLUMN billing_subscription_id TEXT NOT NULL DEFAULT '';
ALTER TABLE sites ADD COLUMN billing_interval TEXT NOT NULL DEFAULT '';
