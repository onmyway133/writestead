import { Check, Crown } from "@phosphor-icons/react";
import { useState } from "react";
import { PRO_PRICE, TEAMS_PRICE } from "../../../shared/plans";
import { Segmented } from "../../components/Segmented";
import { Spinner } from "../../components/Spinner";
import { toast } from "../../components/Toast";
import { api, errorMessage } from "../../lib/api";
import { useSession } from "../../lib/session";
import { useApi } from "../../lib/useApi";
import { SettingsCard } from "../SettingsScreen";

function limit(value: number): string
{
    return value > 1_000_000 ? "Unlimited" : new Intl.NumberFormat().format(value);
}

export function PlanSettings()
{
    const { me } = useSession();
    const e = me.entitlements;
    // Billing only exists on the hosted version, and only the owner pays.
    const { data: billing } = useApi<{ enabled: boolean }>(me.mode === "multi" && me.role === "owner" ? "/admin/billing" : null);
    const [interval, setInterval] = useState<"month" | "year">("month");
    const [busy, setBusy] = useState<string | null>(null);
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
    const label = { self: "Self-hosted", teams: "Teams", pro: "Pro", free: "Free" }[e.plan];

    async function open(path: string, body?: object)
    {
        setBusy(path + JSON.stringify(body ?? {}));
        try
        {
            const result = await api<{ url: string }>(path, { method: "POST", body: body ?? {} });
            location.href = result.url;
        }
        catch (caught)
        {
            toast(errorMessage(caught), "error");
            setBusy(null);
        }
    }

    const upgrades = ([
        { plan: "pro", name: "Pro", price: PRO_PRICE, note: "For one writer" },
        { plan: "teams", name: "Teams", price: TEAMS_PRICE, note: "Unlimited teammates and admins" },
    ] as const).filter((option) => e.plan === "free" || (e.plan === "pro" && option.plan === "teams"));

    return (
        <SettingsCard
            title={`You're on ${label}`}
            badge={<span className="pill bg-brand/12 text-brand"><Crown weight="fill" />{label}</span>}
            description={e.plan === "self"
                ? "Self-hosted installs have every feature. Cloudflare bills your account for usage."
                : e.plan === "teams" ? "Thanks for supporting Writestead."
                    : e.plan === "pro" ? `Need teammates? Teams is $${TEAMS_PRICE.monthly} a month with unlimited members and admin roles.`
                        : `Pro is $${PRO_PRICE.monthly} a month for one writer. Teams is $${TEAMS_PRICE.monthly} a month for a whole team.`}
            footer={billing?.enabled && e.plan !== "free" && (
                <button type="button" className="btn-secondary" disabled={busy !== null} onClick={() =>
                {
                    void open("/admin/billing/portal");
                }}>{busy?.startsWith("/admin/billing/portal") && <Spinner />}Manage billing</button>
            )}
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
            {billing?.enabled && upgrades.length > 0 && (
                <div className="flex flex-col gap-3 rounded-2xl bg-brand/[0.06] p-4 dark:bg-brand/15">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm font-semibold">Upgrade</p>
                        <div className="w-56">
                            <Segmented label="Billing period" value={interval} onChange={setInterval} options={[{ value: "month", label: "Monthly" }, { value: "year", label: "Yearly" }]} />
                        </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                        {upgrades.map((option) =>
                        {
                            const key = "/admin/billing/checkout" + JSON.stringify({ plan: option.plan, interval });
                            return (
                                <div key={option.plan} className="flex items-center justify-between gap-3 rounded-xl bg-white p-3 dark:bg-[#272727]">
                                    <div>
                                        <p className="text-sm font-semibold">{option.name}</p>
                                        <p className="muted text-xs">${interval === "year" ? option.price.yearly : option.price.monthly} a {interval} · {option.note}</p>
                                    </div>
                                    <button type="button" className="btn-primary btn-sm" disabled={busy !== null} onClick={() =>
                                    {
                                        void open("/admin/billing/checkout", { plan: option.plan, interval });
                                    }}>{busy === key && <Spinner />}Upgrade to {option.name}</button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
            {!billing?.enabled && (e.plan === "free" || e.plan === "pro") && (
                <p className="muted text-sm">Online checkout for paid plans isn't live yet. To upgrade now, open an issue on GitHub, or self-host for free with everything unlocked.</p>
            )}
        </SettingsCard>
    );
}
