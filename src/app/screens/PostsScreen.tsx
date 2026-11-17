import { ArrowSquareOut, Copy, MagnifyingGlass, Note, Notebook, PencilSimple, Plus, Star, Trash } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import type { PostSummary } from "../../shared/types";
import { confirm } from "../components/ConfirmDialog";
import { EmptyState, ErrorState } from "../components/EmptyState";
import { PageHeader } from "../components/PageHeader";
import { TableSkeleton } from "../components/Skeleton";
import { StatusPill } from "../components/StatusPill";
import { toast } from "../components/Toast";
import { api, errorMessage } from "../lib/api";
import { formatDate, timeAgo } from "../lib/format";
import { navigate } from "../lib/router";
import { useSession } from "../lib/session";
import { useApi } from "../lib/useApi";

const FILTERS = [
    { value: "", label: "All" },
    { value: "draft", label: "Drafts" },
    { value: "scheduled", label: "Scheduled" },
    { value: "published", label: "Published" },
    { value: "unlisted", label: "Unlisted" },
];

export function PostsScreen({ type }: { type: "post" | "page" })
{
    const { me } = useSession();
    const [status, setStatus] = useState("");
    const [query, setQuery] = useState("");
    const [debounced, setDebounced] = useState("");
    const [creating, setCreating] = useState(false);
    const params = new URLSearchParams({ type });
    if (status)
    {
        params.set("status", status);
    }
    if (debounced)
    {
        params.set("q", debounced);
    }
    const { data, error, loading, reload } = useApi<{ posts: PostSummary[] }>(`/admin/posts?${params}`);
    const noun = type === "post" ? "post" : "page";

    useEffect(() =>
    {
        const timer = setTimeout(() =>
        {
            setDebounced(query.trim());
        }, 250);
        return () =>
        {
            clearTimeout(timer);
        };
    }, [query]);

    async function create()
    {
        setCreating(true);
        try
        {
            const { post } = await api<{ post: PostSummary }>("/admin/posts", { body: { type, title: "" } });
            navigate(`/admin/editor/${post.id}`);
        }
        catch (caught)
        {
            toast(errorMessage(caught), "error");
            setCreating(false);
        }
    }

    async function duplicate(post: PostSummary)
    {
        try
        {
            const { id } = await api<{ id: string }>(`/admin/posts/${post.id}/duplicate`, { method: "POST" });
            toast(`Made a copy of “${post.title || "Untitled"}”`);
            navigate(`/admin/editor/${id}`);
        }
        catch (caught)
        {
            toast(errorMessage(caught), "error");
        }
    }

    async function remove(post: PostSummary)
    {
        const ok = await confirm({
            title: `Delete this ${noun}?`,
            message: `“${post.title || "Untitled"}” will be deleted for good, with its revisions and comments.`,
            confirmLabel: "Delete",
            destructive: true,
        });
        if (!ok)
        {
            return;
        }
        try
        {
            await api(`/admin/posts/${post.id}`, { method: "DELETE" });
            toast(`Deleted “${post.title || "Untitled"}”`);
            await reload();
        }
        catch (caught)
        {
            toast(errorMessage(caught), "error");
        }
    }

    const posts = data?.posts ?? [];
    const filtering = status !== "" || debounced !== "";

    return (
        <div>
            <PageHeader
                title={type === "post" ? "Posts" : "Pages"}
                description={type === "post" ? "Write, schedule and send your posts." : "Static pages like About or Contact. Link them from Settings, Navigation."}
                actions={
                    <button type="button" className="btn-primary" onClick={create} disabled={creating}>
                        <Plus weight="bold" className="size-4" />New {noun}
                    </button>
                }
            />
            <div className="mb-4 flex flex-wrap items-center gap-3">
                <div className="flex flex-wrap gap-1" role="group" aria-label="Filter by status">
                    {FILTERS.map((filter) => (
                        <button key={filter.value} type="button" className="chip" aria-pressed={status === filter.value} onClick={() =>
                        {
                            setStatus(filter.value);
                        }}>{filter.label}</button>
                    ))}
                </div>
                <label className="relative ml-auto w-full sm:w-64">
                    <span className="sr-only">Search {noun}s</span>
                    <MagnifyingGlass className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400" />
                    <input className="input pl-9" type="search" placeholder={`Search ${noun}s`} value={query} onChange={(event) =>
                    {
                        setQuery(event.target.value);
                    }} />
                </label>
            </div>

            {error && !data ? <ErrorState message={error} onRetry={reload} />
                : loading && !data ? <TableSkeleton />
                    : posts.length === 0 ? (
                        <EmptyState
                            icon={type === "post" ? <Note className="size-6" /> : <Notebook className="size-6" />}
                            title={filtering ? `No ${noun}s match` : `No ${noun}s yet`}
                            message={filtering ? "Try another filter or search." : type === "post" ? "Your first post is one click away. Write it, publish it, and send it to your subscribers." : "Add an About page so readers know who's writing."}
                            action={filtering ? undefined : <button type="button" className="btn-primary" onClick={create} disabled={creating}><Plus weight="bold" className="size-4" />New {noun}</button>}
                        />
                    ) : (
                        <ul className="card divide-y divide-zinc-900/5 overflow-hidden dark:divide-white/5">
                            {posts.map((post) => (
                                <li key={post.id} className="group relative flex items-center gap-4 px-4 py-3.5 transition-colors duration-200 hover:bg-zinc-50 dark:hover:bg-white/3">
                                    <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-brand/8 text-brand dark:bg-brand/15">
                                        {post.cover_image
                                            ? <img src={post.cover_image} alt="" className="size-full object-cover" loading="lazy" />
                                            : type === "post" ? <Note className="size-5" /> : <Notebook className="size-5" />}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <a
                                            href={`/admin/editor/${post.id}`}
                                            onClick={(event) =>
                                            {
                                                event.preventDefault();
                                                navigate(`/admin/editor/${post.id}`);
                                            }}
                                            className="flex items-center gap-1.5 text-sm font-semibold after:absolute after:inset-0"
                                        >
                                            <span className="truncate">{post.title || "Untitled"}</span>
                                            {post.featured === 1 && <Star weight="fill" className="size-3.5 shrink-0 text-amber-500" aria-label="Featured" />}
                                        </a>
                                        <p className="muted mt-0.5 truncate text-xs">
                                            /{post.slug}
                                            {post.authors && <> · {post.authors}</>}
                                            {post.tags && <> · {post.tags}</>}
                                        </p>
                                    </div>
                                    <div className="hidden shrink-0 flex-col items-end gap-1 sm:flex">
                                        <StatusPill status={post.status} />
                                        <span className="muted text-xs" title={formatDate(post.published_at ?? post.updated_at, true)}>
                                            {post.status === "scheduled" ? `For ${formatDate(post.published_at, true)}` : post.published_at && post.status !== "draft" ? formatDate(post.published_at) : `Edited ${timeAgo(post.updated_at)}`}
                                        </span>
                                    </div>
                                    <div className="relative z-10 flex shrink-0 items-center gap-0.5 sm:opacity-0 sm:transition-opacity sm:duration-200 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                                        <button type="button" className="icon-btn" aria-label={`Edit ${post.title || "Untitled"}`} title="Edit" onClick={() =>
                                        {
                                            navigate(`/admin/editor/${post.id}`);
                                        }}><PencilSimple className="size-4" /></button>
                                        <button type="button" className="icon-btn" aria-label={`Duplicate ${post.title || "Untitled"}`} title="Duplicate" onClick={() =>
                                        {
                                            void duplicate(post);
                                        }}><Copy className="size-4" /></button>
                                        {(post.status === "published" || post.status === "unlisted") && (
                                            <a className="icon-btn" href={`${me.url}/${post.slug}`} target="_blank" rel="noopener" aria-label={`View ${post.title || "Untitled"}`} title="View"><ArrowSquareOut className="size-4" /></a>
                                        )}
                                        <button type="button" className="icon-btn hover:!bg-red-50 hover:!text-red-600 dark:hover:!bg-red-500/10" aria-label={`Delete ${post.title || "Untitled"}`} title="Delete" onClick={() =>
                                        {
                                            void remove(post);
                                        }}><Trash className="size-4" /></button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
        </div>
    );
}
