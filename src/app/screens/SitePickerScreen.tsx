import { ArrowRight, Plus } from "@phosphor-icons/react";
import { PageSpinner } from "../components/Spinner";
import { api } from "../lib/api";
import type { AuthStatus } from "../lib/session";
import { useApi } from "../lib/useApi";
import { AuthFrame } from "./AuthScreen";

type Sites = { user: { name: string; email: string }; sites: { id: string; title: string; subdomain: string | null; custom_domain: string | null; role: string; url: string }[] };

// Hosted version: after signing in on the root domain, choose which blog to open.
export function SitePickerScreen({ status }: { status: AuthStatus })
{
    const { data } = useApi<Sites>("/auth/sites");
    if (!data)
    {
        return <PageSpinner />;
    }
    return (
        <AuthFrame footer={<button type="button" className="muted font-medium" onClick={async () =>
        {
            await api("/auth/logout", { method: "POST" });
            location.href = "/login";
        }}>Sign out of {data.user.email}</button>}>
            <h1 className="text-2xl font-semibold tracking-tight">Your blogs</h1>
            <p className="muted mt-1.5 text-sm">Pick a blog to open its dashboard.</p>
            <div className="mt-6 flex flex-col gap-1">
                {data.sites.map((site) => (
                    <a key={site.id} href={`${site.url}/admin`} className="group flex items-center gap-3 rounded-xl p-3 transition-colors duration-200 hover:bg-brand/8">
                        <span className="flex size-10 items-center justify-center rounded-xl bg-brand/12 font-semibold text-brand">{site.title.slice(0, 1).toUpperCase()}</span>
                        <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{site.title}</span>
                            <span className="muted block truncate text-xs">{site.custom_domain ?? `${site.subdomain}.${status.rootDomain}`} · <span className="capitalize">{site.role}</span></span>
                        </span>
                        <ArrowRight className="size-4 text-zinc-400 transition-transform duration-300 group-hover:translate-x-0.5" />
                    </a>
                ))}
                <a href="/signup" className="flex items-center gap-3 rounded-xl p-3 text-sm font-medium text-brand transition-colors duration-200 hover:bg-brand/8">
                    <span className="flex size-10 items-center justify-center rounded-xl bg-zinc-100 dark:bg-white/8"><Plus /></span>
                    Start another blog
                </a>
            </div>
        </AuthFrame>
    );
}
