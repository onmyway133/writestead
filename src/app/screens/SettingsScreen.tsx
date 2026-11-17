import { ArrowsLeftRight, Code, CreditCard, Crown, EnvelopeSimple, Gear, Globe, ListBullets, User, Users } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { PageHeader } from "../components/PageHeader";
import { navigate } from "../lib/router";
import { canManageSettings, useSession } from "../lib/session";
import { DomainSettings } from "./settings/DomainSettings";
import { GeneralSettings } from "./settings/GeneralSettings";
import { ImportExportSettings } from "./settings/ImportExportSettings";
import { IntegrationsSettings } from "./settings/IntegrationsSettings";
import { MembersSettings } from "./settings/MembersSettings";
import { NavigationSettings } from "./settings/NavigationSettings";
import { PaymentsSettings } from "./settings/PaymentsSettings";
import { PlanSettings } from "./settings/PlanSettings";
import { ProfileSettings } from "./settings/ProfileSettings";
import { TeamSettings } from "./settings/TeamSettings";

type Section = { id: string; label: string; icon: ReactNode; admin: boolean; render: () => ReactNode };

const SECTIONS: Section[] = [
    { id: "general", label: "General", icon: <Gear />, admin: true, render: () => <GeneralSettings /> },
    { id: "navigation", label: "Navigation", icon: <ListBullets />, admin: true, render: () => <NavigationSettings /> },
    { id: "members", label: "Members and email", icon: <EnvelopeSimple />, admin: true, render: () => <MembersSettings /> },
    { id: "payments", label: "Paid memberships", icon: <CreditCard />, admin: true, render: () => <PaymentsSettings /> },
    { id: "team", label: "Team", icon: <Users />, admin: false, render: () => <TeamSettings /> },
    { id: "domain", label: "Domain", icon: <Globe />, admin: true, render: () => <DomainSettings /> },
    { id: "import", label: "Import and export", icon: <ArrowsLeftRight />, admin: true, render: () => <ImportExportSettings /> },
    { id: "integrations", label: "API and webhooks", icon: <Code />, admin: true, render: () => <IntegrationsSettings /> },
    { id: "plan", label: "Plan", icon: <Crown />, admin: false, render: () => <PlanSettings /> },
    { id: "profile", label: "Your profile", icon: <User />, admin: false, render: () => <ProfileSettings /> },
];

export function SettingsScreen({ section }: { section: string })
{
    const { me } = useSession();
    const visible = SECTIONS.filter((item) => !item.admin || canManageSettings(me));
    const current = visible.find((item) => item.id === section) ?? visible.find((item) => item.id === "profile")!;

    return (
        <>
            <PageHeader title="Settings" description="Everything about your blog, in one place." />
            <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
                <nav className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible" aria-label="Settings sections">
                    {visible.map((item) => (
                        <a
                            key={item.id}
                            href={`/admin/settings/${item.id}`}
                            aria-current={item.id === current.id ? "page" : undefined}
                            onClick={(event) =>
                            {
                                event.preventDefault();
                                navigate(`/admin/settings/${item.id}`);
                            }}
                            className="chip shrink-0 justify-start py-2 [&_svg]:size-4"
                        >
                            {item.icon}
                            {item.label}
                        </a>
                    ))}
                </nav>
                <div className="min-w-0">{current.render()}</div>
            </div>
        </>
    );
}

export function SettingsCard({ title, description, children, footer, badge }: { title: string; description?: ReactNode; children: ReactNode; footer?: ReactNode; badge?: ReactNode })
{
    return (
        <section className="card mb-6">
            <div className="p-6">
                <h2 className="flex items-center gap-2 text-base font-semibold">{title}{badge}</h2>
                {description && <p className="muted mt-1 text-sm">{description}</p>}
                <div className="mt-5 flex flex-col gap-4">{children}</div>
            </div>
            {footer && <div className="flex flex-wrap items-center justify-end gap-2 rounded-b-2xl bg-zinc-900/[0.02] px-6 py-3 dark:bg-white/[0.03]">{footer}</div>}
        </section>
    );
}
