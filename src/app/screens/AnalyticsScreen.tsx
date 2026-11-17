import { ChartLineUp, CurrencyDollar, EnvelopeOpen, Eye, Lock, Users } from "@phosphor-icons/react";
import { useMemo } from "react";
import { AreaChart, fillDays } from "../components/charts/AreaChart";
import { BarList, countryName, flag } from "../components/charts/BarList";
import { KpiCard } from "../components/charts/Sparkline";
import { ProHint } from "../components/audience/ProHint";
import type { Analytics } from "../components/audience/types";
import { ErrorState } from "../components/EmptyState";
import { PageHeader } from "../components/PageHeader";
import { ProBadge } from "../components/ProBadge";
import { CardsSkeleton } from "../components/Skeleton";
import { change, formatDate, money, number, percent } from "../lib/format";
import { useQueryParam } from "../lib/router";
import { useApi } from "../lib/useApi";

const RANGES = [7, 30, 90, 365];
const TABS = [
    { id: "web", label: "Web traffic", icon: <Eye /> },
    { id: "newsletter", label: "Newsletter", icon: <EnvelopeOpen /> },
    { id: "members", label: "Members and revenue", icon: <Users /> },
] as const;

export function AnalyticsScreen()
{
    const [range, setRange] = useQueryParam("days", "30");
    const [tab, setTab] = useQueryParam("tab", "web");
    const days = Number(range) || 30;
    const { data, error, reload } = useApi<Analytics>(`/admin/analytics?days=${days}`);
    const maxDays = data?.maxDays ?? 3650;

    return (
        <div>
            <PageHeader
                title="Analytics"
                description="Cookieless and privacy friendly. Visitors are counted with a hash that resets every day."
                actions={
                    <div className="flex flex-wrap gap-1 rounded-xl bg-white p-1 shadow-[0_0_0_1px_rgb(21_18_43/0.06)] dark:bg-[#1f1f1f]" role="group" aria-label="Date range">
                        {RANGES.map((value) =>
                        {
                            const locked = value > maxDays;
                            return (
                                <button
                                    key={value}
                                    type="button"
                                    className="chip"
                                    aria-pressed={days === value}
                                    disabled={locked}
                                    title={locked ? "Longer history is part of Pro" : undefined}
                                    onClick={() =>
                                    {
                                        setRange(String(value));
                                    }}
                                >
                                    {value === 365 ? "12 months" : `${value} days`}
                                    {locked && <Lock className="size-3" />}
                                </button>
                            );
                        })}
                    </div>
                }
            />
            <div className="mb-6 flex gap-1 overflow-x-auto" role="tablist" aria-label="Report">
                {TABS.map((item) => (
                    <button
                        key={item.id}
                        type="button"
                        role="tab"
                        aria-selected={tab === item.id}
                        className="chip shrink-0 [&_svg]:size-4"
                        onClick={() =>
                        {
                            setTab(item.id);
                        }}
                    >
                        {item.icon}{item.label}
                    </button>
                ))}
            </div>
            {error && <ErrorState message={error} onRetry={reload} />}
            {!data && !error && (
                <div className="flex flex-col gap-6">
                    <CardsSkeleton />
                    <div className="skeleton h-64" />
                </div>
            )}
            {data && tab === "web" && <WebReport data={data} />}
            {data && tab === "newsletter" && <NewsletterReport data={data} />}
            {data && tab === "members" && <MembersReport data={data} />}
            {data && data.days < days && (
                <p className="muted mt-4 flex items-center gap-2 text-sm">Showing the last {data.days} days. <ProBadge /> keeps your full history.</p>
            )}
        </div>
    );
}

function WebReport({ data }: { data: Analytics })
{
    const series = fillDays(data.web.series, data.days, (row) => ({ value: row?.visitors ?? 0, secondary: row?.views ?? 0 }));
    const visits = data.web.visitors;
    return (
        <div className="flex flex-col gap-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <KpiCard icon={<Users />} label="Unique visitors" value={number(visits)} change={change(visits, data.web.previous.visitors)} spark={series.map((point) => point.value)} />
                <KpiCard icon={<Eye />} label="Page views" value={number(data.web.views)} change={change(data.web.views, data.web.previous.views)} spark={series.map((point) => point.secondary ?? 0)} />
                <KpiCard icon={<ChartLineUp />} label="Views per visitor" value={visits ? (data.web.views / visits).toFixed(1) : "0"} />
                <KpiCard icon={<Users />} label="New subscribers" value={number(data.members.subscribed)} hint={visits ? `${percent(data.members.subscribed / visits)} of visitors` : undefined} />
            </div>
            <section className="card p-5" aria-label="Traffic over time">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-base font-semibold">Traffic</h2>
                    <div className="flex gap-4 text-xs">
                        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-brand" />Visitors</span>
                        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-amber-500" />Views</span>
                    </div>
                </div>
                <AreaChart points={series} label="Visitors and views per day" valueLabel="Visitors" secondaryLabel="Views" height={240} />
            </section>
            <div className="grid gap-4 lg:grid-cols-2">
                <BarList title="Top pages" valueLabel="Views" items={data.web.pages.map((page) => ({ key: page.path, label: page.title === page.path ? page.path : page.title, value: page.views, href: page.path }))} />
                <BarList title="Referrers" items={data.web.referrers.map((item) => ({ key: item.name, label: item.name, value: item.visitors }))} />
                <BarList title="Countries" items={data.web.countries.map((item) => ({ key: item.name, label: `${flag(item.name)}  ${countryName(item.name)}`, value: item.visitors }))} />
                <BarList title="Devices" items={data.web.devices.map((item) => ({ key: item.name, label: item.name ? item.name[0].toUpperCase() + item.name.slice(1) : "Unknown", value: item.visitors }))} />
                <BarList
                    title="UTM sources"
                    items={data.web.utm.map((item) => ({ key: item.name, label: item.name, value: item.visitors }))}
                    empty={data.advanced ? "Add ?utm_source=newsletter to your links to see campaigns here" : ""}
                    footer={data.advanced ? undefined : <ProHint text="Campaign and UTM tracking is part of Pro." />}
                />
            </div>
        </div>
    );
}

function NewsletterReport({ data }: { data: Analytics })
{
    const { newsletters } = data;
    const recipients = newsletters.emails.reduce((total, email) => total + email.recipients, 0);
    return (
        <div className="flex flex-col gap-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <KpiCard icon={<EnvelopeOpen />} label="Newsletters sent" value={number(newsletters.sent)} />
                <KpiCard icon={<Users />} label="Emails delivered" value={number(recipients)} />
                <KpiCard label="Average open rate" value={percent(newsletters.openRate)} />
                <KpiCard label="Average click rate" value={percent(newsletters.clickRate)} />
            </div>
            <section className="card overflow-hidden" aria-label="Sends">
                <h2 className="px-5 pt-5 text-base font-semibold">Sends in this period</h2>
                {newsletters.emails.length === 0
                    ? (
                        <div className="flex flex-col items-center px-6 py-12 text-center">
                            <div className="flex size-12 items-center justify-center rounded-2xl bg-brand/10 text-brand"><EnvelopeOpen className="size-6" /></div>
                            <p className="mt-3 text-sm font-semibold">No newsletters in this period</p>
                            <p className="muted mt-1 max-w-sm text-sm">Publish a post with “Web and email” to send it to your subscribers. Opens and clicks show up here.</p>
                        </div>
                    )
                    : (
                        <div className="overflow-x-auto">
                            <table className="table mt-2">
                                <thead><tr><th>Subject</th><th className="text-right">Recipients</th><th className="text-right">Opened</th><th className="text-right">Clicked</th></tr></thead>
                                <tbody>
                                    {newsletters.emails.map((email) => (
                                        <tr key={email.id}>
                                            <td>
                                                <p className="font-medium">{email.subject}</p>
                                                <p className="muted text-xs">{formatDate(email.created_at)}</p>
                                            </td>
                                            <td className="text-right tabular-nums">{number(email.recipients)}</td>
                                            <td className="text-right tabular-nums"><RateCell count={email.opens} total={email.recipients} /></td>
                                            <td className="text-right tabular-nums"><RateCell count={email.clicks} total={email.recipients} /></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
            </section>
        </div>
    );
}

export function RateCell({ count, total }: { count: number; total: number })
{
    const rate = total ? count / total : 0;
    return (
        <span className="inline-flex flex-col items-end">
            <span className="font-medium">{percent(rate)}</span>
            <span className="muted text-xs">{number(count)}</span>
        </span>
    );
}

function MembersReport({ data }: { data: Analytics })
{
    const { members } = data;
    const growth = useMemo(() =>
    {
        const byDay = new Map<string, number>();
        for (const event of members.series)
        {
            const delta = event.type === "subscribed" ? event.n : event.type === "unsubscribed" ? -event.n : 0;
            byDay.set(event.day, (byDay.get(event.day) ?? 0) + delta);
        }
        let running = members.startCount;
        return fillDays([...byDay.keys()].map((day) => ({ day })), data.days, (row) =>
        {
            running += row ? byDay.get(row.day) ?? 0 : 0;
            return { value: Math.max(0, running) };
        });
    }, [members, data.days]);
    const churn = members.startCount + members.subscribed ? members.unsubscribed / (members.startCount + members.subscribed) : 0;
    const conversion = members.free + members.upgraded ? members.upgraded / (members.free + members.upgraded) : 0;

    return (
        <div className="flex flex-col gap-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <KpiCard icon={<Users />} label="Active members" value={number(members.active)} hint={`${number(members.free)} free, ${number(members.paid)} paid`} spark={growth.map((point) => point.value)} />
                <KpiCard label="New in period" value={`+${number(members.subscribed)}`} hint={`${number(members.pending)} waiting to confirm`} />
                <KpiCard label="Churn" value={percent(churn)} hint={`${number(members.unsubscribed)} unsubscribed`} />
                <KpiCard label="Free to paid" value={percent(conversion)} hint={`${number(members.upgraded)} upgrades, ${number(members.cancelled)} cancellations`} />
            </div>
            <section className="card p-5" aria-label="Member growth">
                <h2 className="mb-4 text-base font-semibold">Member growth</h2>
                <AreaChart points={growth} label="Active members per day" valueLabel="Members" height={220} />
            </section>
            <div className="grid gap-4 lg:grid-cols-2">
                <section className="card flex flex-col gap-4 p-5" aria-label="Revenue">
                    <h2 className="text-base font-semibold">Revenue</h2>
                    {members.mrr === null
                        ? <ProHint text="Paid memberships and revenue analytics are part of Pro." />
                        : (
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                <Stat icon={<CurrencyDollar />} label="MRR" value={money(members.mrr)} />
                                <Stat label="New revenue" value={money(members.newRevenue ?? 0)} tone="good" />
                                <Stat label="Lost revenue" value={money(members.lostRevenue ?? 0)} tone="bad" />
                            </div>
                        )}
                </section>
                <BarList title="Signup sources" valueLabel="Subscribers" items={members.sources.map((item) => ({ key: item.name, label: item.name, value: item.visitors }))} empty="No signups in this period yet" />
            </div>
        </div>
    );
}

function Stat({ label, value, icon, tone }: { label: string; value: string; icon?: React.ReactNode; tone?: "good" | "bad" })
{
    return (
        <div className="rounded-xl bg-zinc-50 p-4 dark:bg-white/4">
            <p className="muted flex items-center gap-1 text-xs font-medium [&_svg]:size-3.5">{icon}{label}</p>
            <p className={`mt-1 text-xl font-semibold tabular-nums ${tone === "good" ? "text-emerald-600 dark:text-emerald-400" : tone === "bad" ? "text-red-600 dark:text-red-400" : ""}`}>{value}</p>
        </div>
    );
}
