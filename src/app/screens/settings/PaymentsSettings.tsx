import { CreditCard, Plus, Star, Trash } from "@phosphor-icons/react";
import { useState } from "react";
import { confirm } from "../../components/ConfirmDialog";
import { Dialog } from "../../components/Dialog";
import { Field } from "../../components/Field";
import { ProBadge } from "../../components/ProBadge";
import { Switch } from "../../components/Switch";
import { toast } from "../../components/Toast";
import { api, errorMessage } from "../../lib/api";
import { money } from "../../lib/format";
import { useSession } from "../../lib/session";
import { useApi } from "../../lib/useApi";
import { SettingsCard } from "../SettingsScreen";
import { SaveButtons } from "./SaveBar";
import { useSiteDraft } from "./useSiteDraft";

type Tier = { id: string; name: string; description: string; monthly_price: number; yearly_price: number; currency: string; benefits: string; active: number };
type Account = { id: string; provider: string; label: string; hint: string; is_default: number; has_webhook: number };

export function PaymentsSettings()
{
    const { me } = useSession();
    const { draft, set, save, saving, dirty, reset } = useSiteDraft();
    const { data, reload } = useApi<{ tiers: Tier[]; accounts: Account[]; webhookBase: string }>(me.entitlements.canUsePaidMembers ? "/admin/tiers" : null);
    const [editing, setEditing] = useState<Partial<Tier> | null>(null);
    const [adding, setAdding] = useState(false);

    if (!me.entitlements.canUsePaidMembers)
    {
        return (
            <SettingsCard title="Paid memberships" badge={<ProBadge />} description="Charge for some posts or for everything, with monthly and yearly plans paid straight into your own Stripe account.">
                <a className="btn-primary self-start" href="/admin/settings/plan">See Pro</a>
            </SettingsCard>
        );
    }

    async function saveTier()
    {
        try
        {
            await api("/admin/tiers", { body: editing });
            setEditing(null);
            await reload();
            toast("Tier saved");
        }
        catch (caught)
        {
            toast(errorMessage(caught), "error");
        }
    }

    return (
        <>
            <SettingsCard title="Paid memberships" footer={<SaveButtons dirty={dirty} saving={saving} onSave={save} onReset={reset} />}>
                <Switch label="Offer paid memberships" description="Shows paid tiers on /subscribe and lets you mark posts as paid." checked={draft.settings.paidEnabled} onChange={(value) =>
                {
                    set("paidEnabled", value);
                }} />
            </SettingsCard>
            <SettingsCard title="Tiers" description="What readers can pay for. Prices are in the smallest unit of the currency at checkout." footer={<button type="button" className="btn-secondary" onClick={() =>
            {
                setEditing({ name: "", monthly_price: 500, yearly_price: 5000, currency: "usd", benefits: "", description: "", active: 1 });
            }}><Plus />Add tier</button>}>
                {data?.tiers.length === 0 && <p className="muted text-sm">No paid tiers yet. Add one to start taking payments.</p>}
                {data?.tiers.map((tier) => (
                    <div key={tier.id} className="group flex items-center gap-3 rounded-xl p-3 transition-colors hover:bg-zinc-900/[0.03] dark:hover:bg-white/[0.04]">
                        <span className="flex size-10 items-center justify-center rounded-xl bg-brand/12 text-brand"><Star weight="fill" /></span>
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold">{tier.name} {!tier.active && <span className="pill bg-zinc-100 text-zinc-500 dark:bg-white/8">Hidden</span>}</p>
                            <p className="muted text-xs">{money(tier.monthly_price, tier.currency)} a month{tier.yearly_price ? ` · ${money(tier.yearly_price, tier.currency)} a year` : ""}</p>
                        </div>
                        <button type="button" className="btn-ghost btn-sm" onClick={() =>
                        {
                            setEditing(tier);
                        }}>Edit</button>
                        <button type="button" className="icon-btn hover:text-red-600" aria-label={`Delete ${tier.name}`} onClick={async () =>
                        {
                            if (await confirm({ title: `Delete ${tier.name}?`, message: "Existing members keep their access until their subscription ends.", confirmLabel: "Delete", destructive: true }))
                            {
                                await api(`/admin/tiers/${tier.id}`, { method: "DELETE" }).catch((caught) =>
                                {
                                    toast(errorMessage(caught), "error");
                                });
                                await reload();
                            }
                        }}><Trash /></button>
                    </div>
                ))}
            </SettingsCard>
            <SettingsCard title="Payment accounts" description="Connect one or more Stripe accounts. Checkout uses the default one. Money goes directly to you." footer={<button type="button" className="btn-secondary" onClick={() =>
            {
                setAdding(true);
            }}><Plus />Connect Stripe</button>}>
                {data?.accounts.length === 0 && <p className="muted text-sm">No accounts connected.</p>}
                {data?.accounts.map((account) => (
                    <div key={account.id} className="flex flex-wrap items-center gap-3 rounded-xl p-3 transition-colors hover:bg-zinc-900/[0.03] dark:hover:bg-white/[0.04]">
                        <span className="flex size-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300"><CreditCard /></span>
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold">{account.label} {account.is_default ? <span className="pill bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">Default</span> : null}</p>
                            <p className="muted truncate text-xs">{account.hint}… · Webhook: <code>{data.webhookBase}{account.id}</code>{account.has_webhook ? "" : " (signing secret missing)"}</p>
                        </div>
                        {!account.is_default && <button type="button" className="btn-ghost btn-sm" onClick={async () =>
                        {
                            await api(`/admin/payment-accounts/${account.id}/default`, { method: "PUT" });
                            await reload();
                        }}>Make default</button>}
                        <button type="button" className="icon-btn hover:text-red-600" aria-label="Disconnect" onClick={async () =>
                        {
                            if (await confirm({ title: "Disconnect this account?", message: "New checkouts will use another account.", confirmLabel: "Disconnect", destructive: true }))
                            {
                                await api(`/admin/payment-accounts/${account.id}`, { method: "DELETE" });
                                await reload();
                            }
                        }}><Trash /></button>
                    </div>
                ))}
                <p className="muted text-xs">In Stripe, add a webhook endpoint with the URL shown above for the events checkout.session.completed and customer.subscription.deleted, then paste its signing secret here.</p>
            </SettingsCard>

            <Dialog open={editing !== null} onClose={() =>
            {
                setEditing(null);
            }} title={editing?.id ? "Edit tier" : "New tier"} footer={<><button type="button" className="btn-secondary" onClick={() =>
            {
                setEditing(null);
            }}>Cancel</button><button type="button" className="btn-primary" onClick={saveTier}>Save tier</button></>}>
                {editing && (
                    <div className="flex flex-col gap-4">
                        <Field label="Name" name="tier-name" value={editing.name ?? ""} placeholder="Supporter" onChange={(event) =>
                        {
                            setEditing({ ...editing, name: event.target.value });
                        }} />
                        <div className="grid grid-cols-3 gap-3">
                            <Field label="Monthly" name="monthly" type="number" min={1} step="0.01" value={(editing.monthly_price ?? 0) / 100} onChange={(event) =>
                            {
                                setEditing({ ...editing, monthly_price: Math.round(Number(event.target.value) * 100) });
                            }} />
                            <Field label="Yearly" name="yearly" type="number" min={0} step="0.01" value={(editing.yearly_price ?? 0) / 100} onChange={(event) =>
                            {
                                setEditing({ ...editing, yearly_price: Math.round(Number(event.target.value) * 100) });
                            }} />
                            <Field label="Currency" name="currency" maxLength={3} value={editing.currency ?? "usd"} onChange={(event) =>
                            {
                                setEditing({ ...editing, currency: event.target.value.toLowerCase() });
                            }} />
                        </div>
                        <Field label="Description" name="tier-description" value={editing.description ?? ""} onChange={(event) =>
                        {
                            setEditing({ ...editing, description: event.target.value });
                        }} />
                        <div>
                            <label className="label" htmlFor="benefits">Benefits, one per line</label>
                            <textarea id="benefits" className="input" rows={4} value={editing.benefits ?? ""} onChange={(event) =>
                            {
                                setEditing({ ...editing, benefits: event.target.value });
                            }} placeholder={"Every paid post\nMonthly Q&A\nEarly access"} />
                        </div>
                        <Switch label="Show on the subscribe page" checked={editing.active !== 0} onChange={(value) =>
                        {
                            setEditing({ ...editing, active: value ? 1 : 0 });
                        }} />
                    </div>
                )}
            </Dialog>
            <AddAccountDialog open={adding} onClose={() =>
            {
                setAdding(false);
            }} onAdded={reload} />
        </>
    );
}

function AddAccountDialog({ open, onClose, onAdded }: { open: boolean; onClose: () => void; onAdded: () => Promise<void> })
{
    const [label, setLabel] = useState("");
    const [secret, setSecret] = useState("");
    const [webhook, setWebhook] = useState("");
    async function add()
    {
        try
        {
            await api("/admin/payment-accounts", { body: { provider: "stripe", label, secret, webhook_secret: webhook } });
            setLabel("");
            setSecret("");
            setWebhook("");
            onClose();
            await onAdded();
        }
        catch (caught)
        {
            toast(errorMessage(caught), "error");
        }
    }
    return (
        <Dialog open={open} onClose={onClose} title="Connect a Stripe account" description="Use a restricted key with write access to Checkout Sessions, or a secret key. It is stored on your blog and never shown again." footer={<><button type="button" className="btn-secondary" onClick={onClose}>Cancel</button><button type="button" className="btn-primary" onClick={add}>Connect</button></>}>
            <div className="flex flex-col gap-4">
                <Field label="Label" name="label" placeholder="Main Stripe" value={label} onChange={(event) =>
                {
                    setLabel(event.target.value);
                }} />
                <Field label="Secret or restricted key" name="secret" type="password" placeholder="rk_live_…" value={secret} onChange={(event) =>
                {
                    setSecret(event.target.value);
                }} />
                <Field label="Webhook signing secret" name="webhook" type="password" placeholder="whsec_…" value={webhook} onChange={(event) =>
                {
                    setWebhook(event.target.value);
                }} hint="Optional now, needed before members can be upgraded automatically." />
            </div>
        </Dialog>
    );
}
