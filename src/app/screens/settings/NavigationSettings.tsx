import { ArrowDown, ArrowUp, Plus, Trash } from "@phosphor-icons/react";
import type { NavItem } from "../../../shared/settings";
import { SettingsCard } from "../SettingsScreen";
import { SaveButtons } from "./SaveBar";
import { useSiteDraft } from "./useSiteDraft";

function NavEditor({ items, onChange }: { items: NavItem[]; onChange: (items: NavItem[]) => void })
{
    function move(index: number, by: number)
    {
        const next = [...items];
        const [item] = next.splice(index, 1);
        next.splice(index + by, 0, item);
        onChange(next);
    }
    return (
        <div className="flex flex-col gap-2">
            {items.map((item, index) => (
                <div key={index} className="flex flex-wrap items-center gap-2 rounded-xl bg-zinc-900/[0.03] p-2 dark:bg-white/[0.04] sm:flex-nowrap">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-white text-xs font-semibold text-zinc-500 dark:bg-white/10">{index + 1}</span>
                    <input className="input sm:w-44" aria-label="Label" value={item.label} placeholder="Label" onChange={(event) =>
                    {
                        onChange(items.map((other, position) => (position === index ? { ...other, label: event.target.value } : other)));
                    }} />
                    <input className="input min-w-0 flex-1" aria-label="URL" value={item.url} placeholder="/about or https://…" onChange={(event) =>
                    {
                        onChange(items.map((other, position) => (position === index ? { ...other, url: event.target.value } : other)));
                    }} />
                    <div className="ml-auto flex shrink-0">
                        <button type="button" className="icon-btn" disabled={index === 0} aria-label="Move up" onClick={() =>
                        {
                            move(index, -1);
                        }}><ArrowUp /></button>
                        <button type="button" className="icon-btn" disabled={index === items.length - 1} aria-label="Move down" onClick={() =>
                        {
                            move(index, 1);
                        }}><ArrowDown /></button>
                        <button type="button" className="icon-btn hover:text-red-600" aria-label="Remove" onClick={() =>
                        {
                            onChange(items.filter((_, position) => position !== index));
                        }}><Trash /></button>
                    </div>
                </div>
            ))}
            <button type="button" className="btn-ghost self-start" onClick={() =>
            {
                onChange([...items, { label: "", url: "/" }]);
            }}><Plus />Add link</button>
        </div>
    );
}

export function NavigationSettings()
{
    const { draft, set, save, saving, dirty, reset } = useSiteDraft();
    const footer = <SaveButtons dirty={dirty} saving={saving} onSave={save} onReset={reset} />;
    return (
        <>
            <SettingsCard title="Main menu" description="Links in the header. Use a path like /about for pages on your blog." footer={footer}>
                <NavEditor items={draft.settings.navigation} onChange={(items) =>
                {
                    set("navigation", items);
                }} />
            </SettingsCard>
            <SettingsCard title="Footer menu" footer={footer}>
                <NavEditor items={draft.settings.footerNavigation} onChange={(items) =>
                {
                    set("footerNavigation", items);
                }} />
            </SettingsCard>
        </>
    );
}
