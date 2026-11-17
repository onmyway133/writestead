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
