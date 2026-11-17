import { Plus, Trash } from "@phosphor-icons/react";
import { useState } from "react";
import type { Role } from "../../../shared/types";
import { confirm } from "../../components/ConfirmDialog";
import { Dialog } from "../../components/Dialog";
import { Field } from "../../components/Field";
import { toast } from "../../components/Toast";
import { api, errorMessage } from "../../lib/api";
import { canManageSettings, useSession } from "../../lib/session";
import { useApi } from "../../lib/useApi";
import { SettingsCard } from "../SettingsScreen";

type Member = { id: string; name: string; email: string; avatar: string; role: Role; posts: number };

const ROLE_INFO: Record<Exclude<Role, "owner">, string> = {
    admin: "Everything except billing",
    editor: "Publish any post, manage subscribers and comments",
    author: "Write and publish their own posts",
    contributor: "Write drafts for review",
};

export function TeamSettings()
{
    const { me } = useSession();
    const { data, reload } = useApi<{ staff: Member[]; limit: number }>("/admin/staff");
    const [inviting, setInviting] = useState(false);
    const [email, setEmail] = useState("");
    const [role, setRole] = useState<Role>("author");
    const [link, setLink] = useState<string | null>(null);
    const manage = canManageSettings(me);

    async function invite()
    {
        try
        {
            const result = await api<{ link: string; emailed: boolean }>("/admin/staff/invite", { body: { email, role } });
            setLink(result.link);
            toast(result.emailed ? `Invite sent to ${email}` : "Invite link ready to share");
        }
        catch (caught)
        {
            toast(errorMessage(caught), "error");
        }
    }

    return (
        <SettingsCard
            title="Team"
            description={data ? `${data.staff.length} of ${data.limit > 1000 ? "unlimited" : data.limit} seats used.` : undefined}
            footer={manage && <button type="button" className="btn-primary" onClick={() =>
            {
                setInviting(true);
                setLink(null);
                setEmail("");
            }}><Plus />Invite someone</button>}
        >
            {data?.staff.map((member) => (
                <div key={member.id} className="flex flex-wrap items-center gap-3 rounded-xl p-3 transition-colors hover:bg-zinc-900/[0.03] dark:hover:bg-white/[0.04] sm:flex-nowrap">
                    {member.avatar
                        ? <img src={member.avatar} alt="" className="size-10 rounded-full object-cover" />
                        : <span className="flex size-10 items-center justify-center rounded-full bg-brand/12 font-semibold text-brand">{member.name.slice(0, 1).toUpperCase()}</span>}
                    <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{member.name}{member.id === me.user.id && <span className="muted font-normal"> (you)</span>}</p>
                        <p className="muted truncate text-xs">{member.email} · {member.posts} posts</p>
                    </div>
                    {member.role === "owner" || !manage || member.id === me.user.id
                        ? <span className="pill bg-brand/12 capitalize text-brand">{member.role}</span>
                        : (
                            <>
                                <select aria-label={`Role for ${member.name}`} className="input w-36" value={member.role} onChange={async (event) =>
                                {
                                    await api(`/admin/staff/${member.id}`, { method: "PUT", body: { role: event.target.value } }).catch((caught) =>
                                    {
                                        toast(errorMessage(caught), "error");
                                    });
                                    await reload();
                                }}>
                                    {Object.keys(ROLE_INFO).map((name) => <option key={name} value={name} className="capitalize">{name}</option>)}
                                </select>
                                <button type="button" className="icon-btn hover:text-red-600" aria-label={`Remove ${member.name}`} onClick={async () =>
                                {
                                    if (await confirm({ title: `Remove ${member.name}?`, message: "Their posts stay on the blog.", confirmLabel: "Remove", destructive: true }))
                                    {
                                        await api(`/admin/staff/${member.id}`, { method: "DELETE" });
                                        await reload();
                                    }
                                }}><Trash /></button>
                            </>
                        )}
                </div>
            ))}
            <Dialog open={inviting} onClose={() =>
            {
                setInviting(false);
            }} title="Invite a teammate" footer={link
                ? <button type="button" className="btn-primary" onClick={() =>
                {
                    setInviting(false);
                    void reload();
                }}>Done</button>
                : <><button type="button" className="btn-secondary" onClick={() =>
                {
                    setInviting(false);
                }}>Cancel</button><button type="button" className="btn-primary" onClick={invite}>Create invite</button></>}>
                {link
                    ? (
                        <div className="flex flex-col gap-3">
                            <p className="text-sm">Share this link with {email}. It works for 7 days.</p>
                            <input className="input font-mono text-xs" readOnly value={link} onFocus={(event) =>
                            {
                                event.target.select();
                            }} />
                            <button type="button" className="btn-secondary self-start" onClick={async () =>
                            {
                                await navigator.clipboard.writeText(link);
                                toast("Copied");
                            }}>Copy link</button>
                        </div>
                    )
                    : (
                        <div className="flex flex-col gap-4">
                            <Field label="Email" name="invite-email" type="email" value={email} onChange={(event) =>
                            {
                                setEmail(event.target.value);
                            }} />
                            <div className="flex flex-col gap-1">
                                <p className="label">Role</p>
                                {(Object.entries(ROLE_INFO) as [Role, string][]).filter(([name]) => name !== "admin" || me.role === "owner").map(([name, info]) => (
                                    <button key={name} type="button" aria-pressed={role === name} onClick={() =>
                                    {
                                        setRole(name);
                                    }} className="rounded-xl px-3 py-2 text-left transition-colors hover:bg-zinc-900/[0.04] aria-pressed:bg-brand/10 dark:hover:bg-white/[0.05]">
                                        <span className="block text-sm font-semibold capitalize">{name}</span>
                                        <span className="muted block text-xs">{info}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
            </Dialog>
        </SettingsCard>
    );
}
