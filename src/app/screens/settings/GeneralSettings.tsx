import { Field } from "../../components/Field";
import { Segmented } from "../../components/Segmented";
import { SettingsCard } from "../SettingsScreen";
import { SaveButtons } from "./SaveBar";
import { useSiteDraft } from "./useSiteDraft";

const SOCIAL = [
    { key: "x", label: "X", placeholder: "@handle" },
    { key: "bluesky", label: "Bluesky", placeholder: "you.bsky.social" },
    { key: "mastodon", label: "Mastodon", placeholder: "https://mastodon.social/@you" },
    { key: "github", label: "GitHub", placeholder: "username" },
    { key: "instagram", label: "Instagram", placeholder: "username" },
    { key: "linkedin", label: "LinkedIn", placeholder: "https://linkedin.com/in/you" },
] as const;

export function GeneralSettings()
{
    const { draft, setDraft, set, save, saving, dirty, reset } = useSiteDraft();
    const footer = <SaveButtons dirty={dirty} saving={saving} onSave={save} onReset={reset} />;
    return (
        <>
            <SettingsCard title="Publication" description="Shown in the header, search results and link previews." footer={footer}>
                <Field label="Title" name="title" value={draft.title} maxLength={120} onChange={(event) =>
                {
                    setDraft({ ...draft, title: event.target.value });
                }} />
                <div>
                    <label className="label" htmlFor="description">Description</label>
                    <textarea id="description" className="input" rows={3} maxLength={500} value={draft.description} onChange={(event) =>
                    {
                        setDraft({ ...draft, description: event.target.value });
                    }} placeholder="Essays on slow living, gardening and the occasional recipe." />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Language" name="language" value={draft.settings.language} maxLength={10} hint="A language code like en, de or pt-BR." onChange={(event) =>
                    {
                        set("language", event.target.value);
                    }} />
                    <div>
                        <label className="label" htmlFor="timezone">Timezone</label>
                        <select id="timezone" className="input" value={draft.settings.timezone} onChange={(event) =>
                        {
                            set("timezone", event.target.value);
                        }}>
                            {Intl.supportedValuesOf("timeZone").map((zone) => <option key={zone}>{zone}</option>)}
                        </select>
                    </div>
                </div>
            </SettingsCard>
            <SettingsCard title="Launch status" description="Before you launch, show a waitlist page that only collects emails. Posts stay hidden until you go live." footer={footer}>
                <Segmented label="Launch status" value={draft.status} onChange={(value) =>
                {
                    setDraft({ ...draft, status: value });
                }} options={[
                    { value: "live", label: "Live", description: "The full blog is public." },
                    { value: "waitlist", label: "Waitlist", description: "A pre-launch signup page." },
                ]} />
                {draft.status === "waitlist" && (
                    <>
                        <Field label="Waitlist headline" name="waitlistTitle" value={draft.settings.waitlistTitle} onChange={(event) =>
                        {
                            set("waitlistTitle", event.target.value);
                        }} />
                        <div>
                            <label className="label" htmlFor="waitlistText">Waitlist text</label>
                            <textarea id="waitlistText" className="input" rows={2} value={draft.settings.waitlistText} onChange={(event) =>
                            {
                                set("waitlistText", event.target.value);
                            }} />
                        </div>
                    </>
                )}
            </SettingsCard>
            <SettingsCard title="Social links" description="Shown in the footer and used for link previews." footer={footer}>
                <div className="grid gap-4 sm:grid-cols-2">
                    {SOCIAL.map((item) => (
                        <Field key={item.key} label={item.label} name={item.key} placeholder={item.placeholder} value={draft.settings.social[item.key]} onChange={(event) =>
                        {
                            set("social", { ...draft.settings.social, [item.key]: event.target.value });
                        }} />
                    ))}
                </div>
            </SettingsCard>
        </>
    );
}
