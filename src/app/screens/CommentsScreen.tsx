import { ArrowSquareOut, ChatCircle, Check, Prohibit, Trash, ArrowCounterClockwise } from "@phosphor-icons/react";
import type { Comment } from "../components/audience/types";
import { confirm } from "../components/ConfirmDialog";
import { ErrorState } from "../components/EmptyState";
import { PageHeader } from "../components/PageHeader";
import { TableSkeleton } from "../components/Skeleton";
import { toast } from "../components/Toast";
import { api, errorMessage } from "../lib/api";
import { timeAgo } from "../lib/format";
import { navigate, useQueryParam } from "../lib/router";
import { useSession } from "../lib/session";
import { useApi } from "../lib/useApi";

const TABS = [
    { id: "pending", label: "Pending" },
    { id: "approved", label: "Approved" },
    { id: "spam", label: "Spam" },
] as const;

const EMPTY: Record<string, { title: string; text: string }> = {
    pending: { title: "Nothing waiting for review", text: "New comments from people who aren't signed in land here when moderation is on." },
    approved: { title: "No comments yet", text: "Approved comments show up under your posts." },
    spam: { title: "No spam", text: "Comments with lots of links are caught here automatically." },
};

export function CommentsScreen()
{
    const { me } = useSession();
    const [status, setStatus] = useQueryParam("status", "pending");
    const { data, error, reload, setData } = useApi<{ comments: Comment[]; counts: { status: string; n: number }[] }>(`/admin/comments?status=${status}`);
    const count = (id: string) => data?.counts.find((row) => row.status === id)?.n ?? 0;

    async function update(comment: Comment, next: Comment["status"])
    {
        try
        {
            await api(`/admin/comments/${comment.id}`, { method: "PUT", body: { status: next } });
            if (data)
            {
                setData({
                    comments: data.comments.filter((item) => item.id !== comment.id),
                    counts: data.counts.map((row) => row.status === comment.status ? { ...row, n: row.n - 1 } : row.status === next ? { ...row, n: row.n + 1 } : row),
                });
            }
            toast(next === "approved" ? "Comment approved" : next === "spam" ? "Marked as spam" : "Moved back to pending");
        }
        catch (caught)
        {
            toast(errorMessage(caught), "error");
        }
    }

    async function remove(comment: Comment)
    {
        if (!(await confirm({ title: "Delete this comment?", message: `The comment by ${comment.name} will be removed for good.`, confirmLabel: "Delete", destructive: true })))
        {
            return;
        }
        try
        {
            await api(`/admin/comments/${comment.id}`, { method: "DELETE" });
            await reload();
            toast("Comment deleted");
        }
        catch (caught)
        {
            toast(errorMessage(caught), "error");
        }
    }

    return (
        <div>
            <PageHeader
                title="Comments"
                description={me.site.settings.commentsMode === "off" ? "Comments are turned off for this blog." : "Approve, hide or delete what readers write under your posts."}
                actions={<button type="button" className="btn-secondary" onClick={() =>
                {
                    navigate("/admin/settings/members");
                }}>Comment settings</button>}
            />
            <div className="mb-4 flex gap-1" role="tablist" aria-label="Comment status">
                {TABS.map((tab) => (
                    <button key={tab.id} type="button" role="tab" aria-selected={status === tab.id} className="chip" onClick={() =>
                    {
                        setStatus(tab.id);
                    }}>
                        {tab.label}
                        {data && <span className="rounded-full bg-zinc-900/6 px-1.5 text-xs tabular-nums dark:bg-white/10">{count(tab.id)}</span>}
                    </button>
                ))}
            </div>
            {error && <ErrorState message={error} onRetry={reload} />}
            {!data && !error && <TableSkeleton rows={4} />}
            {data && data.comments.length === 0 && (
                <div className="card flex flex-col items-center px-6 py-14 text-center">
                    <div className="flex size-12 items-center justify-center rounded-2xl bg-brand/10 text-brand"><ChatCircle className="size-6" /></div>
                    <h2 className="mt-4 text-base font-semibold">{EMPTY[status]?.title}</h2>
                    <p className="muted mt-1.5 max-w-sm text-sm">{EMPTY[status]?.text}</p>
                </div>
            )}
            {data && data.comments.length > 0 && (
                <ul className="card divide-y divide-zinc-900/5 p-2 dark:divide-white/5">
                    {data.comments.map((comment) => (
                        <li key={comment.id} className="group flex gap-3 rounded-xl p-3 transition-colors duration-200 hover:bg-zinc-50 dark:hover:bg-white/3">
                            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand/10 text-sm font-semibold text-brand dark:bg-brand/20">{comment.name.slice(0, 1).toUpperCase()}</span>
                            <div className="min-w-0 flex-1">
                                <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
                                    <span className="font-semibold">{comment.name}</span>
                                    {comment.email && <span className="muted text-xs">{comment.email}</span>}
                                    <span className="muted text-xs">{timeAgo(comment.created_at)}</span>
                                </p>
                                <a href={`${me.url}/${comment.post_slug}#comments`} target="_blank" rel="noopener" className="muted mt-0.5 inline-flex items-center gap-1 text-xs hover:text-brand">
                                    On “{comment.post_title || "Untitled"}”<ArrowSquareOut className="size-3" />
                                </a>
                                <p className="mt-2 text-sm whitespace-pre-wrap">{comment.body}</p>
                            </div>
                            <div className="flex shrink-0 flex-col gap-1 sm:flex-row sm:items-start">
                                {comment.status !== "approved" && (
                                    <button type="button" className="btn-secondary btn-sm" onClick={() => void update(comment, "approved")}><Check className="size-3.5" />Approve</button>
                                )}
                                {comment.status === "approved" && (
                                    <button type="button" className="btn-ghost btn-sm" onClick={() => void update(comment, "pending")}><ArrowCounterClockwise className="size-3.5" />Unapprove</button>
                                )}
                                {comment.status !== "spam" && (
                                    <button type="button" className="icon-btn size-8" title="Mark as spam" aria-label="Mark as spam" onClick={() => void update(comment, "spam")}><Prohibit className="size-4" /></button>
                                )}
                                <button type="button" className="icon-btn size-8 hover:text-red-600" title="Delete" aria-label="Delete comment" onClick={() => void remove(comment)}><Trash className="size-4" /></button>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
