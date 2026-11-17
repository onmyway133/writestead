import { Image, Trash, UploadSimple, X } from "@phosphor-icons/react";
import { type KeyboardEvent, type ReactNode, useRef, useState } from "react";
import type { Post } from "../../../shared/types";
import { errorMessage } from "../../lib/api";
import { Segmented } from "../Segmented";
import { Spinner } from "../Spinner";
import { Switch } from "../Switch";
import { toast } from "../Toast";
import { fromLocalInput, toLocalInput, uploadMedia } from "./upload";

export type Draft = Pick<Post,
    "title" | "slug" | "excerpt" | "content" | "cover_image" | "visibility" | "featured" | "delivery" | "email_segment"
    | "meta_title" | "meta_description" | "canonical_url" | "og_image" | "published_at" | "author_ids" | "tag_names">;

type Staff = { id: string; name: string; avatar: string };

export function SettingsDrawer({ open, onClose, draft, update, post, siteUrl, staff, labels, canManage }: {
    open: boolean;
    onClose: () => void;
    draft: Draft;
    update: (patch: Partial<Draft>) => void;
    post: Post;
    siteUrl: string;
    staff: Staff[];
    labels: string[];
    canManage: boolean;
})
{
    const isPage = post.type === "page";
    return (
        <>
            {open && <button type="button" aria-label="Close settings" className="fixed inset-0 z-30 bg-zinc-950/20 animate-fade-in xl:hidden" onClick={onClose} />}
            <aside
                aria-label={`${isPage ? "Page" : "Post"} settings`}
                className={`fixed inset-y-0 right-0 z-40 flex w-full max-w-[380px] flex-col bg-white shadow-[-1px_0_0_rgb(21_18_43/0.06),-16px_0_48px_rgb(21_18_43/0.08)] transition-transform duration-500 ease-out-soft dark:bg-[#181818] ${open ? "translate-x-0" : "pointer-events-none translate-x-full"}`}
            >
                <div className="flex items-center justify-between px-5 py-4">
                    <h2 className="text-base font-semibold">{isPage ? "Page" : "Post"} settings</h2>
                    <button type="button" className="icon-btn" onClick={onClose} aria-label="Close settings"><X /></button>
                </div>
                <div className="flex-1 space-y-6 overflow-y-auto px-5 pb-10">
                    <Section title="Address">
                        <label htmlFor="post-slug" className="label">Slug</label>
                        <input id="post-slug" className="input" value={draft.slug} onChange={(event) =>
                        {
                            update({ slug: event.target.value });
                        }} />
                        <p className="muted mt-1.5 truncate text-xs">{siteUrl.replace(/^https?:\/\//, "")}/{draft.slug}</p>
                    </Section>

                    {!isPage && (
                        <Section title="Excerpt">
                            <label htmlFor="post-excerpt" className="sr-only">Excerpt</label>
                            <textarea id="post-excerpt" className="input" rows={3} maxLength={600} placeholder="A short summary for lists and emails. Leave empty to use the first lines." value={draft.excerpt} onChange={(event) =>
                            {
                                update({ excerpt: event.target.value });
                            }} />
                        </Section>
                    )}

                    <Section title="Cover image">
                        <ImagePicker value={draft.cover_image} onChange={(url) =>
                        {
                            update({ cover_image: url });
                        }} label="cover image" />
                    </Section>

                    {!isPage && (
                        <Section title="Tags">
                            <TagInput value={draft.tag_names} onChange={(tag_names) =>
                            {
                                update({ tag_names });
                            }} />
                        </Section>
                    )}

                    {!isPage && canManage && staff.length > 1 && (
                        <Section title="Authors">
                            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Authors">
                                {staff.map((person) =>
                                {
                                    const selected = draft.author_ids.includes(person.id);
                                    return (
                                        <button key={person.id} type="button" className="chip" aria-pressed={selected} onClick={() =>
                                        {
                                            const next = selected ? draft.author_ids.filter((id) => id !== person.id) : [...draft.author_ids, person.id];
                                            if (next.length > 0)
                                            {
                                                update({ author_ids: next });
                                            }
                                        }}>
                                            {person.avatar
                                                ? <img src={person.avatar} alt="" className="size-5 rounded-full object-cover" />
                                                : <span className="flex size-5 items-center justify-center rounded-full bg-brand text-[10px] font-semibold text-white">{person.name.slice(0, 1).toUpperCase()}</span>}
                                            {person.name}
                                        </button>
                                    );
                                })}
                            </div>
                        </Section>
                    )}

                    <Section title="Access">
                        <Segmented
                            label="Who can read this"
                            value={draft.visibility}
                            onChange={(visibility) =>
                            {
                                update({ visibility });
                            }}
                            options={[
                                { value: "public", label: "Public" },
                                { value: "members", label: "Members" },
                                { value: "paid", label: "Paid" },
                            ]}
                        />
                        {draft.visibility !== "public" && (
                            <p className="muted mt-2 text-xs">
                                {draft.content.includes("<!--paywall-->")
                                    ? "Everyone sees the part above the paywall line. The rest is for " + (draft.visibility === "paid" ? "paid members." : "subscribers.")
                                    : "Only the excerpt shows to others. Add a paywall line from the toolbar to show a longer preview."}
                            </p>
                        )}
                    </Section>

                    {!isPage && (
                        <Section title="Delivery">
                            <Segmented
                                label="Where this post goes"
                                value={draft.delivery}
                                onChange={(delivery) =>
                                {
                                    update({ delivery });
                                }}
                                options={[
                                    { value: "web", label: "Web" },
                                    { value: "both", label: "Web + email" },
                                    { value: "email", label: "Email only" },
                                ]}
                            />
                            {draft.delivery !== "web" && (
                                <div className="mt-3">
                                    <label htmlFor="post-segment" className="label">Send to</label>
                                    <select id="post-segment" className="input" value={draft.email_segment || "all"} onChange={(event) =>
                                    {
                                        update({ email_segment: event.target.value });
                                    }}>
                                        <option value="all">All subscribers</option>
                                        <option value="free">Free subscribers</option>
                                        <option value="paid">Paid members</option>
                                        {labels.map((label) => <option key={label} value={`label:${label}`}>Label: {label}</option>)}
                                    </select>
                                    {post.emailed_at && <p className="muted mt-1.5 text-xs">Already sent by email.</p>}
                                </div>
                            )}
                        </Section>
                    )}

                    {!isPage && (
                        <Section title="Options">
                            <Switch checked={draft.featured === 1} onChange={(checked) =>
                            {
                                update({ featured: checked ? 1 : 0 });
                            }} label="Feature this post" description="Featured posts show at the top of your home page." />
                            <div className="mt-3">
                                <label htmlFor="post-date" className="label">Publish date</label>
                                <input id="post-date" type="datetime-local" className="input" value={toLocalInput(draft.published_at)} onChange={(event) =>
                                {
                                    update({ published_at: fromLocalInput(event.target.value) });
                                }} />
                                <p className="muted mt-1.5 text-xs">A future date schedules the post when you publish.</p>
                            </div>
                        </Section>
                    )}

                    <Section title="Search and social">
                        <div className="space-y-3">
                            <CountedInput id="meta-title" label="Meta title" value={draft.meta_title} limit={60} placeholder={draft.title || "Title"} onChange={(meta_title) =>
                            {
                                update({ meta_title });
                            }} />
                            <CountedInput id="meta-description" label="Meta description" value={draft.meta_description} limit={155} placeholder={draft.excerpt || "Description"} multiline onChange={(meta_description) =>
                            {
                                update({ meta_description });
                            }} />
                            <div>
                                <label htmlFor="canonical" className="label">Canonical URL</label>
                                <input id="canonical" className="input" type="url" placeholder="https://… if this first appeared elsewhere" value={draft.canonical_url} onChange={(event) =>
                                {
                                    update({ canonical_url: event.target.value });
                                }} />
                            </div>
                            <div>
                                <p className="label">Social image</p>
                                <ImagePicker value={draft.og_image} onChange={(url) =>
                                {
                                    update({ og_image: url });
                                }} label="social image" hint="Uses the cover image when empty." />
                            </div>
                            <SocialPreview draft={draft} siteUrl={siteUrl} />
                        </div>
                    </Section>
                </div>
            </aside>
        </>
    );
}

function Section({ title, children }: { title: string; children: ReactNode })
{
    return (
        <section>
            <h3 className="mb-2 text-xs font-semibold tracking-wider text-zinc-400 uppercase">{title}</h3>
            {children}
        </section>
    );
}

function CountedInput({ id, label, value, limit, placeholder, multiline, onChange }: { id: string; label: string; value: string; limit: number; placeholder: string; multiline?: boolean; onChange: (value: string) => void })
{
    const over = value.length > limit;
    return (
        <div>
            <div className="flex items-baseline justify-between">
                <label htmlFor={id} className="label">{label}</label>
                <span className={`text-xs ${over ? "text-amber-600" : "muted"}`}>{value.length}/{limit}</span>
            </div>
            {multiline
                ? <textarea id={id} className="input" rows={3} value={value} placeholder={placeholder} onChange={(event) =>
                {
                    onChange(event.target.value);
                }} />
                : <input id={id} className="input" value={value} placeholder={placeholder} onChange={(event) =>
                {
                    onChange(event.target.value);
                }} />}
        </div>
    );
}

function SocialPreview({ draft, siteUrl }: { draft: Draft; siteUrl: string })
{
    const image = draft.og_image || draft.cover_image;
    const title = draft.meta_title || draft.title || "Untitled";
    const description = draft.meta_description || draft.excerpt;
    const host = siteUrl.replace(/^https?:\/\//, "");
    return (
        <div className="space-y-3 pt-1">
            <div className="rounded-xl bg-zinc-50 p-3 dark:bg-white/4">
                <p className="muted text-[11px] font-medium uppercase">Search result</p>
                <p className="mt-1.5 truncate text-xs text-zinc-500">{host} › {draft.slug}</p>
                <p className="truncate text-[15px] text-[#1a0dab] dark:text-[#8ab4f8]">{title}</p>
                <p className="line-clamp-2 text-xs text-zinc-600 dark:text-zinc-400">{description || "Add a meta description or an excerpt."}</p>
            </div>
            <div className="overflow-hidden rounded-xl bg-zinc-50 dark:bg-white/4">
                <div className="flex aspect-[1.91/1] items-center justify-center bg-zinc-200/70 dark:bg-white/6">
                    {image ? <img src={image} alt="" className="size-full object-cover" /> : <Image className="size-6 text-zinc-400" />}
                </div>
                <div className="p-3">
                    <p className="muted text-[11px] uppercase">{host}</p>
                    <p className="truncate text-sm font-semibold">{title}</p>
                    <p className="muted line-clamp-1 text-xs">{description}</p>
                </div>
            </div>
        </div>
    );
}

function ImagePicker({ value, onChange, label, hint }: { value: string; onChange: (url: string) => void; label: string; hint?: string })
{
    const input = useRef<HTMLInputElement>(null);
    const [busy, setBusy] = useState(false);

    async function pick(file: File | undefined)
    {
        if (!file)
        {
            return;
        }
        setBusy(true);
        try
        {
            onChange(await uploadMedia(file));
        }
        catch (caught)
        {
            toast(errorMessage(caught), "error");
        }
        finally
        {
            setBusy(false);
        }
    }

    return (
        <div>
            <input ref={input} type="file" accept="image/*" hidden onChange={(event) =>
            {
                void pick(event.target.files?.[0]);
                event.target.value = "";
            }} />
            {value ? (
                <div className="group relative overflow-hidden rounded-xl">
                    <img src={value} alt="" className="aspect-video w-full object-cover" />
                    <div className="absolute inset-0 flex items-center justify-center gap-2 bg-zinc-950/40 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
                        <button type="button" className="btn-secondary btn-sm" onClick={() =>
                        {
                            input.current?.click();
                        }}>Replace</button>
                        <button type="button" className="btn-secondary btn-sm" aria-label={`Remove ${label}`} onClick={() =>
                        {
                            onChange("");
                        }}><Trash className="size-3.5" /></button>
                    </div>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={() =>
                    {
                        input.current?.click();
                    }}
                    onDragOver={(event) =>
                    {
                        event.preventDefault();
                    }}
                    onDrop={(event) =>
                    {
                        event.preventDefault();
                        void pick(event.dataTransfer.files[0]);
                    }}
                    className="flex aspect-video w-full flex-col items-center justify-center gap-1.5 rounded-xl bg-zinc-50 text-sm text-zinc-500 transition-colors duration-200 hover:bg-brand/6 hover:text-brand dark:bg-white/4"
                >
                    {busy ? <Spinner className="size-5" /> : <UploadSimple className="size-5" />}
                    <span className="font-medium">{busy ? "Uploading" : `Add ${label}`}</span>
                    {hint && <span className="text-xs opacity-80">{hint}</span>}
                </button>
            )}
        </div>
    );
}

function TagInput({ value, onChange }: { value: string[]; onChange: (value: string[]) => void })
{
    const [text, setText] = useState("");

    function commit(raw: string)
    {
        const names = raw.split(",").map((name) => name.trim()).filter(Boolean);
        const next = [...value];
        for (const name of names)
        {
            if (!next.some((existing) => existing.toLowerCase() === name.toLowerCase()))
            {
                next.push(name);
            }
        }
        if (next.length !== value.length)
        {
            onChange(next);
        }
        setText("");
    }

    return (
        <div className="input flex min-h-10 flex-wrap items-center gap-1.5 py-1.5">
            {value.map((tag) => (
                <span key={tag} className="pill bg-brand/10 py-1 text-brand dark:bg-brand/20 dark:text-violet-200">
                    {tag}
                    <button type="button" aria-label={`Remove tag ${tag}`} className="-mr-0.5 rounded-full p-0.5 hover:bg-brand/15" onClick={() =>
                    {
                        onChange(value.filter((other) => other !== tag));
                    }}><X className="size-3" /></button>
                </span>
            ))}
            <label htmlFor="post-tags" className="sr-only">Add tags</label>
            <input
                id="post-tags"
                className="min-w-24 flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-400"
                placeholder={value.length === 0 ? "Add tags, press Enter" : ""}
                value={text}
                onChange={(event) =>
                {
                    if (event.target.value.includes(","))
                    {
                        commit(event.target.value);
                    }
                    else
                    {
                        setText(event.target.value);
                    }
                }}
                onKeyDown={(event: KeyboardEvent<HTMLInputElement>) =>
                {
                    if (event.key === "Enter")
                    {
                        event.preventDefault();
                        commit(text);
                    }
                    else if (event.key === "Backspace" && text === "" && value.length > 0)
                    {
                        onChange(value.slice(0, -1));
                    }
                }}
                onBlur={() =>
                {
                    if (text.trim())
                    {
                        commit(text);
                    }
                }}
            />
        </div>
    );
}
