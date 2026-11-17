import { Plus, Trash } from "@phosphor-icons/react";
import { Field } from "../../components/Field";
import { Segmented } from "../../components/Segmented";
import { Switch } from "../../components/Switch";
import { toast } from "../../components/Toast";
import { useSession } from "../../lib/session";
import { SettingsCard } from "../SettingsScreen";
import { SaveButtons } from "./SaveBar";
import { useSiteDraft } from "./useSiteDraft";

export function MembersSettings()
{
    const { me } = useSession();
    const { draft, set, save, saving, dirty, reset } = useSiteDraft();
    const footer = <SaveButtons dirty={dirty} saving={saving} onSave={save} onReset={reset} />;
    const settings = draft.settings;
    const embed = `<iframe src="${me.url}/embed/subscribe" width="480" height="120" style="border:0;max-width:100%" title="Subscribe to ${me.site.title.replace(/"/g, "")}"></iframe>`;
    return (
        <>
            {!me.emailConfigured && (
                <div className="mb-6 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
                    <p className="font-semibold">Email sending isn't set up yet</p>
                    <p className="mt-1">Until it is, new subscribers are confirmed right away and newsletters can't be sent. Set the EMAIL_FROM secret to an address on a domain onboarded to Cloudflare Email Service.</p>
                </div>
            )}
            <SettingsCard title="Subscriptions" footer={footer}>
                <Switch label="Let readers subscribe" description="Shows subscribe forms and the Sign in and Subscribe buttons." checked={settings.membersEnabled} onChange={(value) =>
                {
                    set("membersEnabled", value);
                }} />
                <Field label="Subscribe headline" name="subscribeTitle" value={settings.subscribeTitle} onChange={(event) =>
                {
                    set("subscribeTitle", event.target.value);
                }} />
                <Field label="Subscribe text" name="subscribeText" value={settings.subscribeText} onChange={(event) =>
                {
                    set("subscribeText", event.target.value);
                }} />
            </SettingsCard>
            <SettingsCard title="Newsletter" description="How your emails look in the inbox." footer={footer}>
                <Field label="Sender name" name="newsletterName" placeholder={me.site.title} value={settings.newsletterName} onChange={(event) =>
                {
                    set("newsletterName", event.target.value);
                }} />
                <Field label="Footer note" name="newsletterFooter" placeholder="Thanks for reading. Reply any time, I read every email." value={settings.newsletterFooter} onChange={(event) =>
                {
                    set("newsletterFooter", event.target.value);
                }} />
            </SettingsCard>
            <SettingsCard title="Welcome email" description="Sent once, right after someone confirms their subscription." footer={footer}>
                <Switch label="Send a welcome email" checked={settings.welcomeEmail.enabled} onChange={(value) =>
                {
                    set("welcomeEmail", { ...settings.welcomeEmail, enabled: value });
                }} />
                <Field label="Subject" name="welcomeSubject" value={settings.welcomeEmail.subject} disabled={!settings.welcomeEmail.enabled} onChange={(event) =>
                {
                    set("welcomeEmail", { ...settings.welcomeEmail, subject: event.target.value });
                }} />
                <div>
                    <label className="label" htmlFor="welcomeBody">Message (Markdown)</label>
                    <textarea id="welcomeBody" className="input" rows={5} disabled={!settings.welcomeEmail.enabled} value={settings.welcomeEmail.body} onChange={(event) =>
                    {
                        set("welcomeEmail", { ...settings.welcomeEmail, body: event.target.value });
                    }} />
                </div>
            </SettingsCard>
            <SettingsCard title="Follow-up emails" description="Simple automations: each email goes out a set number of days after someone confirms. People who subscribed long before a step existed don't get it." footer={footer}>
                {settings.followUps.length === 0 && <p className="muted text-sm">No follow-ups yet. A good first one: a list of your best posts, three days after someone joins.</p>}
                {settings.followUps.map((step, index) =>
                {
                    const update = (patch: Partial<typeof step>) =>
                    {
                        set("followUps", settings.followUps.map((item, position) => (position === index ? { ...item, ...patch } : item)));
                    };
                    return (
                        <div key={step.id} className="flex flex-col gap-3 rounded-xl bg-zinc-900/[0.03] p-4 dark:bg-white/[0.04]">
                            <div className="flex flex-wrap items-center gap-3">
                                <span className="text-sm font-semibold">Step {index + 1}</span>
                                <label className="muted flex items-center gap-2 text-sm">
                                    Send
                                    <input type="number" min={1} max={365} className="input w-20" value={step.delayDays} onChange={(event) =>
                                    {
                                        update({ delayDays: Math.max(1, Number(event.target.value) || 1) });
                                    }} />
                                    days after joining
                                </label>
                                <div className="ml-auto flex items-center gap-1">
                                    <Switch label="On" checked={step.enabled} onChange={(value) =>
                                    {
                                        update({ enabled: value });
                                    }} />
                                    <button type="button" className="icon-btn hover:text-red-600" aria-label={`Remove step ${index + 1}`} onClick={() =>
                                    {
                                        set("followUps", settings.followUps.filter((_, position) => position !== index));
                                    }}><Trash /></button>
                                </div>
                            </div>
                            <input className="input" aria-label="Subject" placeholder="Subject" value={step.subject} onChange={(event) =>
                            {
                                update({ subject: event.target.value });
                            }} />
                            <textarea className="input" rows={4} aria-label="Message (Markdown)" placeholder="Message (Markdown)" value={step.body} onChange={(event) =>
                            {
                                update({ body: event.target.value });
                            }} />
                        </div>
                    );
                })}
                <button type="button" className="btn-ghost self-start" onClick={() =>
                {
                    set("followUps", [...settings.followUps, { id: crypto.randomUUID().slice(0, 8), delayDays: 3, subject: "", body: "", enabled: true }]);
                }}><Plus />Add follow-up</button>
            </SettingsCard>
            <SettingsCard title="Comments" footer={footer}>
                <Segmented label="Who can comment" value={settings.commentsMode} onChange={(value) =>
                {
                    set("commentsMode", value);
                }} options={[{ value: "off", label: "Off" }, { value: "all", label: "Anyone" }, { value: "members", label: "Members" }, { value: "paid", label: "Paid" }]} />
                <Switch label="Hold comments from visitors for approval" description="Comments from signed in members are posted right away." checked={settings.commentsModeration} onChange={(value) =>
                {
                    set("commentsModeration", value);
                }} />
            </SettingsCard>
            <SettingsCard title="Signup widget" description="Paste this on any website to collect subscribers for this blog.">
                <pre className="overflow-x-auto rounded-xl bg-zinc-900 p-4 font-mono text-xs text-zinc-100">{embed}</pre>
                <button type="button" className="btn-secondary self-start" onClick={async () =>
                {
                    await navigator.clipboard.writeText(embed);
                    toast("Copied");
                }}>Copy code</button>
            </SettingsCard>
        </>
    );
}
