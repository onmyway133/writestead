import { ArrowSquareOut, ChartLineUp, CheckCircle, Circle, CurrencyDollar, DownloadSimple, EnvelopeOpen, Eye, Note, PaintBrush, PencilSimple, Plus, ShareNetwork, UserPlus, Users } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import type { PostSummary } from "../../shared/types";
import { AreaChart, fillDays } from "../components/charts/AreaChart";
import { KpiCard } from "../components/charts/Sparkline";
import type { Analytics } from "../components/audience/types";
import { ErrorState } from "../components/EmptyState";
import { CardsSkeleton } from "../components/Skeleton";
import { StatusPill } from "../components/StatusPill";
import { toast } from "../components/Toast";
import { api, errorMessage } from "../lib/api";
import { change, money, number, percent, timeAgo } from "../lib/format";
import { navigate } from "../lib/router";
import { canManageSettings, canManageSubscribers, useSession } from "../lib/session";
import { useApi } from "../lib/useApi";

function greeting(): string
{
    const hour = new Date().getHours();
    return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

export async function newPost(type: "post" | "page" = "post")
{
    try
    {
        const { post } = await api<{ post: { id: string } }>("/admin/posts", { body: { type, title: "" } });
        navigate(`/admin/editor/${post.id}`);
    }
    catch (error)
    {
        toast(errorMessage(error), "error");
    }
}

export function DashboardScreen()
{
    const { me } = useSession();
    const stats = useApi<Analytics>("/admin/analytics?days=30");
    const posts = useApi<{ posts: PostSummary[] }>("/admin/posts");
    const firstName = me.user.name.split(" ")[0];

    const data = stats.data;
    const recent = posts.data?.posts.slice(0, 5) ?? [];
    const published = posts.data?.posts.filter((post) => post.status === "published").length ?? 0;
    const visitors = data ? fillDays(data.web.series, data.days, (row) => ({ value: row?.visitors ?? 0, secondary: row?.views ?? 0 })) : [];

    const checklist = [
        { done: published > 0, label: "Publish your first post", text: "Say hello. A short post is fine.", action: () => newPost(), icon: <PencilSimple /> },
        { done: me.site.settings.theme !== "stead" || me.site.settings.accent !== "", label: "Make it yours", text: "Pick a theme, an accent color and a logo.", action: () => navigate("/admin/themes"), icon: <PaintBrush />, hidden: !canManageSettings(me) },
        { done: (data?.members.active ?? 0) > 0, label: "Get your first subscriber", text: "Share the subscribe page or embed the signup form.", action: () => navigate("/admin/settings/members"), icon: <Users /> },
        { done: (data?.web.visitors ?? 0) > 10, label: "Share your blog", text: "Post the link where your readers hang out.", action: () => void navigator.clipboard?.writeText(me.url).then(() => toast("Link copied")), icon: <ShareNetwork /> },
    ].filter((item) => !item.hidden);
    const showChecklist = posts.data !== undefined && checklist.some((item) => !item.done);

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <p className="muted text-sm">{greeting()}, {firstName}</p>
                    <h1 className="text-2xl font-semibold tracking-tight">{me.site.title}</h1>
                </div>
                <div className="flex flex-wrap gap-2">
                    <a className="btn-secondary" href={me.url || "/"} target="_blank" rel="noopener"><ArrowSquareOut className="size-4" />View site</a>
                    <button type="button" className="btn-primary" onClick={() => void newPost()}><Plus weight="bold" className="size-4" />New post</button>
                </div>
            </div>

            {stats.error
                ? <ErrorState message={stats.error} onRetry={stats.reload} />
                : !data
                    ? <CardsSkeleton />
                    : (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            <KpiCard icon={<Eye />} label="Visitors, 30 days" value={number(data.web.visitors)} change={change(data.web.visitors, data.web.previous.visitors)} spark={visitors.map((point) => point.value)} />
                            <KpiCard icon={<Users />} label="Subscribers" value={number(data.members.active)} hint={`${number(data.members.paid)} paid, ${number(data.members.pending)} waiting to confirm`} />
                            <KpiCard icon={<EnvelopeOpen />} label="Open rate" value={data.newsletters.sent ? percent(data.newsletters.openRate) : "No sends"} hint={`${number(data.newsletters.sent)} newsletters in 30 days`} />
                            <KpiCard icon={<CurrencyDollar />} label="Monthly revenue" value={data.members.mrr === null ? "Pro" : money(data.members.mrr)} hint={data.members.mrr === null ? "Paid memberships are part of Pro" : `${number(data.members.upgraded)} new paid members`} />
                        </div>
                    )}

            {showChecklist && (
                <section className="card p-5" aria-label="Getting started">
                    <div className="mb-4 flex items-center justify-between gap-3">
                        <div>
                            <h2 className="text-base font-semibold">Get your blog off the ground</h2>
                            <p className="muted text-sm">{checklist.filter((item) => item.done).length} of {checklist.length} done</p>
                        </div>
                        <div className="h-2 w-32 overflow-hidden rounded-full bg-zinc-100 dark:bg-white/8" aria-hidden="true">
                            <div className="h-full rounded-full bg-brand transition-[width] duration-500" style={{ width: `${(checklist.filter((item) => item.done).length / checklist.length) * 100}%` }} />
                        </div>
                    </div>
                    <ul className="grid gap-2 sm:grid-cols-2">
                        {checklist.map((item) => (
                            <li key={item.label}>
                                <button type="button" onClick={item.action} className={`flex w-full items-start gap-3 rounded-xl p-3 text-left transition-colors duration-200 hover:bg-zinc-50 dark:hover:bg-white/4 ${item.done ? "opacity-60" : ""}`}>
                                    <span className={`mt-0.5 [&_svg]:size-5 ${item.done ? "text-emerald-500" : "text-zinc-300 dark:text-zinc-600"}`}>{item.done ? <CheckCircle weight="fill" /> : <Circle />}</span>
                                    <span className="min-w-0">
                                        <span className={`block text-sm font-medium ${item.done ? "line-through" : ""}`}>{item.label}</span>
                                        <span className="muted block text-xs">{item.text}</span>
                                    </span>
                                    <span className="ml-auto text-brand [&_svg]:size-4">{item.icon}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            <div className="grid gap-6 lg:grid-cols-3">
                <section className="card p-5 lg:col-span-2" aria-label="Visitors">
                    <div className="mb-4 flex items-center justify-between">
                        <div>
                            <h2 className="text-base font-semibold">Visitors</h2>
                            <p className="muted text-xs">Last 30 days, cookieless</p>
                        </div>
                        <button type="button" className="btn-ghost btn-sm" onClick={() =>
                        {
                            navigate("/admin/analytics");
                        }}><ChartLineUp className="size-4" />Analytics</button>
                    </div>
                    {data ? <AreaChart points={visitors} label="Visitors per day" valueLabel="Visitors" secondaryLabel="Views" /> : <div className="skeleton h-[200px]" />}
                </section>

                <section className="card flex flex-col p-5" aria-label="Quick actions">
                    <h2 className="mb-3 text-base font-semibold">Quick actions</h2>
                    <div className="flex flex-col gap-1">
                        <QuickAction icon={<Note />} title="Write a post" text="Start a new draft" onClick={() => void newPost()} />
                        <QuickAction icon={<ArrowSquareOut />} title="View your site" text={me.url.replace(/^https?:\/\//, "")} href={me.url || "/"} />
                        {canManageSettings(me) && <QuickAction icon={<UserPlus />} title="Invite a writer" text="Add editors and authors" onClick={() => navigate("/admin/settings/team")} />}
                        {canManageSettings(me) && <QuickAction icon={<DownloadSimple />} title="Import content" text="From Ghost, WordPress, Substack, Medium" onClick={() => navigate("/admin/settings/import")} />}
                        {canManageSubscribers(me) && <QuickAction icon={<Users />} title="Subscribers" text={data ? `${number(data.members.active)} active` : "Manage your list"} onClick={() => navigate("/admin/subscribers")} />}
                    </div>
                </section>
            </div>

            <section className="card p-2" aria-label="Recent posts">
                <div className="flex items-center justify-between px-3 pt-3 pb-2">
                    <h2 className="text-base font-semibold">Recent posts</h2>
                    <button type="button" className="btn-ghost btn-sm" onClick={() =>
                    {
                        navigate("/admin/posts");
                    }}>All posts</button>
                </div>
                {posts.error && <div className="p-3"><ErrorState message={posts.error} onRetry={posts.reload} /></div>}
                {!posts.data && !posts.error && (
                    <div className="flex flex-col gap-2 p-3" role="status" aria-label="Loading">
                        {[0, 1, 2].map((index) => <div key={index} className="skeleton h-12" />)}
                    </div>
                )}
                {posts.data && recent.length === 0 && (
                    <div className="flex flex-col items-center px-6 py-10 text-center">
                        <div className="flex size-12 items-center justify-center rounded-2xl bg-brand/10 text-brand"><PencilSimple className="size-6" /></div>
                        <p className="mt-3 text-sm font-semibold">No posts yet</p>
                        <p className="muted mt-1 text-sm">Your first post is one click away.</p>
                        <button type="button" className="btn-primary mt-4" onClick={() => void newPost()}>Write your first post</button>
                    </div>
                )}
                <ul>
                    {recent.map((post) => (
                        <li key={post.id}>
                            <a
                                href={`/admin/editor/${post.id}`}
                                onClick={(event) =>
                                {
                                    event.preventDefault();
                                    navigate(`/admin/editor/${post.id}`);
                                }}
                                className="flex items-center gap-3 rounded-xl p-3 transition-colors duration-200 hover:bg-zinc-50 dark:hover:bg-white/4"
                            >
                                {post.cover_image
                                    ? <img src={post.cover_image} alt="" className="size-11 shrink-0 rounded-lg object-cover" />
                                    : <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-brand/8 text-brand dark:bg-brand/15"><Note className="size-5" /></span>}
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-medium">{post.title || "Untitled"}</span>
                                    <span className="muted block truncate text-xs">{post.authors || "No author"} · {post.published_at ? timeAgo(post.published_at) : `edited ${timeAgo(post.updated_at)}`}</span>
                                </span>
                                <StatusPill status={post.status} />
                            </a>
                        </li>
                    ))}
                </ul>
            </section>
        </div>
    );
}

function QuickAction({ icon, title, text, onClick, href }: { icon: ReactNode; title: string; text: string; onClick?: () => void; href?: string })
{
    const body = (
        <>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand/8 text-brand dark:bg-brand/15 [&_svg]:size-[18px]">{icon}</span>
            <span className="min-w-0">
                <span className="block text-sm font-medium">{title}</span>
                <span className="muted block truncate text-xs">{text}</span>
            </span>
        </>
    );
    const className = "flex items-center gap-3 rounded-xl p-2 text-left transition-colors duration-200 hover:bg-zinc-50 dark:hover:bg-white/4";
    return href
        ? <a className={className} href={href} target="_blank" rel="noopener">{body}</a>
        : <button type="button" className={className} onClick={onClick}>{body}</button>;
}
