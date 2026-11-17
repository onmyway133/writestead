import { CaretLeft, CaretRight, DotsThree, DownloadSimple, MagnifyingGlass, PencilSimple, Plus, Trash, UploadSimple, Users, Warning } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { AddSubscriberDialog, EditSubscriberDialog, ImportDialog } from "../components/audience/SubscriberDialogs";
import type { Subscriber, SubscriberList } from "../components/audience/types";
import { confirm } from "../components/ConfirmDialog";
import { ErrorState } from "../components/EmptyState";
import { PageHeader } from "../components/PageHeader";
import { TableSkeleton } from "../components/Skeleton";
import { toast } from "../components/Toast";
import { api, errorMessage } from "../lib/api";
import { formatDate, number } from "../lib/format";
import { navigate, useQueryParams } from "../lib/router";
import { useSession } from "../lib/session";
import { useApi } from "../lib/useApi";

const FILTERS = ["q", "status", "tier", "label", "page"] as const;

const STATUS_STYLE: Record<Subscriber["status"], string> = {
    active: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
    pending: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
    unsubscribed: "bg-zinc-100 text-zinc-600 dark:bg-white/8 dark:text-zinc-300",
    bounced: "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300",
};

const TIER_STYLE: Record<Subscriber["tier"], string> = {
    free: "bg-zinc-100 text-zinc-600 dark:bg-white/8 dark:text-zinc-300",
    paid: "bg-brand/12 text-brand dark:bg-brand/25 dark:text-violet-200",
    comp: "bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300",
};

function capital(value: string): string
{
    return value[0].toUpperCase() + value.slice(1);
}

export function SubscribersScreen()
{
    const { me } = useSession();
    const [filters, setFilters] = useQueryParams(FILTERS);
    const [search, setSearch] = useState(filters.q ?? "");
    const [adding, setAdding] = useState(false);
    const [importing, setImporting] = useState(false);
    const [editing, setEditing] = useState<Subscriber | null>(null);
    const page = Math.max(1, Number(filters.page) || 1);
    const params = new URLSearchParams();
    for (const key of FILTERS)
    {
        if (filters[key])
        {
            params.set(key, filters[key]!);
        }
    }
    const query = params.toString();
    const { data, error, reload } = useApi<SubscriberList>(`/admin/subscribers${query ? `?${query}` : ""}`);

    // Debounce typing in the search box.
    useEffect(() =>
    {
        const timer = setTimeout(() =>
        {
            if ((filters.q ?? "") !== search)
            {
                setFilters({ ...filters, q: search || undefined, page: undefined });
            }
        }, 300);
        return () =>
        {
            clearTimeout(timer);
        };
    }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

    function setFilter(key: "status" | "tier" | "label", value: string | undefined)
    {
        setFilters({ ...filters, [key]: value, page: undefined });
    }

    const count = (predicate: (row: { status: string; tier: string }) => boolean) => (data?.totals ?? []).filter(predicate).reduce((total, row) => total + row.n, 0);
    const active = count((row) => row.status === "active");
    const paid = count((row) => row.status === "active" && row.tier !== "free");
    const pending = count((row) => row.status === "pending");
    const unsubscribed = count((row) => row.status === "unsubscribed" || row.status === "bounced");
    const all = count(() => true);
    const nearLimit = data && data.limit < Number.MAX_SAFE_INTEGER && active + pending >= data.limit * 0.8;
    const exportParams = new URLSearchParams(params);
    exportParams.delete("page");
    const filtered = Boolean(filters.q || filters.status || filters.tier || filters.label);

    async function remove(subscriber: Subscriber)
    {
        if (!(await confirm({ title: "Delete this subscriber?", message: `${subscriber.email} will be removed with their history. To stop emails but keep the record, unsubscribe them instead.`, confirmLabel: "Delete", destructive: true })))
        {
            return;
        }
        try
        {
            await api(`/admin/subscribers/${subscriber.id}`, { method: "DELETE" });
            toast(`${subscriber.email} deleted`);
            await reload();
        }
        catch (caught)
        {
            toast(errorMessage(caught), "error");
        }
    }

    return (
        <div>
            <PageHeader
                title="Subscribers"
                description="Everyone who signed up for your newsletter or membership."
                actions={
                    <>
                        <button type="button" className="btn-secondary" onClick={() =>
                        {
                            setImporting(true);
                        }}><UploadSimple className="size-4" />Import</button>
                        <a className="btn-secondary" href={`/api/admin/subscribers/export${exportParams.size ? `?${exportParams}` : ""}`} download><DownloadSimple className="size-4" />Export</a>
                        <button type="button" className="btn-primary" onClick={() =>
                        {
                            setAdding(true);
                        }}><Plus weight="bold" className="size-4" />Add</button>
                    </>
                }
            />

            <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[
                    ["Active", active],
                    ["Paid and comp", paid],
                    ["Waiting to confirm", pending],
                    ["Unsubscribed", unsubscribed],
                ].map(([label, value]) => (
                    <div key={label} className="card px-4 py-3">
                        <p className="muted text-xs font-medium">{label}</p>
                        {data ? <p className="text-xl font-semibold tabular-nums">{number(value as number)}</p> : <div className="skeleton mt-1 h-6 w-16" />}
                    </div>
                ))}
            </div>

            {nearLimit && (
                <div className="mb-4 flex items-start gap-3 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
                    <Warning weight="fill" className="mt-0.5 size-5 shrink-0" />
                    <p>You're using {number(active + pending)} of {number(data!.limit)} subscribers on your plan. {me.mode === "multi" && <button type="button" className="font-semibold underline underline-offset-2" onClick={() =>
                    {
                        navigate("/admin/settings/plan");
                    }}>Upgrade to Pro</button>} for more room.</p>
                </div>
            )}

            <div className="mb-4 flex flex-wrap items-center gap-2">
                <label className="relative min-w-0 flex-1 basis-56">
                    <span className="sr-only">Search subscribers</span>
                    <MagnifyingGlass className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400" />
                    <input className="input pl-9" type="search" placeholder="Search by email or name" value={search} onChange={(event) =>
                    {
                        setSearch(event.target.value);
                    }} />
                </label>
                <div className="flex flex-wrap gap-1" role="group" aria-label="Status">
                    {[undefined, "active", "pending", "unsubscribed"].map((value) => (
                        <button key={value ?? "all"} type="button" className="chip" aria-pressed={filters.status === value} onClick={() =>
                        {
                            setFilter("status", value);
                        }}>{value ? capital(value) : "All"}</button>
                    ))}
                </div>
                <div className="flex flex-wrap gap-1" role="group" aria-label="Plan">
                    {(["free", "paid", "comp"] as const).map((value) => (
                        <button key={value} type="button" className="chip" aria-pressed={filters.tier === value} onClick={() =>
                        {
                            setFilter("tier", filters.tier === value ? undefined : value);
                        }}>{value === "comp" ? "Complimentary" : capital(value)}</button>
                    ))}
                </div>
                {data && data.labels.length > 0 && (
                    <select className="input w-auto" aria-label="Label" value={filters.label ?? ""} onChange={(event) =>
                    {
                        setFilter("label", event.target.value || undefined);
                    }}>
                        <option value="">All labels</option>
                        {data.labels.map((label) => <option key={label} value={label}>{label}</option>)}
                    </select>
                )}
            </div>

            {error && <ErrorState message={error} onRetry={reload} />}
            {!data && !error && <TableSkeleton rows={8} />}
            {data && data.subscribers.length === 0 && (
                <div className="card flex flex-col items-center px-6 py-14 text-center">
                    <div className="flex size-12 items-center justify-center rounded-2xl bg-brand/10 text-brand"><Users className="size-6" /></div>
                    {filtered
                        ? (
                            <>
                                <h2 className="mt-4 text-base font-semibold">No one matches these filters</h2>
                                <button type="button" className="btn-secondary mt-4" onClick={() =>
                                {
                                    setSearch("");
                                    setFilters({});
                                }}>Clear filters</button>
                            </>
                        )
                        : (
                            <>
                                <h2 className="mt-4 text-base font-semibold">Your list starts here</h2>
                                <p className="muted mt-1.5 max-w-md text-sm">Readers can subscribe at <a className="text-brand hover:underline" href={`${me.url}/subscribe`} target="_blank" rel="noopener">{me.url.replace(/^https?:\/\//, "")}/subscribe</a>, from the form under every post, or from the signup widget you can embed anywhere.</p>
                                <div className="mt-6 flex flex-wrap justify-center gap-2">
                                    <button type="button" className="btn-primary" onClick={() =>
                                    {
                                        setImporting(true);
                                    }}>Import a CSV</button>
                                    <button type="button" className="btn-secondary" onClick={() =>
                                    {
                                        void navigator.clipboard?.writeText(`<iframe src="${me.url}/embed/subscribe" width="480" height="140" style="border:0" title="Subscribe"></iframe>`).then(() =>
                                        {
                                            toast("Embed code copied");
                                        });
                                    }}>Copy signup embed</button>
                                </div>
                            </>
                        )}
                </div>
            )}
            {data && data.subscribers.length > 0 && (
                <div className="card overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="table">
                            <thead><tr><th>Subscriber</th><th>Status</th><th className="hidden md:table-cell">Labels</th><th className="hidden sm:table-cell">Joined</th><th><span className="sr-only">Actions</span></th></tr></thead>
                            <tbody>
                                {data.subscribers.map((subscriber) => (
                                    <tr key={subscriber.id} className="cursor-pointer" onClick={() =>
                                    {
                                        setEditing(subscriber);
                                    }}>
                                        <td>
                                            <div className="flex items-center gap-3">
                                                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand/10 text-sm font-semibold text-brand uppercase dark:bg-brand/20">{(subscriber.name || subscriber.email).slice(0, 1)}</span>
                                                <span className="min-w-0">
                                                    <span className="block max-w-[14rem] truncate font-medium sm:max-w-xs">{subscriber.email}</span>
                                                    <span className="muted block truncate text-xs">{subscriber.name || subscriber.source || "No name"}</span>
                                                </span>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="flex flex-wrap gap-1">
                                                <span className={`pill ${STATUS_STYLE[subscriber.status]}`}>{capital(subscriber.status)}</span>
                                                {subscriber.tier !== "free" && <span className={`pill ${TIER_STYLE[subscriber.tier]}`}>{subscriber.tier === "comp" ? "Comp" : "Paid"}</span>}
                                            </div>
                                        </td>
                                        <td className="hidden md:table-cell">
                                            <div className="flex flex-wrap gap-1">
                                                {subscriber.labels.split(",").filter(Boolean).slice(0, 3).map((label) => (
                                                    <button key={label} type="button" className="pill bg-zinc-100 text-zinc-600 hover:bg-brand/10 hover:text-brand dark:bg-white/8 dark:text-zinc-300" onClick={(event) =>
                                                    {
                                                        event.stopPropagation();
                                                        setFilter("label", label);
                                                    }}>{label}</button>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="muted hidden whitespace-nowrap sm:table-cell">{formatDate(subscriber.created_at)}</td>
                                        <td className="w-10 text-right" onClick={(event) =>
                                        {
                                            event.stopPropagation();
                                        }}>
                                            <RowMenu onEdit={() =>
                                            {
                                                setEditing(subscriber);
                                            }} onDelete={() => void remove(subscriber)} />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                        <span className="muted">{number((page - 1) * 50 + 1)} to {number(Math.min(page * 50, data.total))} of {number(data.total)}{filtered ? ` (${number(all)} in total)` : ""}</span>
                        <div className="flex gap-1">
                            <button type="button" className="icon-btn" disabled={page <= 1} aria-label="Previous page" onClick={() =>
                            {
                                setFilters({ ...filters, page: String(page - 1) });
                            }}><CaretLeft /></button>
                            <button type="button" className="icon-btn" disabled={page * 50 >= data.total} aria-label="Next page" onClick={() =>
                            {
                                setFilters({ ...filters, page: String(page + 1) });
                            }}><CaretRight /></button>
                        </div>
                    </div>
                </div>
            )}

            <AddSubscriberDialog open={adding} onClose={() =>
            {
                setAdding(false);
            }} onSaved={reload} />
            <ImportDialog open={importing} onClose={() =>
            {
                setImporting(false);
            }} onDone={reload} />
            <EditSubscriberDialog subscriber={editing} onClose={() =>
            {
                setEditing(null);
            }} onSaved={reload} />
        </div>
    );
}

function RowMenu({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void })
{
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() =>
    {
        if (!open)
        {
            return;
        }
        const close = (event: MouseEvent | KeyboardEvent) =>
        {
            if (event instanceof KeyboardEvent ? event.key === "Escape" : !ref.current?.contains(event.target as Node))
            {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", close);
        document.addEventListener("keydown", close);
        return () =>
        {
            document.removeEventListener("mousedown", close);
            document.removeEventListener("keydown", close);
        };
    }, [open]);

    return (
        <div ref={ref} className="relative inline-block">
            <button type="button" className="icon-btn" aria-label="Subscriber actions" aria-haspopup="menu" aria-expanded={open} onClick={() =>
            {
                setOpen(!open);
            }}><DotsThree weight="bold" className="size-5" /></button>
            {open && (
                <div role="menu" className="absolute right-0 z-20 mt-1 w-40 animate-pop-in rounded-xl bg-white p-1 text-left shadow-xl ring-1 ring-zinc-900/8 dark:bg-[#272727] dark:ring-white/10">
                    <button type="button" role="menuitem" className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-white/8" onClick={() =>
                    {
                        setOpen(false);
                        onEdit();
                    }}><PencilSimple className="size-4" />Edit</button>
                    <button type="button" role="menuitem" className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10" onClick={() =>
                    {
                        setOpen(false);
                        onDelete();
                    }}><Trash className="size-4" />Delete</button>
                </div>
            )}
        </div>
    );
}
