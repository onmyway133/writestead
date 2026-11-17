import {
    ArrowSquareOut, ChartLineUp, ChatCircle, Gauge, Gear, List, Moon, Note, PaintBrush, Notebook, SignOut, Sun, Tag, Users, EnvelopeSimple, X,
} from "@phosphor-icons/react";
import { type ReactNode, useEffect, useState } from "react";
import { api } from "../lib/api";
import { navigate, usePath } from "../lib/router";
import { canManageSettings, canManageSubscribers, useSession } from "../lib/session";
import { useTheme } from "../lib/theme";

type Item = { href: string; label: string; icon: ReactNode; show?: boolean };

export function Layout({ children }: { children: ReactNode })
{
    const { me } = useSession();
    const path = usePath();
    const [open, setOpen] = useState(false);
    const [theme, setTheme] = useTheme();

    useEffect(() =>
    {
        setOpen(false);
    }, [path]);

    const groups: { title?: string; items: Item[] }[] = [
        {
            items: [
                { href: "/admin", label: "Dashboard", icon: <Gauge /> },
                { href: "/admin/posts", label: "Posts", icon: <Note /> },
                { href: "/admin/pages", label: "Pages", icon: <Notebook />, show: canManageSubscribers(me) },
                { href: "/admin/tags", label: "Tags", icon: <Tag />, show: canManageSubscribers(me) },
            ],
        },
        {
            title: "Audience",
            items: [
                { href: "/admin/subscribers", label: "Subscribers", icon: <Users />, show: canManageSubscribers(me) },
                { href: "/admin/newsletters", label: "Newsletters", icon: <EnvelopeSimple />, show: canManageSubscribers(me) },
                { href: "/admin/comments", label: "Comments", icon: <ChatCircle />, show: canManageSubscribers(me) },
                { href: "/admin/analytics", label: "Analytics", icon: <ChartLineUp /> },
            ],
        },
        {
            title: "Site",
            items: [
                { href: "/admin/themes", label: "Themes", icon: <PaintBrush />, show: canManageSettings(me) },
                { href: "/admin/settings", label: "Settings", icon: <Gear /> },
            ],
        },
    ];

    function isActive(href: string)
    {
        return href === "/admin" ? path === "/admin" || path === "/admin/" : path.startsWith(href);
    }

    async function signOut()
    {
        await api("/auth/logout", { method: "POST" });
        location.href = "/admin";
    }

    const sidebar = (
        <nav className="flex h-full flex-col gap-6 p-3" aria-label="Dashboard">
            <a href="/admin" onClick={(event) =>
            {
                event.preventDefault();
                navigate("/admin");
            }} className="flex items-center gap-2.5 rounded-xl px-2 py-1.5">
                <img src="/_ws/logo-128.png" alt="" width={32} height={32} />
                <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{me.site.title}</span>
                    <span className="muted block truncate text-xs">{me.url.replace(/^https?:\/\//, "")}</span>
                </span>
            </a>
            {groups.map((group, index) => (
                <div key={index} className="flex flex-col gap-0.5">
                    {group.title && <p className="px-2.5 pb-1 text-[11px] font-semibold tracking-wider text-zinc-400 uppercase">{group.title}</p>}
                    {group.items.filter((item) => item.show !== false).map((item) => (
                        <a
                            key={item.href}
                            href={item.href}
                            aria-current={isActive(item.href) ? "page" : undefined}
                            onClick={(event) =>
                            {
                                event.preventDefault();
                                navigate(item.href);
                            }}
                            className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-zinc-600 transition-colors duration-200 hover:bg-zinc-900/5 hover:text-zinc-900 aria-[current=page]:bg-brand/10 aria-[current=page]:text-brand dark:text-zinc-400 dark:hover:bg-white/6 dark:hover:text-white dark:aria-[current=page]:bg-brand/20 dark:aria-[current=page]:text-violet-200 [&_svg]:size-[18px]"
                        >
                            {item.icon}
                            {item.label}
                        </a>
                    ))}
                </div>
            ))}
            <div className="mt-auto flex flex-col gap-0.5">
                <a href={me.url || "/"} target="_blank" rel="noopener" className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-900/5 dark:text-zinc-400 dark:hover:bg-white/6 [&_svg]:size-[18px]">
                    <ArrowSquareOut />View site
                </a>
                <button type="button" onClick={() =>
                {
                    setTheme(theme === "dark" ? "light" : "dark");
                }} className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium text-zinc-600 hover:bg-zinc-900/5 dark:text-zinc-400 dark:hover:bg-white/6 [&_svg]:size-[18px]">
                    {theme === "dark" ? <Sun /> : <Moon />}{theme === "dark" ? "Light mode" : "Dark mode"}
                </button>
                <div className="mt-2 flex items-center gap-2.5 rounded-xl bg-zinc-900/[0.03] p-2 dark:bg-white/[0.04]">
                    {me.user.avatar
                        ? <img src={me.user.avatar} alt="" className="size-8 rounded-full object-cover" />
                        : <span className="flex size-8 items-center justify-center rounded-full bg-brand text-sm font-semibold text-white">{me.user.name.slice(0, 1).toUpperCase()}</span>}
                    <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{me.user.name}</span>
                        <span className="muted block truncate text-xs capitalize">{me.role}</span>
                    </span>
                    <button type="button" className="icon-btn size-8" onClick={signOut} aria-label="Sign out" title="Sign out"><SignOut /></button>
                </div>
            </div>
        </nav>
    );

    return (
        <div className="min-h-screen">
            {me.site.is_demo === 1 && (
                <div className="bg-brand px-4 py-2 text-center text-sm font-medium text-white">
                    You're exploring a read-only demo. <a className="underline underline-offset-2" href={`https://${me.rootDomain || "writestead.com"}/signup`}>Start your own blog free</a>
                </div>
            )}
            <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 bg-white shadow-[1px_0_0_rgb(21_18_43/0.06)] lg:block dark:bg-[#181818] dark:shadow-[1px_0_0_rgb(255_255_255/0.06)]" style={me.site.is_demo === 1 ? { top: 36 } : undefined}>
                {sidebar}
            </aside>
            <header className="sticky top-0 z-20 flex items-center gap-3 bg-white/80 px-4 py-2 backdrop-blur-lg lg:hidden dark:bg-[#181818]/80">
                <button type="button" className="icon-btn" onClick={() =>
                {
                    setOpen(true);
                }} aria-label="Open menu"><List className="size-5" /></button>
                <span className="truncate text-sm font-semibold">{me.site.title}</span>
            </header>
            {open && (
                <div className="fixed inset-0 z-40 lg:hidden">
                    <button type="button" className="absolute inset-0 bg-zinc-950/40 animate-fade-in" aria-label="Close menu" onClick={() =>
                    {
                        setOpen(false);
                    }} />
                    <div className="absolute inset-y-0 left-0 w-72 animate-pop-in bg-white shadow-2xl dark:bg-[#181818]">
                        <button type="button" className="icon-btn absolute top-3 right-3" onClick={() =>
                        {
                            setOpen(false);
                        }} aria-label="Close menu"><X /></button>
                        {sidebar}
                    </div>
                </div>
            )}
            <main className="px-4 py-6 sm:px-8 sm:py-8 lg:pl-72">
                <div className="mx-auto max-w-6xl">{children}</div>
            </main>
        </div>
    );
}
