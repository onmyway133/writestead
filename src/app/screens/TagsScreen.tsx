import { ArrowSquareOut, PencilSimple, Tag, Trash } from "@phosphor-icons/react";
import { type FormEvent, useState } from "react";
import { confirm } from "../components/ConfirmDialog";
import { Dialog } from "../components/Dialog";
import { EmptyState, ErrorState } from "../components/EmptyState";
import { Field, FormError } from "../components/Field";
import { PageHeader } from "../components/PageHeader";
import { TableSkeleton } from "../components/Skeleton";
import { toast } from "../components/Toast";
import { api, errorMessage } from "../lib/api";
import { useSession } from "../lib/session";
import { useApi } from "../lib/useApi";

type TagRow = { id: string; name: string; slug: string; description: string; count: number };

export function TagsScreen()
{
    const { me } = useSession();
    const { data, error, loading, reload } = useApi<{ tags: TagRow[] }>("/admin/tags");
    const [editing, setEditing] = useState<TagRow | null>(null);

    async function remove(tag: TagRow)
    {
        const ok = await confirm({
            title: "Delete this tag?",
            message: `“${tag.name}” will be removed from ${tag.count} post${tag.count === 1 ? "" : "s"}. The posts stay.`,
            confirmLabel: "Delete tag",
            destructive: true,
        });
        if (!ok)
        {
            return;
        }
        try
        {
            await api(`/admin/tags/${tag.id}`, { method: "DELETE" });
            toast(`Deleted “${tag.name}”`);
            await reload();
        }
        catch (caught)
        {
            toast(errorMessage(caught), "error");
        }
    }

    const tags = data?.tags ?? [];

    return (
        <div>
            <PageHeader title="Tags" description="Group posts by topic. Each tag gets its own page and feed on your blog." />
            {error && !data ? <ErrorState message={error} onRetry={reload} />
                : loading && !data ? <TableSkeleton rows={4} />
                    : tags.length === 0 ? (
                        <EmptyState icon={<Tag className="size-6" />} title="No tags yet" message="Add tags from a post's settings in the editor. They show up here once used." />
                    ) : (
                        <ul className="card divide-y divide-zinc-900/5 overflow-hidden dark:divide-white/5">
                            {tags.map((tag) => (
                                <li key={tag.id} className="group flex items-center gap-4 px-4 py-3.5 transition-colors duration-200 hover:bg-zinc-50 dark:hover:bg-white/3">
                                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand/8 text-brand dark:bg-brand/15">
                                        <Tag className="size-5" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-semibold">{tag.name}</p>
                                        <p className="muted truncate text-xs">/tag/{tag.slug}{tag.description && <> · {tag.description}</>}</p>
                                    </div>
                                    <span className="pill shrink-0 bg-zinc-100 text-zinc-600 dark:bg-white/8 dark:text-zinc-300">{tag.count} post{tag.count === 1 ? "" : "s"}</span>
                                    <div className="flex shrink-0 items-center gap-0.5 sm:opacity-0 sm:transition-opacity sm:duration-200 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                                        <a className="icon-btn" href={`${me.url}/tag/${tag.slug}`} target="_blank" rel="noopener" aria-label={`View ${tag.name}`} title="View">
                                            <ArrowSquareOut className="size-4" />
                                        </a>
                                        <button type="button" className="icon-btn" aria-label={`Edit ${tag.name}`} title="Edit" onClick={() =>
                                        {
                                            setEditing(tag);
                                        }}><PencilSimple className="size-4" /></button>
                                        <button type="button" className="icon-btn hover:!bg-red-50 hover:!text-red-600 dark:hover:!bg-red-500/10" aria-label={`Delete ${tag.name}`} title="Delete" onClick={() =>
                                        {
                                            void remove(tag);
                                        }}><Trash className="size-4" /></button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
            {editing && (
                <EditTagDialog tag={editing} onClose={() =>
                {
                    setEditing(null);
                }} onSaved={async () =>
                {
                    setEditing(null);
                    await reload();
                }} />
            )}
        </div>
    );
}

function EditTagDialog({ tag, onClose, onSaved }: { tag: TagRow; onClose: () => void; onSaved: () => Promise<void> })
{
    const [name, setName] = useState(tag.name);
    const [slug, setSlug] = useState(tag.slug);
    const [description, setDescription] = useState(tag.description);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function save(event: FormEvent)
    {
        event.preventDefault();
        setSaving(true);
        setError(null);
        try
        {
            await api(`/admin/tags/${tag.id}`, { method: "PUT", body: { name, slug, description } });
            toast(`Saved “${name}”`);
            await onSaved();
        }
        catch (caught)
        {
            setError(errorMessage(caught));
            setSaving(false);
        }
    }

    return (
        <Dialog open onClose={onClose} title="Edit tag">
            <form id="tag-form" className="space-y-4" onSubmit={save}>
                <FormError message={error} />
                <Field label="Name" name="name" required maxLength={80} value={name} onChange={(event) =>
                {
                    setName(event.target.value);
                }} />
                <Field label="Slug" name="slug" maxLength={80} value={slug} hint={`Shown at /tag/${slug || "..."}`} onChange={(event) =>
                {
                    setSlug(event.target.value);
                }} />
                <div>
                    <label htmlFor="tag-description" className="label">Description</label>
                    <textarea id="tag-description" className="input" maxLength={500} rows={3} value={description} onChange={(event) =>
                    {
                        setDescription(event.target.value);
                    }} />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                    <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
                    <button type="submit" className="btn-primary" disabled={saving}>Save tag</button>
                </div>
            </form>
        </Dialog>
    );
}
