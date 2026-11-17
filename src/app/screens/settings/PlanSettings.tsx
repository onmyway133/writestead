import { Check, Crown } from "@phosphor-icons/react";
import { PRO_PRICE } from "../../../shared/plans";
import { useSession } from "../../lib/session";
import { SettingsCard } from "../SettingsScreen";

function limit(value: number): string
{
    return value > 1_000_000 ? "Unlimited" : new Intl.NumberFormat().format(value);
}

export function PlanSettings()
{
    const { me } = useSession();
    const e = me.entitlements;
    const rows: [string, string | boolean][] = [
        ["Subscribers", limit(e.subscriberLimit)],
        ["Emails a month", limit(e.monthlyEmailLimit)],
        ["Team members", limit(e.staffLimit)],
        ["Analytics history", e.analyticsDays >= 3650 ? "Unlimited" : `${e.analyticsDays} days`],
        ["Custom domain", e.canUseCustomDomain],
        ["Premium themes", e.canUsePremiumThemes],
        ["Paid memberships", e.canUsePaidMembers],
        ["Custom CSS and code injection", e.canUseCodeInjection],
        ["API and webhooks", e.canUseApi],
        ["Remove Powered by Writestead", e.canHidePoweredBy],
    ];
    const label = e.plan === "self" ? "Self-hosted" : e.plan === "pro" ? "Pro" : "Free";
    return (
        <SettingsCard
            title={`You're on ${label}`}
            badge={<span className="pill bg-brand/12 text-brand"><Crown weight="fill" />{label}</span>}
            description={e.plan === "self"
                ? "Self-hosted installs have every feature. Cloudflare bills your account for usage."
                : e.plan === "pro" ? "Thanks for supporting Writestead." : `Pro is $${PRO_PRICE.monthly} a month or $${PRO_PRICE.yearly} a year.`}
        >
            <div className="grid gap-x-8 gap-y-1 sm:grid-cols-2">
                {rows.map(([name, value]) => (
                    <div key={name} className="flex items-center justify-between gap-4 rounded-lg px-2 py-2 text-sm odd:bg-zinc-900/[0.02] dark:odd:bg-white/[0.03]">
                        <span>{name}</span>
                        {typeof value === "string"
                            ? <span className="font-medium">{value}</span>
                            : value ? <Check className="text-emerald-600" weight="bold" /> : <span className="muted">Pro</span>}
                    </div>
                ))}
            </div>
            {e.plan === "free" && (
                <p className="muted text-sm">Online checkout for Pro isn't live yet. To upgrade now, open an issue on GitHub, or self-host for free with everything unlocked.</p>
            )}
        </SettingsCard>
    );
}
