import type { Entitlements } from "./plans";
import type { SiteSettings } from "./settings";

export type Role = "owner" | "admin" | "editor" | "author" | "contributor";

export type User = { id: string; email: string; name: string; slug: string; bio: string; avatar: string; website: string };

export type Site = {
    id: string;
    subdomain: string | null;
    custom_domain: string | null;
    title: string;
    description: string;
    plan: "free" | "pro" | "teams";
    status: "live" | "waitlist";
    is_demo: number;
    created_at: number;
};

export type SiteWithSettings = Site & { settings: SiteSettings };

export type PostStatus = "draft" | "scheduled" | "published" | "unlisted";

export type PostSummary = {
    id: string;
    type: "post" | "page";
    title: string;
    slug: string;
    excerpt: string;
    cover_image: string;
    status: PostStatus;
    visibility: "public" | "members" | "paid";
    featured: number;
    delivery: "web" | "both" | "email";
    published_at: number | null;
    emailed_at: number | null;
    updated_at: number;
    authors: string;
    tags: string;
};

export type Post = PostSummary & {
    content: string;
    meta_title: string;
    meta_description: string;
    canonical_url: string;
    og_image: string;
    email_segment: string;
    author_ids: string[];
    tag_names: string[];
};

export type Me = {
    user: User;
    role: Role;
    site: SiteWithSettings;
    entitlements: Entitlements;
    mode: "single" | "multi";
    url: string;
};
