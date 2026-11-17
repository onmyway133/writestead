import { EnvelopeSimple, Info, LinkSimple, PaperPlaneTilt } from "@phosphor-icons/react";
import { useState } from "react";
import type { EmailSend } from "../components/audience/types";
import { Dialog } from "../components/Dialog";
import { ErrorState } from "../components/EmptyState";
import { PageHeader } from "../components/PageHeader";
import { TableSkeleton } from "../components/Skeleton";
import { formatDate, number, percent } from "../lib/format";
import { navigate } from "../lib/router";
import { useSession } from "../lib/session";
import { useApi } from "../lib/useApi";
import { newPost } from "./DashboardScreen";

const STATUS_STYLE: Record<EmailSend["status"], string> = {
    sending: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
    sent: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
    failed: "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300",
};

function segmentLabel(segment: string): string
{
    if (segment.startsWith("label:"))
    {
        return `Label: ${segment.slice(6)}`;
    }
    return { all: "All subscribers", free: "Free members", paid: "Paid members" }[segment] ?? segment;
}

export function NewslettersScreen()
{
    const { me } = useSession();
    const { data, error, reload } = useApi<{ emails: EmailSend[] }>("/admin/emails");
    const [openId, setOpenId] = useState<string | null>(null);

    return (
        <div>
            <PageHeader
                title="Newsletters"
                description="Every post you send by email, with opens and clicks."
                actions={<button type="button" className="btn-primary" onClick={() => void newPost()}><PaperPlaneTilt className="size-4" />Write a newsletter</button>}
            />
            {!me.emailConfigured && (
                <div className="mb-6 flex items-start gap-3 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
                    <Info weight="fill" className="mt-0.5 size-5 shrink-0" />
                    <div>
                        <p className="font-semibold">Email sending isn't set up yet</p>
                        <p className="mt-1">
                            {me.mode === "single"
                                ? <>Set the <code className="kbd">EMAIL_FROM</code> secret on your Worker (for example <code className="kbd">My Blog &lt;hello@yourdomain.com&gt;</code>) and onboard that domain in Cloudflare Email Service. Until then, readers can still subscribe, and newsletters are recorded but not delivered.</>
                                : <>Newsletter delivery is being set up for this server. Readers can still subscribe in the meantime.</>}
                        </p>
                    </div>
                </div>
            )}
            {error && <ErrorState message={error} onRetry={reload} />}
            {!data && !error && <TableSkeleton />}
            {data && data.emails.length === 0 && (
                <div className="card flex flex-col items-center px-6 py-14 text-center">
                    <div className="flex size-12 items-center justify-center rounded-2xl bg-brand/10 text-brand"><EnvelopeSimple className="size-6" /></div>
                    <h2 className="mt-4 text-base font-semibold">No newsletters sent yet</h2>
                    <p className="muted mt-1.5 max-w-md text-sm">When you publish a post, choose “Web and email” in the publish panel to send it to your subscribers. You can also write email-only posts.</p>
                    <div className="mt-6 flex flex-wrap justify-center gap-2">
                        <button type="button" className="btn-primary" onClick={() => void newPost()}>Write a post</button>
                        <button type="button" className="btn-secondary" onClick={() =>
                        {
                            navigate("/admin/subscribers");
                        }}>See subscribers</button>
                    </div>
                </div>
            )}
            {data && data.emails.length > 0 && (
                <ul className="card divide-y divide-zinc-900/5 p-2 dark:divide-white/5">
                    {data.emails.map((email) =>
                    {
                        const base = email.delivered || email.recipients;
                        return (
                            <li key={email.id}>
                                <button
                                    type="button"
                                    onClick={() =>
                                    {
                                        setOpenId(email.id);
                                    }}
                                    className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 rounded-xl p-3 text-left transition-colors duration-200 hover:bg-zinc-50 dark:hover:bg-white/4"
                                >
                                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand/8 text-brand dark:bg-brand/15"><EnvelopeSimple className="size-5" /></span>
                                    <span className="min-w-0 flex-1 basis-48">
                                        <span className="block truncate text-sm font-medium">{email.subject}</span>
                                        <span className="muted block truncate text-xs">{formatDate(email.created_at, true)} · {segmentLabel(email.segment)}</span>
                                    </span>
                                    <span className={`pill ${STATUS_STYLE[email.status]}`}>{email.status[0].toUpperCase() + email.status.slice(1)}</span>
                                    <span className="flex gap-5 text-right text-sm tabular-nums">
                                        <Metric label="Sent" value={number(email.recipients)} />
                                        <Metric label="Opened" value={percent(base ? email.opens / base : 0)} />
                                        <Metric label="Clicked" value={percent(base ? email.clicks / base : 0)} />
                                    </span>
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}
            <EmailDetail id={openId} send={data?.emails.find((email) => email.id === openId) ?? null} onClose={() =>
            {
                setOpenId(null);
            }} />
        </div>
    );
}

function Metric({ label, value }: { label: string; value: string })
{
    return (
        <span className="flex w-16 flex-col items-end">
            <span className="font-semibold">{value}</span>
            <span className="muted text-xs">{label}</span>
        </span>
    );
}

function EmailDetail({ id, send, onClose }: { id: string | null; send: EmailSend | null; onClose: () => void })
{
    const { data, error, reload } = useApi<{ links: { url: string; clicks: number; people: number }[] }>(id ? `/admin/emails/${id}` : null);
    const base = send ? send.delivered || send.recipients : 0;
    return (
        <Dialog open={id !== null} onClose={onClose} title={send?.subject ?? "Newsletter"} description={send ? `Sent ${formatDate(send.created_at, true)} to ${segmentLabel(send.segment).toLowerCase()}` : undefined} wide>
            {send && (
                <div className="flex flex-col gap-5">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        {[
                            ["Recipients", number(send.recipients)],
                            ["Delivered", number(send.delivered)],
                            ["Opened", `${percent(base ? send.opens / base : 0)} (${number(send.opens)})`],
                            ["Clicked", `${percent(base ? send.clicks / base : 0)} (${number(send.clicks)})`],
                        ].map(([label, value]) => (
                            <div key={label} className="rounded-xl bg-zinc-50 p-3 dark:bg-white/4">
                                <p className="muted text-xs font-medium">{label}</p>
                                <p className="mt-0.5 text-base font-semibold tabular-nums">{value}</p>
                            </div>
                        ))}
                    </div>
                    {send.failed > 0 && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{number(send.failed)} emails couldn't be delivered.</p>}
                    <div>
                        <h3 className="mb-2 text-sm font-semibold">Top links</h3>
                        {error && <ErrorState message={error} onRetry={reload} />}
                        {!data && !error && <div className="flex flex-col gap-2">{[0, 1, 2].map((index) => <div key={index} className="skeleton h-10" />)}</div>}
                        {data && data.links.length === 0 && <p className="muted rounded-xl bg-zinc-50 p-4 text-sm dark:bg-white/4">No clicks yet.</p>}
                        {data && data.links.length > 0 && (
                            <ul className="flex flex-col gap-1">
                                {data.links.map((link) => (
                                    <li key={link.url} className="flex items-center gap-3 rounded-xl p-2 hover:bg-zinc-50 dark:hover:bg-white/4">
                                        <LinkSimple className="size-4 shrink-0 text-brand" />
                                        <a href={link.url} target="_blank" rel="noopener" className="min-w-0 flex-1 truncate text-sm hover:underline">{link.url.replace(/^https?:\/\//, "")}</a>
                                        <span className="shrink-0 text-right text-xs tabular-nums"><span className="font-semibold">{number(link.clicks)}</span> clicks · {number(link.people)} people</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            )}
        </Dialog>
    );
}
