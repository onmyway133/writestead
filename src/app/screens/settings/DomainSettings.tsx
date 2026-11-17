import { useState } from "react";
import { Field } from "../../components/Field";
import { ProBadge } from "../../components/ProBadge";
import { Spinner } from "../../components/Spinner";
import { toast } from "../../components/Toast";
import { api, errorMessage } from "../../lib/api";
import { useSession } from "../../lib/session";
import { SettingsCard } from "../SettingsScreen";

export function DomainSettings()
{
    const { me, reload } = useSession();
    const [domain, setDomain] = useState(me.site.custom_domain ?? "");
    const [saving, setSaving] = useState(false);
    const allowed = me.entitlements.canUseCustomDomain;

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
            toast(domain ? "Domain saved. Add the DNS record next." : "Custom domain removed");
        }
        catch (caught)
        {
            toast(errorMessage(caught), "error");
        }
        setSaving(false);
    }

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
                <div className="rounded-xl bg-zinc-900/[0.03] p-4 text-sm dark:bg-white/[0.04]">
                    <p className="font-semibold">Point your DNS here</p>
                    <p className="muted mt-1">Add a CNAME record for <code>{me.site.custom_domain}</code> pointing to <code>custom.{me.rootDomain}</code>. SSL is issued automatically once the record resolves, usually within minutes.</p>
                </div>
            )}
        </SettingsCard>
    );
}
