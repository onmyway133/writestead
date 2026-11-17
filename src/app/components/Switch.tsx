export function Switch({ checked, onChange, label, description }: { checked: boolean; onChange: (checked: boolean) => void; label: string; description?: string })
{
    return (
        <label className="flex cursor-pointer items-start gap-3 rounded-xl p-2 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
            <button
                type="button"
                role="switch"
                aria-checked={checked}
                onClick={() =>
                {
                    onChange(!checked);
                }}
                className="relative mt-0.5 inline-flex h-5 w-9 shrink-0 rounded-full bg-zinc-300 transition-colors aria-checked:bg-brand dark:bg-zinc-600"
            >
                <span className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-4.5" : "translate-x-0.5"}`} />
            </button>
            <span className="min-w-0">
                <span className="block text-sm font-medium">{label}</span>
                {description && <span className="muted block text-xs">{description}</span>}
            </span>
        </label>
    );
}
