import { Key, Plus, Trash, WebhooksLogo } from "@phosphor-icons/react";
import { useState } from "react";
import { confirm } from "../../components/ConfirmDialog";
import { Dialog } from "../../components/Dialog";
import { ProBadge } from "../../components/ProBadge";
import { toast } from "../../components/Toast";
import { api, errorMessage } from "../../lib/api";
import { formatDate } from "../../lib/format";
import { useSession } from "../../lib/session";
import { useApi } from "../../lib/useApi";
import { SettingsCard } from "../SettingsScreen";

type Data = { keys: { id: string; name: string; hint: string; created_at: number }[]; webhooks: { id: string; event: string; url: string }[]; events: string[] };

export function IntegrationsSettings()
{
    const { me } = useSession();
    const allowed = me.entitlements.canUseApi;
    const { data, reload } = useApi<Data>(allowed ? "/admin/integrations" : null);
    const [secret, setSecret] = useState<{ title: string; value: string } | null>(null);
    const [event, setEvent] = useState("post.published");
    const [url, setUrl] = useState("");

    if (!allowed)
    {
        return <SettingsCard title="API and webhooks" badge={<ProBadge />} description="Read your posts as JSON from anywhere and get notified when you publish."><a className="btn-primary self-start" href="/admin/settings/plan">See Pro</a></SettingsCard>;
    }

    return (
        <>
            <SettingsCard title="Content API keys" description={<>Read published posts at <code>{me.url}/api/v1/posts</code> with <code>Authorization: Bearer &lt;key&gt;</code>.</>} footer={<button type="button" className="btn-secondary" onClick={async () =>
            {
                try
                {
                    const result = await api<{ key: string }>("/admin/integrations/keys", { body: { name: "API key" } });
                    setSecret({ title: "Your new API key", value: result.key });
                    await reload();
                }
                catch (caught)
                {
                    toast(errorMessage(caught), "error");
                }
            }}><Plus />New key</button>}>
                {data?.keys.length === 0 && <p className="muted text-sm">No keys yet.</p>}
                {data?.keys.map((key) => (
                    <div key={key.id} className="flex items-center gap-3 rounded-xl p-3 hover:bg-zinc-900/[0.03] dark:hover:bg-white/[0.04]">
                        <span className="flex size-10 items-center justify-center rounded-xl bg-brand/12 text-brand"><Key /></span>
                        <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{key.name}</p><p className="muted font-mono text-xs">{key.hint} · created {formatDate(key.created_at)}</p></div>
                        <button type="button" className="icon-btn hover:text-red-600" aria-label="Revoke key" onClick={async () =>
                        {
                            if (await confirm({ title: "Revoke this key?", message: "Apps using it stop working right away.", confirmLabel: "Revoke", destructive: true }))
                            {
                                await api(`/admin/integrations/keys/${key.id}`, { method: "DELETE" });
                                await reload();
                            }
                        }}><Trash /></button>
                    </div>
                ))}
            </SettingsCard>
            <SettingsCard title="Webhooks" description="We POST JSON to your URL, signed with HMAC SHA256 in the X-Writestead-Signature header.">
                {data?.webhooks.map((hook) => (
                    <div key={hook.id} className="flex items-center gap-3 rounded-xl p-3 hover:bg-zinc-900/[0.03] dark:hover:bg-white/[0.04]">
                        <span className="flex size-10 items-center justify-center rounded-xl bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300"><WebhooksLogo /></span>
                        <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{hook.event}</p><p className="muted truncate text-xs">{hook.url}</p></div>
                        <button type="button" className="icon-btn hover:text-red-600" aria-label="Delete webhook" onClick={async () =>
                        {
                            await api(`/admin/integrations/webhooks/${hook.id}`, { method: "DELETE" });
                            await reload();
                        }}><Trash /></button>
                    </div>
                ))}
                <div className="flex flex-wrap gap-2">
                    <select className="input w-48" aria-label="Event" value={event} onChange={(change) =>
                    {
                        setEvent(change.target.value);
                    }}>{data?.events.map((name) => <option key={name}>{name}</option>)}</select>
                    <input className="input min-w-0 flex-1" aria-label="Webhook URL" placeholder="https://example.com/hooks/writestead" value={url} onChange={(change) =>
                    {
                        setUrl(change.target.value);
                    }} />
                    <button type="button" className="btn-secondary" onClick={async () =>
                    {
                        try
                        {
                            const result = await api<{ secret: string }>("/admin/integrations/webhooks", { body: { event, url } });
                            setSecret({ title: "Webhook signing secret", value: result.secret });
                            setUrl("");
                            await reload();
                        }
                        catch (caught)
                        {
                            toast(errorMessage(caught), "error");
                        }
                    }}>Add webhook</button>
                </div>
            </SettingsCard>
            <Dialog open={secret !== null} onClose={() =>
            {
                setSecret(null);
            }} title={secret?.title ?? ""} description="Copy it now. It won't be shown again." footer={<button type="button" className="btn-primary" onClick={() =>
            {
                setSecret(null);
            }}>Done</button>}>
                <input className="input font-mono text-xs" readOnly value={secret?.value ?? ""} onFocus={(focus) =>
                {
                    focus.target.select();
                }} />
            </Dialog>
        </>
    );
}
