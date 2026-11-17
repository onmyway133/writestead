import { type FormEvent, useEffect, useState } from "react";
import { Field, FormError } from "../components/Field";
import { PageSpinner, Spinner } from "../components/Spinner";
import { api, errorMessage } from "../lib/api";
import { navigate } from "../lib/router";
import { AuthFrame } from "./AuthScreen";

type Invite = { email: string; role: string; siteTitle: string; hasAccount: boolean };

export function InviteScreen({ onDone }: { onDone: () => Promise<void> })
{
    const code = new URLSearchParams(location.search).get("code") ?? "";
    const [invite, setInvite] = useState<Invite | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [name, setName] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() =>
    {
        api<Invite>(`/auth/invite?code=${encodeURIComponent(code)}`).then(setInvite).catch((caught) =>
        {
            setLoadError(errorMessage(caught));
        });
    }, [code]);

    async function submit(event: FormEvent)
    {
        event.preventDefault();
        setBusy(true);
        setError(null);
        try
        {
            await api("/auth/invite", { body: { code, name, password } });
            navigate("/admin", { replace: true });
            await onDone();
        }
        catch (caught)
        {
            setError(errorMessage(caught));
            setBusy(false);
        }
    }

    if (loadError)
    {
        return (
            <AuthFrame>
                <h1 className="text-2xl font-semibold tracking-tight">Invite not found</h1>
                <p className="muted mt-2 text-sm">{loadError} Ask whoever invited you to send a new link.</p>
            </AuthFrame>
        );
    }
    if (!invite)
    {
        return <PageSpinner />;
    }
    return (
        <AuthFrame>
            <h1 className="text-2xl font-semibold tracking-tight">Join {invite.siteTitle}</h1>
            <p className="muted mt-1.5 text-sm">You're invited as <strong className="capitalize">{invite.role}</strong> with {invite.email}.</p>
            <form className="mt-6 flex flex-col gap-4" onSubmit={submit}>
                {!invite.hasAccount && <Field label="Your name" name="name" value={name} onChange={(event) =>
                {
                    setName(event.target.value);
                }} autoComplete="name" required />}
                <Field label={invite.hasAccount ? "Your password" : "Choose a password"} name="password" type="password" value={password} onChange={(event) =>
                {
                    setPassword(event.target.value);
                }} autoComplete={invite.hasAccount ? "current-password" : "new-password"} minLength={8} required />
                <FormError message={error} />
                <button className="btn-primary min-h-11" type="submit" disabled={busy}>{busy && <Spinner />}Accept invite</button>
            </form>
        </AuthFrame>
    );
}
