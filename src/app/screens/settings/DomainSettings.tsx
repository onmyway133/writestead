import { CheckCircle, Clock } from "@phosphor-icons/react";
import { useState } from "react";
import { Field } from "../../components/Field";
import { ProBadge } from "../../components/ProBadge";
import { Spinner } from "../../components/Spinner";
import { toast } from "../../components/Toast";
import { api, errorMessage } from "../../lib/api";
import { useSession } from "../../lib/session";
import { useApi } from "../../lib/useApi";
import { SettingsCard } from "../SettingsScreen";

type Status = { managed: boolean; status?: string; ssl?: string; records?: { type: string; name: string; value: string }[] };

export function DomainSettings()
{
    const { me, reload } = useSession();
    const [domain, setDomain] = useState(me.site.custom_domain ?? "");
    const [saving, setSaving] = useState(false);
    const allowed = me.entitlements.canUseCustomDomain;
    const status = useApi<Status>(me.mode === "multi" && me.site.custom_domain ? "/admin/domain/status" : null);

    if (me.mode === "single")
    {
        return (
            <SettingsCard title="Domain" description="Self-hosted blogs use whatever domain you attach to the Worker.">
                <ol className="muted list-decimal space-y-1.5 pl-5 text-sm">
                    <li>In the Cloudflare dashboard, open Workers and Pages, then this Worker.</li>
                    <li>Under Settings, Domains and Routes, add a custom domain like blog.example.com.</li>
                    <li>Cloudflare creates the DNS record and the SSL certificate for you.</li>
                </ol>
            </SettingsCard>
        );
    }

    async function save()
    {
        setSaving(true);
        try
        {
            await api("/admin/domain", { method: "PUT", body: { domain } });
            await reload();
            await status.reload();
            toast(domain ? "Domain saved. Add the DNS record next." : "Custom domain removed");
        }
        catch (caught)
        {
            toast(errorMessage(caught), "error");
        }
        setSaving(false);
    }

    const live = status.data?.status === "active" && status.data.ssl === "active";
    return (
        <SettingsCard
            title="Custom domain"
            badge={!allowed && <ProBadge />}
            description={<>Your blog always works at <strong>{me.site.subdomain}.{me.rootDomain}</strong>. Add your own domain to use it instead.</>}
            footer={<button type="button" className="btn-primary" disabled={!allowed || saving} onClick={save}>{saving && <Spinner />}Save domain</button>}
        >
            <Field label="Domain" name="domain" placeholder="blog.example.com" value={domain} disabled={!allowed} onChange={(event) =>
            {
                setDomain(event.target.value);
            }} />
            {me.site.custom_domain && (
                <div className="flex flex-col gap-3 rounded-xl bg-zinc-900/[0.03] p-4 text-sm dark:bg-white/[0.04]">
                    <p className="flex items-center gap-2 font-semibold">
                        {live ? <CheckCircle weight="fill" className="text-emerald-600" /> : <Clock className="text-amber-600" />}
                        {live ? `${me.site.custom_domain} is live` : "Waiting for DNS"}
                    </p>
                    <p className="muted">Add a CNAME record for <code>{me.site.custom_domain}</code> pointing to <code>custom.{me.rootDomain}</code>. The certificate is issued automatically once it resolves, usually within minutes.</p>
                    {status.data?.managed && !live && (status.data.records ?? []).length > 0 && (
                        <div>
                            <p className="font-medium">Also add these records to verify the domain:</p>
                            {status.data.records!.map((record) => (
                                <p key={record.name} className="mt-1 break-all font-mono text-xs">{record.type} {record.name} {record.value}</p>
                            ))}
                        </div>
                    )}
                    {status.data?.managed && (
                        <button type="button" className="btn-secondary btn-sm self-start" onClick={() =>
                        {
                            void status.reload();
                        }}>Check again</button>
                    )}
                </div>
            )}
        </SettingsCard>
    );
}
