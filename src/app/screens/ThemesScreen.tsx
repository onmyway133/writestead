import { CheckCircle, Eye, UploadSimple } from "@phosphor-icons/react";
import { useRef, useState } from "react";
import { FONTS, findTheme, type SiteSettings, THEMES, type ThemeInfo } from "../../shared/settings";
import { Dialog } from "../components/Dialog";
import { PageHeader } from "../components/PageHeader";
import { ProBadge } from "../components/ProBadge";
import { Segmented } from "../components/Segmented";
import { Spinner } from "../components/Spinner";
import { Switch } from "../components/Switch";
import { toast } from "../components/Toast";
import { api, errorMessage } from "../lib/api";
import { useSession } from "../lib/session";

const ACCENTS = ["#6d4aff", "#2563eb", "#0f766e", "#16a34a", "#ca8a04", "#ea580c", "#dc2626", "#db2777", "#1f2937"];

export function ThemeThumb({ theme }: { theme: ThemeInfo })
{
    const [bg, fg, accent] = theme.swatch;
    return (
        <div className="flex aspect-[4/3] flex-col gap-1.5 overflow-hidden rounded-xl p-3 shadow-[0_0_0_1px_rgb(21_18_43/0.08)]" style={{ background: bg }} aria-hidden="true">
            <span className="h-1.5 w-2/5 rounded-full" style={{ background: fg, opacity: 0.8 }} />
            <span className="mt-1.5 h-2.5 w-3/4 rounded" style={{ background: fg }} />
            <span className="h-1.5 w-11/12 rounded-full" style={{ background: fg, opacity: 0.22 }} />
            <span className="h-1.5 w-3/5 rounded-full" style={{ background: fg, opacity: 0.22 }} />
            <span className="mt-auto grid grid-cols-3 gap-1.5">
                {[0.9, 0.55, 0.3].map((opacity) => <i key={opacity} className="aspect-square rounded-md" style={{ background: accent, opacity }} />)}
            </span>
        </div>
    );
}

export function ThemesScreen()
{
    const { me, reload } = useSession();
    const [draft, setDraft] = useState<SiteSettings>(me.site.settings);
    const [saving, setSaving] = useState(false);
    const [preview, setPreview] = useState<ThemeInfo | null>(null);
    const [frameKey, setFrameKey] = useState(0);
    const canPremium = me.entitlements.canUsePremiumThemes;
    const canCode = me.entitlements.canUseCodeInjection;
    const active = findTheme(me.site.settings.theme);
    const dirty = JSON.stringify(draft) !== JSON.stringify(me.site.settings);

    function update<Key extends keyof SiteSettings>(key: Key, value: SiteSettings[Key])
    {
        setDraft((current) => ({ ...current, [key]: value }));
    }

    async function save(next: SiteSettings = draft)
    {
        setSaving(true);
        try
        {
            await api("/admin/settings", { method: "PUT", body: { settings: next } });
            await reload();
            setFrameKey((key) => key + 1);
            toast("Theme saved");
        }
        catch (caught)
        {
            toast(errorMessage(caught), "error");
        }
        setSaving(false);
    }

    async function activate(theme: ThemeInfo)
    {
        const next = { ...draft, theme: theme.id, layout: theme.layout, accent: "" };
        setDraft(next);
        setPreview(null);
        await save(next);
    }

    return (
        <>
            <PageHeader
                title="Themes"
                description="Pick a look, then make it yours. Readers see changes as soon as you save."
                actions={<a className="btn-secondary" href={`${me.url || ""}/`} target="_blank" rel="noopener"><Eye />View site</a>}
            />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                {THEMES.map((theme) =>
                {
                    const isActive = theme.id === active.id;
                    const locked = theme.premium && !canPremium;
                    return (
                        <div key={theme.id} className={`group flex flex-col gap-3 rounded-2xl p-2.5 transition-colors duration-300 ${isActive ? "bg-brand/10 dark:bg-brand/20" : "hover:bg-zinc-900/[0.03] dark:hover:bg-white/[0.04]"}`}>
                            <button type="button" className="text-left transition-transform duration-500 ease-out-soft group-hover:-translate-y-0.5" onClick={() =>
                            {
                                setPreview(theme);
                            }} aria-label={`Preview ${theme.name}`}>
                                <ThemeThumb theme={theme} />
                            </button>
                            <div className="flex items-start justify-between gap-2 px-1">
                                <div className="min-w-0">
                                    <p className="flex items-center gap-1.5 text-sm font-semibold">{theme.name}{isActive && <CheckCircle weight="fill" className="text-brand" />}</p>
                                    <p className="muted text-xs">{theme.style}</p>
                                </div>
                                {theme.premium && <ProBadge />}
                            </div>
                            <div className="flex gap-1.5 px-1 pb-1">
                                <button type="button" className="btn-ghost btn-sm flex-1" onClick={() =>
                                {
                                    setPreview(theme);
                                }}>Preview</button>
                                <button type="button" className={`${isActive ? "btn-secondary" : "btn-primary"} btn-sm flex-1`} disabled={isActive || locked || saving} onClick={() =>
                                {
                                    void activate(theme);
                                }}>{isActive ? "Active" : locked ? "Pro" : "Use"}</button>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_420px]">
                <section className="card p-6">
                    <h2 className="text-lg font-semibold">Customize {active.name}</h2>
                    <p className="muted mt-1 text-sm">Colors, type and layout. No code needed.</p>
                    <div className="mt-6 flex flex-col gap-6">
                        <div>
                            <p className="label">Accent color</p>
                            <div className="flex flex-wrap items-center gap-2">
                                {["", ...ACCENTS].map((color) => (
                                    <button
                                        key={color || "default"}
                                        type="button"
                                        aria-pressed={draft.accent === color}
                                        aria-label={color ? `Accent ${color}` : "Theme default accent"}
                                        onClick={() =>
                                        {
                                            update("accent", color);
                                        }}
                                        className="flex size-10 items-center justify-center rounded-xl transition-colors duration-200 hover:bg-zinc-900/5 aria-pressed:bg-brand/12 dark:hover:bg-white/8"
                                    >
                                        <span className="size-6 rounded-full shadow-inner" style={{ background: color || active.accent }}>
                                            {!color && <span className="flex size-full items-center justify-center text-[10px] font-bold text-white">A</span>}
                                        </span>
                                    </button>
                                ))}
                                <label className="flex items-center gap-2 rounded-xl px-2 py-1 text-sm hover:bg-zinc-900/5 dark:hover:bg-white/8">
                                    <input type="color" value={draft.accent || active.accent} onChange={(event) =>
                                    {
                                        update("accent", event.target.value);
                                    }} className="size-7 cursor-pointer rounded-md bg-transparent" />
                                    Custom
                                </label>
                            </div>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                                <label className="label" htmlFor="heading-font">Heading font</label>
                                <select id="heading-font" className="input" value={draft.headingFont} onChange={(event) =>
                                {
                                    update("headingFont", event.target.value);
                                }}>{FONTS.map((font) => <option key={font.id} value={font.id}>{font.name}</option>)}</select>
                            </div>
                            <div>
                                <label className="label" htmlFor="body-font">Body font</label>
                                <select id="body-font" className="input" value={draft.bodyFont} onChange={(event) =>
                                {
                                    update("bodyFont", event.target.value);
                                }}>{FONTS.map((font) => <option key={font.id} value={font.id}>{font.name}</option>)}</select>
                            </div>
                        </div>
                        <div>
                            <p className="label">Home page layout</p>
                            <Segmented label="Home page layout" value={draft.layout} onChange={(value) =>
                            {
                                update("layout", value);
                            }} options={[{ value: "list", label: "List" }, { value: "grid", label: "Grid" }, { value: "magazine", label: "Magazine" }]} />
                        </div>
                        <div>
                            <p className="label">Color scheme</p>
                            <Segmented label="Color scheme" value={draft.colorScheme} onChange={(value) =>
                            {
                                update("colorScheme", value);
                            }} options={[{ value: "auto", label: "Match reader" }, { value: "light", label: "Light" }, { value: "dark", label: "Dark" }]} />
                        </div>
                        <div className="grid gap-4 sm:grid-cols-3">
                            <ImageField label="Logo" value={draft.logo} onChange={(url) =>
                            {
                                update("logo", url);
                            }} />
                            <ImageField label="Icon" value={draft.icon} onChange={(url) =>
                            {
                                update("icon", url);
                            }} />
                            <ImageField label="Cover image" value={draft.coverImage} onChange={(url) =>
                            {
                                update("coverImage", url);
                            }} />
                        </div>
                        <div className="grid gap-1 sm:grid-cols-2">
                            <Switch label="Show authors" checked={draft.showAuthor} onChange={(value) =>
                            {
                                update("showAuthor", value);
                            }} />
                            <Switch label="Show reading time" checked={draft.showReadingTime} onChange={(value) =>
                            {
                                update("showReadingTime", value);
                            }} />
                        </div>
                        <details className="group rounded-xl bg-zinc-900/[0.03] p-4 dark:bg-white/[0.04]">
                            <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold">Custom CSS and code {!canCode && <ProBadge />}</summary>
                            <div className="mt-4 flex flex-col gap-4">
                                {(["customCss", "headCode", "footerCode"] as const).map((key) => (
                                    <div key={key}>
                                        <label className="label" htmlFor={key}>{key === "customCss" ? "Custom CSS" : key === "headCode" ? "Code in <head>" : "Code before </body>"}</label>
                                        <textarea id={key} className="input font-mono text-xs" rows={5} disabled={!canCode} value={draft[key]} onChange={(event) =>
                                        {
                                            update(key, event.target.value);
                                        }} placeholder={key === "customCss" ? ".post-title { letter-spacing: 0; }" : "<script>…</script>"} />
                                    </div>
                                ))}
                                {!canCode && <p className="muted text-xs">Upgrade to Pro to add your own CSS, analytics or widgets.</p>}
                            </div>
                        </details>
                        <div className="flex justify-end gap-2">
                            <button type="button" className="btn-ghost" disabled={!dirty || saving} onClick={() =>
                            {
                                setDraft(me.site.settings);
                            }}>Discard</button>
                            <button type="button" className="btn-primary" disabled={!dirty || saving} onClick={() =>
                            {
                                void save();
                            }}>{saving && <Spinner />}Save changes</button>
                        </div>
                    </div>
                </section>
                <section className="card flex flex-col overflow-hidden lg:sticky lg:top-8 lg:h-[640px]">
                    <div className="flex items-center gap-2 px-4 py-3">
                        <span className="size-2.5 rounded-full bg-emerald-500" />
                        <p className="text-sm font-semibold">Live site</p>
                        <p className="muted ml-auto text-xs">Updates after you save</p>
                    </div>
                    <iframe key={frameKey} title="Your blog" src="/" className="min-h-[480px] w-full flex-1 bg-white" />
                </section>
            </div>

            <Dialog
                open={preview !== null}
                onClose={() =>
                {
                    setPreview(null);
                }}
                title={preview ? `${preview.name} preview` : ""}
                description={preview?.description}
                wide
                footer={preview && (
                    <>
                        <button type="button" className="btn-secondary" onClick={() =>
                        {
                            setPreview(null);
                        }}>Close</button>
                        <button type="button" className="btn-primary" disabled={(preview.premium && !canPremium) || preview.id === active.id} onClick={() =>
                        {
                            void activate(preview);
                        }}>{preview.premium && !canPremium ? "Pro theme" : preview.id === active.id ? "Active" : `Use ${preview.name}`}</button>
                    </>
                )}
            >
                {preview && <iframe title={`${preview.name} preview`} src={`/?preview_theme=${preview.id}`} className="h-[60vh] w-full rounded-xl bg-white shadow-[0_0_0_1px_rgb(21_18_43/0.08)]" />}
            </Dialog>
        </>
    );
}

export function ImageField({ label, value, onChange }: { label: string; value: string; onChange: (url: string) => void })
{
    const input = useRef<HTMLInputElement>(null);
    const [busy, setBusy] = useState(false);

    async function upload(file: File)
    {
        setBusy(true);
        try
        {
            const form = new FormData();
            form.append("file", file);
            const result = await api<{ url: string }>("/admin/media", { form });
            onChange(result.url);
        }
        catch (caught)
        {
            toast(errorMessage(caught), "error");
        }
        setBusy(false);
    }

    return (
        <div>
            <p className="label">{label}</p>
            <div className="flex items-center gap-2">
                <button type="button" onClick={() =>
                {
                    input.current?.click();
                }} className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-zinc-100 text-zinc-400 transition-colors hover:bg-zinc-200 dark:bg-white/8" aria-label={`Upload ${label.toLowerCase()}`}>
                    {busy ? <Spinner /> : value ? <img src={value} alt="" className="size-full object-cover" /> : <UploadSimple className="size-5" />}
                </button>
                {value && <button type="button" className="btn-ghost btn-sm" onClick={() =>
                {
                    onChange("");
                }}>Remove</button>}
            </div>
            <input ref={input} type="file" accept="image/*" className="hidden" onChange={(event) =>
            {
                const file = event.target.files?.[0];
                if (file)
                {
                    void upload(file);
                }
                event.target.value = "";
            }} />
        </div>
    );
}
