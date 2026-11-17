import {
    ArrowLeft, ArrowSquareOut, ClockCounterClockwise, DotsThree, EnvelopeSimple, Eye, EyeSlash, GearSix, Trash, ArrowUUpLeft, LinkBreak,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { renderMarkdown } from "../../shared/markdown";
import type { Post, PostStatus } from "../../shared/types";
import { confirm } from "../components/ConfirmDialog";
import { Dialog } from "../components/Dialog";
import { ErrorState } from "../components/EmptyState";
import { type Draft, SettingsDrawer } from "../components/editor/SettingsDrawer";
import { MarkdownField } from "../components/editor/MarkdownField";
import { fromLocalInput, toLocalInput } from "../components/editor/upload";
import { Segmented } from "../components/Segmented";
import { PageSpinner, Spinner } from "../components/Spinner";
import { StatusPill } from "../components/StatusPill";
import { Switch } from "../components/Switch";
import { toast } from "../components/Toast";
import { api, errorMessage } from "../lib/api";
import { formatDate, timeAgo } from "../lib/format";
import { navigate } from "../lib/router";
import { canManageSubscribers, canPublish, useSession } from "../lib/session";

type SaveState = "saved" | "saving" | "dirty" | "error";

type SaveOptions = { autosave?: boolean; status?: PostStatus; published_at?: number | null; send_email?: boolean; email_segment?: string; draftOverride?: Partial<Draft> };

function draftOf(post: Post): Draft
{
    return {
        title: post.title, slug: post.slug, excerpt: post.excerpt, content: post.content, cover_image: post.cover_image,
        visibility: post.visibility, featured: post.featured, delivery: post.delivery, email_segment: post.email_segment || "all",
        meta_title: post.meta_title, meta_description: post.meta_description, canonical_url: post.canonical_url, og_image: post.og_image,
        published_at: post.published_at, author_ids: post.author_ids, tag_names: post.tag_names,
    };
}

export function EditorScreen({ id }: { id: string })
{
    const { me } = useSession();
    const [post, setPost] = useState<Post | null>(null);
    const [draft, setDraft] = useState<Draft | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [saveState, setSaveState] = useState<SaveState>("saved");
    const [preview, setPreview] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [publishOpen, setPublishOpen] = useState(false);
    const [revisionsOpen, setRevisionsOpen] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const [staff, setStaff] = useState<{ id: string; name: string; avatar: string }[]>([]);
    const [labels, setLabels] = useState<string[]>([]);
    const saved = useRef<string>("");
    const saving = useRef(false);
    const draftRef = useRef<Draft | null>(null);
    draftRef.current = draft;
    const canManage = canManageSubscribers(me);
    const mayPublish = canPublish(me);

    const load = useCallback(async () =>
    {
        try
        {
            const result = await api<{ post: Post }>(`/admin/posts/${id}`);
            setPost(result.post);
            const next = draftOf(result.post);
            setDraft(next);
            saved.current = JSON.stringify(next);
            setSaveState("saved");
            setLoadError(null);
        }
        catch (caught)
        {
            setLoadError(errorMessage(caught));
        }
    }, [id]);

    useEffect(() =>
    {
        void load();
    }, [load]);

    useEffect(() =>
    {
        if (!canManage)
        {
            return;
        }
        api<{ staff: { id: string; name: string; avatar: string }[] }>("/admin/staff").then((result) =>
        {
            setStaff(result.staff);
        }).catch(() =>
        {
            // The author picker just stays hidden.
        });
        api<{ labels: string[] }>("/admin/subscribers").then((result) =>
        {
            setLabels(result.labels);
        }).catch(() =>
        {
            // Without access to subscribers, only the built-in segments show.
        });
    }, [canManage]);

    const save = useCallback(async (options: SaveOptions = {}): Promise<boolean> =>
    {
        const current = draftRef.current;
        if (!current || saving.current)
        {
            return false;
        }
        const body = { ...current, ...options.draftOverride };
        saving.current = true;
        setSaveState("saving");
        try
        {
            const result = await api<{ post: Post; emailed: { recipients: number } | null }>(`/admin/posts/${id}`, {
                method: "PUT",
                body: {
                    ...body,
                    featured: body.featured === 1,
                    status: options.status,
                    published_at: options.published_at !== undefined ? options.published_at : body.published_at,
                    autosave: options.autosave ?? false,
                    send_email: options.send_email ?? false,
                    email_segment: options.email_segment ?? body.email_segment,
                },
            });
            setPost(result.post);
            const fresh = draftOf(result.post);
            // Keep anything typed while the request was in flight.
            const typedSince = JSON.stringify(draftRef.current) !== JSON.stringify(current);
            if (!typedSince)
            {
                setDraft(fresh);
            }
            saved.current = JSON.stringify(typedSince ? { ...fresh, title: draftRef.current!.title, content: draftRef.current!.content } : fresh);
            setSaveState(typedSince ? "dirty" : "saved");
            if (result.emailed)
            {
                toast(`Sending to ${result.emailed.recipients} subscriber${result.emailed.recipients === 1 ? "" : "s"}`);
            }
            return true;
        }
        catch (caught)
        {
            setSaveState("error");
            toast(errorMessage(caught), "error");
            return false;
        }
        finally
        {
            saving.current = false;
        }
    }, [id]);

    function update(patch: Partial<Draft>)
    {
        setDraft((current) => (current ? { ...current, ...patch } : current));
    }

    const dirty = draft !== null && JSON.stringify(draft) !== saved.current;

    useEffect(() =>
    {
        if (dirty && saveState === "saved")
        {
            setSaveState("dirty");
        }
    }, [dirty, saveState]);

    // Drafts save themselves. Published posts wait for Update so half-finished edits never go live.
    useEffect(() =>
    {
        if (!dirty || !post || post.status !== "draft")
        {
            return;
        }
        const timer = setTimeout(() =>
        {
            void save({ autosave: true });
        }, 2500);
        return () =>
        {
            clearTimeout(timer);
        };
    }, [draft, dirty, post, save]);

    useEffect(() =>
    {
        const onKey = (event: KeyboardEvent) =>
        {
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s")
            {
                event.preventDefault();
                void save().then((ok) =>
                {
                    if (ok)
                    {
                        toast("Saved");
                    }
                });
            }
        };
        const beforeUnload = (event: BeforeUnloadEvent) =>
        {
            if (JSON.stringify(draftRef.current) !== saved.current)
            {
                event.preventDefault();
            }
        };
        window.addEventListener("keydown", onKey);
        window.addEventListener("beforeunload", beforeUnload);
        return () =>
        {
            window.removeEventListener("keydown", onKey);
            window.removeEventListener("beforeunload", beforeUnload);
        };
    }, [save]);

    const html = useMemo(() => (preview && draft ? renderMarkdown(draft.content) : ""), [preview, draft]);

    if (loadError)
    {
        return <div className="mx-auto max-w-lg p-8"><ErrorState message={loadError} onRetry={load} /></div>;
    }
    if (!post || !draft)
    {
        return <PageSpinner />;
    }

    const backTo = post.type === "page" ? "/admin/pages" : "/admin/posts";
    const isLive = post.status === "published" || post.status === "unlisted" || post.status === "scheduled";

    async function goBack()
    {
        if (dirty)
        {
            if (post!.status === "draft")
            {
                await save({ autosave: true });
            }
            else if (!(await confirm({ title: "Leave without updating?", message: "Your changes to this published post haven't been saved.", confirmLabel: "Leave", destructive: true })))
            {
                return;
            }
        }
        navigate(backTo);
    }

    async function setStatus(status: PostStatus, message: string)
    {
        setMenuOpen(false);
        if (await save({ status }))
        {
            toast(message);
        }
    }

    async function remove()
    {
        setMenuOpen(false);
        const ok = await confirm({ title: `Delete this ${post!.type}?`, message: `“${draft!.title || "Untitled"}” will be deleted for good.`, confirmLabel: "Delete", destructive: true });
        if (!ok)
        {
            return;
        }
        try
        {
            await api(`/admin/posts/${id}`, { method: "DELETE" });
            saved.current = JSON.stringify(draftRef.current);
            toast("Deleted");
            navigate(backTo);
        }
        catch (caught)
        {
            toast(errorMessage(caught), "error");
        }
    }

    async function sendNow()
    {
        setMenuOpen(false);
        const segment = draft!.email_segment || "all";
        const ok = await confirm({ title: "Send this post by email?", message: `It goes to ${segmentLabel(segment)} right away. You can only send a post once.`, confirmLabel: "Send email" });
        if (!ok)
        {
            return;
        }
        try
        {
            const result = await api<{ recipients: number }>(`/admin/posts/${id}/send`, { body: { segment } });
            toast(`Sending to ${result.recipients} subscriber${result.recipients === 1 ? "" : "s"}`);
            await load();
        }
        catch (caught)
        {
            toast(errorMessage(caught), "error");
        }
    }

    const stateLabel = saveState === "saving" ? "Saving…" : saveState === "dirty" ? (post.status === "draft" ? "Unsaved" : "Unsaved changes") : saveState === "error" ? "Not saved" : "Saved";

    return (
        <div className="min-h-screen bg-white dark:bg-[#131209]">
            <header className="sticky top-0 z-20 flex h-14 items-center gap-2 bg-white/85 px-3 backdrop-blur-lg sm:px-4 dark:bg-[#131209]/85">
                <button type="button" className="btn-ghost btn-sm" onClick={() =>
                {
                    void goBack();
                }}><ArrowLeft className="size-4" /><span className="hidden sm:inline">{post.type === "page" ? "Pages" : "Posts"}</span></button>
                <StatusPill status={post.status} />
                <span className={`hidden text-xs sm:inline ${saveState === "error" ? "text-red-600" : "muted"}`} aria-live="polite">
                    {saveState === "saving" && <Spinner className="mr-1 inline size-3" />}{stateLabel}
                </span>
                <div className="ml-auto flex items-center gap-1">
                    <button type="button" className="icon-btn" aria-pressed={preview} aria-label={preview ? "Hide preview" : "Show preview"} title="Preview" onClick={() =>
                    {
                        setPreview(!preview);
                    }}>{preview ? <EyeSlash className="size-[18px]" /> : <Eye className="size-[18px]" />}</button>
                    <button type="button" className="icon-btn" aria-pressed={settingsOpen} aria-label="Settings" title="Settings" onClick={() =>
                    {
                        setSettingsOpen(!settingsOpen);
                    }}><GearSix className="size-[18px]" /></button>
                    <div className="relative">
                        <button type="button" className="icon-btn" aria-label="More actions" aria-expanded={menuOpen} onClick={() =>
                        {
                            setMenuOpen(!menuOpen);
                        }}><DotsThree weight="bold" className="size-5" /></button>
                        {menuOpen && (
                            <>
                                <button type="button" className="fixed inset-0 z-10 cursor-default" aria-label="Close menu" tabIndex={-1} onClick={() =>
                                {
                                    setMenuOpen(false);
                                }} />
                                <div className="card absolute right-0 z-20 mt-1 w-60 animate-pop-in p-1.5 shadow-xl" role="menu">
                                    {isLive && <MenuItem icon={<ArrowSquareOut />} label="View on site" href={`${me.url}/${post.slug}`} />}
                                    <MenuItem icon={<ClockCounterClockwise />} label="Revision history" onClick={() =>
                                    {
                                        setMenuOpen(false);
                                        setRevisionsOpen(true);
                                    }} />
                                    {mayPublish && canManage && post.type === "post" && post.delivery !== "web" && !post.emailed_at && (post.status === "published" || post.delivery === "email") && (
                                        <MenuItem icon={<EnvelopeSimple />} label="Send as email now" onClick={sendNow} />
                                    )}
                                    {mayPublish && post.status === "published" && <MenuItem icon={<LinkBreak />} label="Make unlisted" onClick={() => setStatus("unlisted", "Unlisted. Only people with the link can see it.")} />}
                                    {mayPublish && post.status === "unlisted" && <MenuItem icon={<Eye />} label="List publicly" onClick={() => setStatus("published", "Listed on your blog")} />}
                                    {mayPublish && isLive && <MenuItem icon={<ArrowUUpLeft />} label={post.status === "scheduled" ? "Unschedule" : "Unpublish"} onClick={() => setStatus("draft", "Moved back to drafts")} />}
                                    <MenuItem icon={<Trash />} label={`Delete ${post.type}`} danger onClick={remove} />
                                </div>
                            </>
                        )}
                    </div>
                    {!mayPublish ? (
                        <button type="button" className="btn-primary btn-sm ml-1" disabled={saveState === "saving"} onClick={async () =>
                        {
                            if (await save())
                            {
                                toast("Saved. Ask an editor to review and publish it.");
                            }
                        }}>Submit for review</button>
                    ) : post.status === "draft" ? (
                        <button type="button" className="btn-primary btn-sm ml-1" onClick={() =>
                        {
                            setPublishOpen(true);
                        }}>Publish</button>
                    ) : (
                        <button type="button" className="btn-primary btn-sm ml-1" disabled={!dirty || saveState === "saving"} onClick={async () =>
                        {
                            if (await save())
                            {
                                toast(post.status === "scheduled" ? "Scheduled post updated" : "Changes are live");
                            }
                        }}>Update</button>
                    )}
                </div>
            </header>

            <div className={`mx-auto px-4 pb-24 transition-[padding] duration-500 ease-out-soft sm:px-8 ${preview ? "max-w-7xl" : "max-w-3xl"} ${settingsOpen ? "xl:pr-[400px]" : ""}`}>
                <div className={preview ? "grid gap-10 lg:grid-cols-2" : ""}>
                    <div className={preview ? "hidden lg:block" : ""}>
                        <label htmlFor="post-title" className="sr-only">Title</label>
                        <textarea
                            id="post-title"
                            rows={1}
                            value={draft.title}
                            placeholder={post.type === "page" ? "Page title" : "Post title"}
                            onChange={(event) =>
                            {
                                update({ title: event.target.value.replace(/\n/g, " ") });
                                event.target.style.height = "auto";
                                event.target.style.height = `${event.target.scrollHeight}px`;
                            }}
                            ref={(element) =>
                            {
                                if (element)
                                {
                                    element.style.height = "auto";
                                    element.style.height = `${element.scrollHeight}px`;
                                }
                            }}
                            className="mt-10 mb-4 block w-full resize-none overflow-hidden bg-transparent text-3xl leading-tight font-semibold tracking-tight outline-none placeholder:text-zinc-300 sm:text-4xl dark:placeholder:text-zinc-600"
                        />
                        <MarkdownField value={draft.content} onChange={(content) =>
                        {
                            update({ content });
                        }} />
                    </div>
                    {preview && (
                        <article className="mt-10 min-w-0 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
                            <p className="mb-3 text-xs font-semibold tracking-wider text-zinc-400 uppercase">Preview</p>
                            {draft.cover_image && <img src={draft.cover_image} alt="" className="mb-6 aspect-video w-full rounded-2xl object-cover" />}
                            <h1 className="mb-6 text-3xl font-semibold tracking-tight">{draft.title || "Untitled"}</h1>
                            <div className="prose-preview" dangerouslySetInnerHTML={{ __html: html }} />
                        </article>
                    )}
                </div>
            </div>

            <SettingsDrawer
                open={settingsOpen}
                onClose={() =>
                {
                    setSettingsOpen(false);
                }}
                draft={draft}
                update={update}
                post={post}
                siteUrl={me.url}
                staff={staff}
                labels={labels}
                canManage={canManage}
            />

            {publishOpen && (
                <PublishDialog
                    post={post}
                    draft={draft}
                    labels={labels}
                    canEmail={canManage && post.type === "post" && draft.delivery !== "web" && !post.emailed_at}
                    onClose={() =>
                    {
                        setPublishOpen(false);
                    }}
                    onPublish={async (options) =>
                    {
                        const ok = await save(options);
                        if (ok)
                        {
                            setPublishOpen(false);
                            toast(options.status === "scheduled" ? `Scheduled for ${formatDate(options.published_at ?? null, true)}` : "Published");
                        }
                    }}
                />
            )}

            {revisionsOpen && (
                <RevisionsDialog
                    postId={id}
                    onClose={() =>
                    {
                        setRevisionsOpen(false);
                    }}
                    onRestore={async (revision) =>
                    {
                        setRevisionsOpen(false);
                        update({ title: revision.title, content: revision.content });
                        if (await save({ draftOverride: { title: revision.title, content: revision.content } }))
                        {
                            toast(post.status === "draft" ? "Revision restored" : "Revision restored and live");
                        }
                    }}
                />
            )}
        </div>
    );
}

function segmentLabel(segment: string): string
{
    if (segment === "free")
    {
        return "free subscribers";
    }
    if (segment === "paid")
    {
        return "paid members";
    }
    if (segment.startsWith("label:"))
    {
        return `subscribers labeled “${segment.slice(6)}”`;
    }
    return "all subscribers";
}

function MenuItem({ icon, label, onClick, href, danger }: { icon: React.ReactNode; label: string; onClick?: () => void; href?: string; danger?: boolean })
{
    const className = `flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium transition-colors duration-200 [&_svg]:size-4 ${danger ? "text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10" : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-white/8"}`;
    if (href)
    {
        return <a role="menuitem" className={className} href={href} target="_blank" rel="noopener">{icon}{label}</a>;
    }
    return <button role="menuitem" type="button" className={className} onClick={onClick}>{icon}{label}</button>;
}

function PublishDialog({ post, draft, labels, canEmail, onClose, onPublish }: {
    post: Post;
    draft: Draft;
    labels: string[];
    canEmail: boolean;
    onClose: () => void;
    onPublish: (options: SaveOptions) => Promise<void>;
})
{
    const future = draft.published_at !== null && draft.published_at > Date.now() / 1000;
    const [when, setWhen] = useState<"now" | "later">(future ? "later" : "now");
    const [at, setAt] = useState(toLocalInput(future ? draft.published_at : Math.floor(Date.now() / 1000) + 3600));
    const [sendEmail, setSendEmail] = useState(canEmail);
    const [segment, setSegment] = useState(draft.email_segment || "all");
    const [busy, setBusy] = useState(false);
    const emailOnly = draft.delivery === "email";
    const scheduledAt = fromLocalInput(at);
    const invalid = when === "later" && (!scheduledAt || scheduledAt <= Date.now() / 1000);

    async function submit()
    {
        setBusy(true);
        await onPublish({
            status: when === "later" ? "scheduled" : "published",
            published_at: when === "later" ? scheduledAt : Math.floor(Date.now() / 1000),
            send_email: canEmail && sendEmail,
            email_segment: segment,
        });
        setBusy(false);
    }

    const action = when === "later" ? "Schedule" : canEmail && sendEmail ? (emailOnly ? "Send email" : "Publish and send") : "Publish";

    return (
        <Dialog
            open
            onClose={onClose}
            title={`Ready to ${when === "later" ? "schedule" : "publish"}?`}
            description={`“${draft.title || "Untitled"}”${draft.visibility !== "public" ? ` for ${draft.visibility === "paid" ? "paid members" : "members"}` : ""}`}
            footer={
                <>
                    <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
                    <button type="button" className="btn-primary" disabled={busy || invalid} onClick={submit}>{busy && <Spinner className="size-4" />}{action}</button>
                </>
            }
        >
            <div className="space-y-5">
                <div>
                    <p className="label">When</p>
                    <Segmented label="When to publish" value={when} onChange={setWhen} options={[{ value: "now", label: "Right now" }, { value: "later", label: "Schedule" }]} />
                    {when === "later" && (
                        <div className="mt-3">
                            <label htmlFor="publish-at" className="sr-only">Publish at</label>
                            <input id="publish-at" type="datetime-local" className="input" value={at} onChange={(event) =>
                            {
                                setAt(event.target.value);
                            }} />
                            {invalid && <p className="mt-1.5 text-xs text-red-600">Pick a time in the future.</p>}
                        </div>
                    )}
                </div>
                {canEmail ? (
                    <div className="rounded-xl bg-zinc-50 p-2 dark:bg-white/4">
                        <Switch checked={sendEmail} onChange={setSendEmail} label="Send as email" description={when === "later" ? "Goes out when the post publishes." : "Goes out as soon as you publish."} />
                        {sendEmail && (
                            <div className="px-2 pt-1 pb-2">
                                <label htmlFor="publish-segment" className="label">Send to</label>
                                <select id="publish-segment" className="input" value={segment} onChange={(event) =>
                                {
                                    setSegment(event.target.value);
                                }}>
                                    <option value="all">All subscribers</option>
                                    <option value="free">Free subscribers</option>
                                    <option value="paid">Paid members</option>
                                    {labels.map((label) => <option key={label} value={`label:${label}`}>Label: {label}</option>)}
                                </select>
                            </div>
                        )}
                    </div>
                ) : post.type === "post" && draft.delivery === "web" ? (
                    <p className="muted text-sm">This post goes on the web only. Switch delivery to Web + email in settings to send it to subscribers.</p>
                ) : null}
            </div>
        </Dialog>
    );
}

type Revision = { id: string; title: string; content: string; created_at: number; author: string };

function RevisionsDialog({ postId, onClose, onRestore }: { postId: string; onClose: () => void; onRestore: (revision: Revision) => Promise<void> })
{
    const [revisions, setRevisions] = useState<Revision[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [selected, setSelected] = useState<Revision | null>(null);

    useEffect(() =>
    {
        api<{ revisions: Revision[] }>(`/admin/posts/${postId}/revisions`).then((result) =>
        {
            setRevisions(result.revisions);
            setSelected(result.revisions[0] ?? null);
        }).catch((caught) =>
        {
            setError(errorMessage(caught));
        });
    }, [postId]);

    return (
        <Dialog
            open
            wide
            onClose={onClose}
            title="Revision history"
            description="A revision is kept each time you save or update. Autosaves don't count."
            footer={
                <>
                    <button type="button" className="btn-secondary" onClick={onClose}>Close</button>
                    <button type="button" className="btn-primary" disabled={!selected} onClick={() =>
                    {
                        if (selected)
                        {
                            void onRestore(selected);
                        }
                    }}>Restore this version</button>
                </>
            }
        >
            {error ? <p className="text-sm text-red-600">{error}</p>
                : !revisions ? <div className="space-y-2">{[0, 1, 2].map((key) => <div key={key} className="skeleton h-12" />)}</div>
                    : revisions.length === 0 ? <p className="muted py-6 text-center text-sm">No revisions yet. They appear after your first manual save.</p>
                        : (
                            <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
                                <ul className="flex max-h-80 flex-col gap-0.5 overflow-y-auto" role="listbox" aria-label="Revisions">
                                    {revisions.map((revision) => (
                                        <li key={revision.id}>
                                            <button type="button" role="option" aria-selected={selected?.id === revision.id} className="chip w-full flex-col items-start py-2 text-left" onClick={() =>
                                            {
                                                setSelected(revision);
                                            }}>
                                                <span className="text-sm">{timeAgo(revision.created_at)}</span>
                                                <span className="muted text-xs font-normal">{revision.author || "Unknown"} · {formatDate(revision.created_at, true)}</span>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                                {selected && (
                                    <div className="min-w-0 rounded-xl bg-zinc-50 p-4 dark:bg-white/4">
                                        <p className="font-semibold">{selected.title || "Untitled"}</p>
                                        <pre className="muted mt-2 max-h-64 overflow-y-auto font-mono text-xs leading-relaxed whitespace-pre-wrap">{selected.content.slice(0, 4000) || "Empty"}</pre>
                                    </div>
                                )}
                            </div>
                        )}
        </Dialog>
    );
}
