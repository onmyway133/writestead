import { useState } from "react";
import type { SiteSettings } from "../../../shared/settings";
import { toast } from "../../components/Toast";
import { api, errorMessage } from "../../lib/api";
import { useSession } from "../../lib/session";

type Draft = { title: string; description: string; status: "live" | "waitlist"; settings: SiteSettings };

// Local copy of the site's settings with save and discard, shared by the settings sections.
export function useSiteDraft()
{
    const { me, reload } = useSession();
    const initial: Draft = { title: me.site.title, description: me.site.description, status: me.site.status, settings: me.site.settings };
    const [draft, setDraft] = useState<Draft>(initial);
    const [saving, setSaving] = useState(false);
    const dirty = JSON.stringify(draft) !== JSON.stringify(initial);

    function set<Key extends keyof SiteSettings>(key: Key, value: SiteSettings[Key])
    {
        setDraft((current) => ({ ...current, settings: { ...current.settings, [key]: value } }));
    }

    async function save()
    {
        setSaving(true);
        try
        {
            await api("/admin/settings", { method: "PUT", body: draft });
            await reload();
            toast("Settings saved");
        }
        catch (caught)
        {
            toast(errorMessage(caught), "error");
        }
        setSaving(false);
    }

    return { draft, setDraft, set, save, saving, dirty, reset: () =>
    {
        setDraft(initial);
    } };
}
