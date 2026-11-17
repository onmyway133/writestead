import { useState } from "react";
import { Field } from "../../components/Field";
import { Spinner } from "../../components/Spinner";
import { toast } from "../../components/Toast";
import { api, errorMessage } from "../../lib/api";
import { useSession } from "../../lib/session";
import { ImageField } from "../ThemesScreen";
import { SettingsCard } from "../SettingsScreen";

export function ProfileSettings()
{
    const { me, reload } = useSession();
    const [profile, setProfile] = useState({ name: me.user.name, slug: me.user.slug, bio: me.user.bio, avatar: me.user.avatar, website: me.user.website, password: "" });
    const [saving, setSaving] = useState(false);

    async function save()
    {
        setSaving(true);
        try
        {
            await api("/admin/profile", { method: "PUT", body: profile });
            setProfile({ ...profile, password: "" });
            await reload();
            toast("Profile saved");
        }
        catch (caught)
        {
            toast(errorMessage(caught), "error");
        }
        setSaving(false);
    }

    return (
        <SettingsCard title="Your profile" description={<>Shown on your posts and at <code>/author/{profile.slug}</code>.</>} footer={<button type="button" className="btn-primary" disabled={saving} onClick={save}>{saving && <Spinner />}Save profile</button>}>
            <ImageField label="Photo" value={profile.avatar} onChange={(avatar) =>
            {
                setProfile({ ...profile, avatar });
            }} />
            <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Name" name="name" value={profile.name} onChange={(event) =>
                {
                    setProfile({ ...profile, name: event.target.value });
                }} />
                <Field label="Profile address" name="slug" value={profile.slug} onChange={(event) =>
                {
                    setProfile({ ...profile, slug: event.target.value });
                }} />
            </div>
            <div>
                <label className="label" htmlFor="bio">Bio</label>
                <textarea id="bio" className="input" rows={3} maxLength={400} value={profile.bio} onChange={(event) =>
                {
                    setProfile({ ...profile, bio: event.target.value });
                }} />
            </div>
            <Field label="Website" name="website" value={profile.website} onChange={(event) =>
            {
                setProfile({ ...profile, website: event.target.value });
            }} />
            <Field label="New password" name="password" type="password" autoComplete="new-password" value={profile.password} hint="Leave empty to keep your current password." onChange={(event) =>
            {
                setProfile({ ...profile, password: event.target.value });
            }} />
        </SettingsCard>
    );
}
