// Response shapes of the admin audience and analytics endpoints (src/worker/routes/admin/*).

export type NamedCount = { name: string; visitors: number };

export type Analytics = {
    days: number;
    maxDays: number;
    advanced: boolean;
    web: {
        views: number;
        visitors: number;
        previous: { views: number; visitors: number };
        series: { day: string; views: number; visitors: number }[];
        pages: { path: string; title: string; views: number; visitors: number }[];
        referrers: NamedCount[];
        countries: NamedCount[];
        devices: NamedCount[];
        utm: NamedCount[];
    };
    members: {
        active: number;
        free: number;
        paid: number;
        pending: number;
        mrr: number | null;
        startCount: number;
        series: { day: string; type: "subscribed" | "unsubscribed" | "upgraded" | "cancelled"; n: number; amount: number }[];
        subscribed: number;
        unsubscribed: number;
        upgraded: number;
        cancelled: number;
        newRevenue: number | null;
        lostRevenue: number | null;
        sources: NamedCount[];
    };
    newsletters: {
        sent: number;
        openRate: number;
        clickRate: number;
        emails: { id: string; subject: string; recipients: number; created_at: number; opens: number; clicks: number }[];
    };
};

export type Subscriber = {
    id: string;
    email: string;
    name: string;
    status: "pending" | "active" | "unsubscribed" | "bounced";
    tier: "free" | "paid" | "comp";
    labels: string;
    source: string;
    email_enabled: number;
    amount: number;
    currency: string;
    interval: string;
    created_at: number;
    confirmed_at: number | null;
    unsubscribed_at: number | null;
};

export type SubscriberList = {
    subscribers: Subscriber[];
    total: number;
    labels: string[];
    totals: { status: string; tier: string; n: number }[];
    limit: number;
};

export type EmailSend = {
    id: string;
    post_id: string | null;
    subject: string;
    segment: string;
    status: "sending" | "sent" | "failed";
    recipients: number;
    delivered: number;
    failed: number;
    created_at: number;
    opens: number;
    clicks: number;
};

export type Comment = {
    id: string;
    name: string;
    body: string;
    status: "pending" | "approved" | "spam";
    created_at: number;
    post_title: string;
    post_slug: string;
    email: string;
};
