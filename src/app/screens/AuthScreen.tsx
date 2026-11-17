import { CheckCircle, WarningCircle } from "@phosphor-icons/react";
import { type FormEvent, type ReactNode, useEffect, useRef, useState } from "react";
import { Field, FormError } from "../components/Field";
import { Logo } from "../components/Logo";
import { Spinner } from "../components/Spinner";
import { api, errorMessage } from "../lib/api";
import type { AuthStatus } from "../lib/session";

type Mode = "setup" | "login" | "signup";

declare global
{
    interface Window
    {
        turnstile?: { render: (element: HTMLElement, options: { sitekey: string; callback: (token: string) => void }) => string };
    }
}

// Shared frame for sign-in screens: soft color behind a centered card.
export function AuthFrame({ children, footer }: { children: ReactNode; footer?: ReactNode })
{
    return (
        <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-12">
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[420px] opacity-70 [clip-path:polygon(0_0,100%_0,100%_60%,0_100%)]">
                <div className="absolute -top-40 -left-20 size-[520px] rounded-full bg-violet-500 blur-[90px]" />
                <div className="absolute -top-32 right-0 size-[460px] rounded-full bg-rose-400 blur-[90px]" />
                <div className="absolute top-10 left-1/3 size-[380px] rounded-full bg-amber-300 blur-[90px]" />
            </div>
            <a href="/" className="relative mb-8"><Logo size={36} /></a>
            <div className="card relative w-full max-w-md p-6 shadow-xl sm:p-8">{children}</div>
            {footer && <div className="relative mt-6 text-sm">{footer}</div>}
        </div>
    );
}

export function AuthScreen({ status, mode, onDone }: { status: AuthStatus; mode: Mode; onDone: () => Promise<void> })
{
    const params = new URLSearchParams(location.search);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");
    const [title, setTitle] = useState("");
    const [subdomain, setSubdomain] = useState((params.get("name") ?? "").toLowerCase().replace(/[^a-z0-9-]/g, ""));
    const [available, setAvailable] = useState<boolean | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [token, setToken] = useState("");
    const turnstileRef = useRef<HTMLDivElement>(null);

    // Live check of the blog address while typing.
    useEffect(() =>
    {
        if (mode !== "signup" || subdomain.length < 3)
        {
            setAvailable(null);
            return;
        }
        const timer = setTimeout(async () =>
        {
            const result = await api<{ available: boolean }>(`/auth/check-subdomain?name=${encodeURIComponent(subdomain)}`).catch(() => null);
            setAvailable(result?.available ?? null);
        }, 350);
        return () =>
        {
            clearTimeout(timer);
        };
    }, [mode, subdomain]);

    useEffect(() =>
    {
        if (mode !== "signup" || !status.turnstileSiteKey || !turnstileRef.current)
        {
            return;
        }
        const element = turnstileRef.current;
        const script = document.createElement("script");
        script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
        script.async = true;
        script.onload = () =>
        {
            window.turnstile?.render(element, { sitekey: status.turnstileSiteKey, callback: setToken });
        };
        document.head.appendChild(script);
    }, [mode, status.turnstileSiteKey]);

    async function submit(event: FormEvent)
    {
        event.preventDefault();
        setBusy(true);
        setError(null);
        try
        {
            if (mode === "setup")
            {
                await api("/auth/setup", { body: { email, password, name, title } });
                await onDone();
            }
            else if (mode === "signup")
            {
                const result = await api<{ url: string }>("/auth/signup", { body: { email, password, name, title, subdomain, turnstile: token } });
                location.href = result.url;
                return;
            }
            else
            {
                await api("/auth/login", { body: { email, password } });
                if (status.isMarketing)
                {
                    location.href = "/login";
                    return;
                }
                await onDone();
            }
        }
        catch (caught)
        {
            setError(errorMessage(caught));
        }
        setBusy(false);
    }

    const heading = mode === "setup" ? "Set up your blog" : mode === "signup" ? "Start your blog" : status.siteTitle ? `Sign in to ${status.siteTitle}` : "Welcome back";
    const subheading = mode === "setup"
        ? "Create the owner account. You can change everything later."
        : mode === "signup" ? "Free forever for a personal blog. No credit card." : "Sign in to write, publish and see how your posts are doing.";

    return (
        <AuthFrame footer={status.isMarketing && (mode === "signup"
            ? <p className="muted">Already have a blog? <a className="font-medium text-brand" href="/login">Sign in</a></p>
            : <p className="muted">New here? <a className="font-medium text-brand" href="/signup">Start a blog free</a></p>)}>
            <h1 className="text-2xl font-semibold tracking-tight">{heading}</h1>
            <p className="muted mt-1.5 text-sm">{subheading}</p>
            {status.isDemo && mode === "login" && (
                <p className="mt-4 rounded-xl bg-brand/10 px-3.5 py-2.5 text-sm text-brand dark:text-violet-200">Demo login: <strong>demo@writestead.com</strong> / <strong>demo-writestead</strong></p>
            )}
            <form className="mt-6 flex flex-col gap-4" onSubmit={submit}>
                {mode === "signup" && (
                    <div>
                        <label htmlFor="subdomain" className="label">Blog address</label>
                        <div className="flex items-center rounded-[10px] bg-white shadow-[0_0_0_1px_rgb(21_18_43/0.12)] focus-within:shadow-[0_0_0_1px_var(--color-brand),0_0_0_4px_rgb(110_67_245/0.18)] dark:bg-[#272727]">
                            <input
                                id="subdomain"
                                className="min-w-0 flex-1 bg-transparent px-3 py-2 text-right text-sm outline-none"
                                value={subdomain}
                                onChange={(event) =>
                                {
                                    setSubdomain(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
                                }}
                                placeholder="yourname"
                                required
                                minLength={3}
                                maxLength={32}
                                autoComplete="off"
                            />
                            <span className="muted pr-3 text-sm">.{status.rootDomain}</span>
                        </div>
                        {available !== null && (
                            <p className={`mt-1.5 flex items-center gap-1 text-xs ${available ? "text-emerald-600" : "text-red-600"}`}>
                                {available ? <CheckCircle weight="fill" /> : <WarningCircle weight="fill" />}
                                {available ? "That address is free" : "That address is taken or not allowed"}
                            </p>
                        )}
                    </div>
                )}
                {(mode === "setup" || mode === "signup") && (
                    <>
                        <Field label="Blog name" name="title" value={title} onChange={(event) =>
                        {
                            setTitle(event.target.value);
                        }} placeholder="Notes from the garden" maxLength={120} />
                        <Field label="Your name" name="name" value={name} onChange={(event) =>
                        {
                            setName(event.target.value);
                        }} autoComplete="name" maxLength={80} required />
                    </>
                )}
                <Field label="Email" name="email" type="email" value={email} onChange={(event) =>
                {
                    setEmail(event.target.value);
                }} autoComplete="email" required />
                <Field label="Password" name="password" type="password" value={password} onChange={(event) =>
                {
                    setPassword(event.target.value);
                }} autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={mode === "login" ? undefined : 8} required hint={mode === "login" ? undefined : "At least 8 characters."} />
                {mode === "signup" && status.turnstileSiteKey && <div ref={turnstileRef} />}
                <FormError message={error} />
                <button className="btn-primary min-h-11" type="submit" disabled={busy}>
                    {busy && <Spinner />}
                    {mode === "setup" ? "Create my blog" : mode === "signup" ? "Create my blog" : "Sign in"}
                </button>
            </form>
        </AuthFrame>
    );
}
