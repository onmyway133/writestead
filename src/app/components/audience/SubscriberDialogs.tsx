import { FileCsv } from "@phosphor-icons/react";
import { type FormEvent, useEffect, useState } from "react";
import { api, errorMessage } from "../../lib/api";
import { formatDate, money } from "../../lib/format";
import { Dialog } from "../Dialog";
import { Field, FormError } from "../Field";
import { Segmented } from "../Segmented";
import { Spinner } from "../Spinner";
import { Switch } from "../Switch";
import { toast } from "../Toast";
import type { Subscriber } from "./types";

export function AddSubscriberDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void })
{
    const [email, setEmail] = useState("");
    const [name, setName] = useState("");
    const [labels, setLabels] = useState("");
    const [comp, setComp] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() =>
    {
        if (open)
        {
            setEmail("");
            setName("");
            setLabels("");
            setComp(false);
            setError(null);
        }
    }, [open]);

    async function submit(event: FormEvent)
    {
        event.preventDefault();
        setSaving(true);
        setError(null);
        try
        {
            await api("/admin/subscribers", { body: { email, name, labels, tier: comp ? "comp" : "free" } });
            toast(`${email} added`);
            onSaved();
            onClose();
        }
        catch (caught)
        {
            setError(errorMessage(caught));
        }
        finally
        {
            setSaving(false);
        }
    }

    return (
        <Dialog open={open} onClose={onClose} title="Add a subscriber" description="They're added as confirmed, so only add people who asked to hear from you.">
            <form id="add-subscriber" onSubmit={submit} className="flex flex-col gap-4">
                <Field label="Email" name="email" type="email" required autoFocus value={email} onChange={(event) =>
                {
                    setEmail(event.target.value);
                }} placeholder="reader@example.com" />
                <Field label="Name" name="name" value={name} onChange={(event) =>
                {
                    setName(event.target.value);
                }} placeholder="Optional" />
                <Field label="Labels" name="labels" value={labels} onChange={(event) =>
                {
                    setLabels(event.target.value);
                }} placeholder="vip, conference" hint="Separate labels with commas. Use them to send to a segment." />
                <Switch checked={comp} onChange={setComp} label="Complimentary paid access" description="They can read paid posts without paying." />
                <FormError message={error} />
                <div className="flex justify-end gap-2">
                    <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
                    <button type="submit" className="btn-primary" disabled={saving}>{saving && <Spinner />}Add subscriber</button>
                </div>
            </form>
        </Dialog>
    );
}

export function ImportDialog({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void })
{
    const [file, setFile] = useState<File | null>(null);
    const [labels, setLabels] = useState("");
    const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() =>
    {
        if (open)
        {
            setFile(null);
            setLabels("");
            setResult(null);
            setError(null);
        }
    }, [open]);

    async function submit(event: FormEvent)
    {
        event.preventDefault();
        if (!file)
        {
            setError("Choose a CSV file first.");
            return;
        }
        if (file.size > 20 * 1024 * 1024)
        {
            setError("That file is over 20 MB. Split it into smaller files.");
            return;
        }
        setSaving(true);
        setError(null);
        try
        {
            const csv = await file.text();
            const response = await api<{ imported: number; skipped: number }>("/admin/subscribers/import", { body: { csv, labels } });
            setResult(response);
            onDone();
        }
        catch (caught)
        {
            setError(errorMessage(caught));
        }
        finally
        {
            setSaving(false);
        }
    }

    return (
        <Dialog open={open} onClose={onClose} title="Import subscribers" description="Upload a CSV with an email column. Name and labels columns are picked up too. Existing emails are skipped.">
            {result
                ? (
                    <div className="flex flex-col gap-4">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-xl bg-emerald-50 p-4 dark:bg-emerald-500/10"><p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">Imported</p><p className="text-2xl font-semibold tabular-nums">{result.imported}</p></div>
                            <div className="rounded-xl bg-zinc-50 p-4 dark:bg-white/4"><p className="muted text-xs font-medium">Skipped</p><p className="text-2xl font-semibold tabular-nums">{result.skipped}</p></div>
                        </div>
                        <p className="muted text-sm">Rows are skipped when the email is invalid or you hit your plan's subscriber limit. Emails already on your list are left as they are.</p>
                        <div className="flex justify-end"><button type="button" className="btn-primary" onClick={onClose}>Done</button></div>
                    </div>
                )
                : (
                    <form onSubmit={submit} className="flex flex-col gap-4">
                        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl bg-zinc-50 px-6 py-8 text-center transition-colors duration-200 hover:bg-brand/6 dark:bg-white/4">
                            <FileCsv className="size-8 text-brand" />
                            <span className="text-sm font-medium">{file ? file.name : "Choose a CSV file"}</span>
                            <span className="muted text-xs">Exports from Substack, Ghost, Mailchimp, Buttondown and most tools work</span>
                            <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(event) =>
                            {
                                setFile(event.target.files?.[0] ?? null);
                            }} />
                        </label>
                        <Field label="Add labels to everyone in this file" name="import-labels" value={labels} onChange={(event) =>
                        {
                            setLabels(event.target.value);
                        }} placeholder="imported" />
                        <FormError message={error} />
                        <div className="flex justify-end gap-2">
                            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
                            <button type="submit" className="btn-primary" disabled={saving || !file}>{saving && <Spinner />}Import</button>
                        </div>
                    </form>
                )}
        </Dialog>
    );
}

export function EditSubscriberDialog({ subscriber, onClose, onSaved }: { subscriber: Subscriber | null; onClose: () => void; onSaved: () => void })
{
    const [name, setName] = useState("");
    const [labels, setLabels] = useState("");
    const [status, setStatus] = useState<"active" | "unsubscribed">("active");
    const [comp, setComp] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() =>
    {
        if (subscriber)
        {
            setName(subscriber.name);
            setLabels(subscriber.labels.split(",").filter(Boolean).join(", "));
            setStatus(subscriber.status === "unsubscribed" ? "unsubscribed" : "active");
            setComp(subscriber.tier === "comp");
            setError(null);
        }
    }, [subscriber]);

    async function submit(event: FormEvent)
    {
        event.preventDefault();
        if (!subscriber)
        {
            return;
        }
        setSaving(true);
        setError(null);
        try
        {
            const tier = subscriber.tier === "paid" ? "paid" : comp ? "comp" : "free";
            const nextStatus = subscriber.status === "pending" || subscriber.status === "bounced" ? subscriber.status : status;
            await api(`/admin/subscribers/${subscriber.id}`, { method: "PUT", body: { name, labels, tier, status: nextStatus } });
            toast("Subscriber saved");
            onSaved();
            onClose();
        }
        catch (caught)
        {
            setError(errorMessage(caught));
        }
        finally
        {
            setSaving(false);
        }
    }

    return (
        <Dialog open={subscriber !== null} onClose={onClose} title={subscriber?.email ?? ""} description={subscriber ? `Joined ${formatDate(subscriber.created_at)}${subscriber.source ? ` from ${subscriber.source}` : ""}` : undefined}>
            {subscriber && (
                <form onSubmit={submit} className="flex flex-col gap-4">
                    {subscriber.tier === "paid" && (
                        <p className="rounded-xl bg-brand/8 p-3 text-sm dark:bg-brand/15">
                            Paid member{subscriber.amount ? `, ${money(subscriber.amount, subscriber.currency)}${subscriber.interval ? ` per ${subscriber.interval}` : ""}` : ""}. Manage the subscription in Stripe.
                        </p>
                    )}
                    <Field label="Name" name="edit-name" value={name} onChange={(event) =>
                    {
                        setName(event.target.value);
                    }} />
                    <Field label="Labels" name="edit-labels" value={labels} onChange={(event) =>
                    {
                        setLabels(event.target.value);
                    }} hint="Separate labels with commas." />
                    {(subscriber.status === "active" || subscriber.status === "unsubscribed") && (
                        <div>
                            <p className="label">Newsletter</p>
                            <Segmented label="Newsletter status" value={status} onChange={setStatus} options={[{ value: "active", label: "Subscribed" }, { value: "unsubscribed", label: "Unsubscribed" }]} />
                        </div>
                    )}
                    {subscriber.status === "pending" && <p className="muted text-sm">This person hasn't confirmed their email yet.</p>}
                    {subscriber.tier !== "paid" && <Switch checked={comp} onChange={setComp} label="Complimentary paid access" description="Read paid posts without paying." />}
                    <FormError message={error} />
                    <div className="flex justify-end gap-2">
                        <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn-primary" disabled={saving}>{saving && <Spinner />}Save</button>
                    </div>
                </form>
            )}
        </Dialog>
    );
}
