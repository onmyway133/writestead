import type { ReactNode } from "react";

// Mutually exclusive options. The selected one gets a raised, filled background (no outline).
export function Segmented<Value extends string>({ value, onChange, options, label }: {
    value: Value;
    onChange: (value: Value) => void;
    options: { value: Value; label: string; description?: string; icon?: ReactNode }[];
    label: string;
})
{
    const rich = options.some((option) => option.description);
    return (
        <div role="radiogroup" aria-label={label} className={`grid gap-1 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800/70 ${rich ? "" : "grid-flow-col auto-cols-fr"}`} style={rich ? { gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` } : undefined}>
            {options.map((option) => (
                <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={value === option.value}
                    onClick={() =>
                    {
                        onChange(option.value);
                    }}
                    className="rounded-lg px-3 py-2 text-left text-sm text-zinc-600 transition-colors hover:text-zinc-900 aria-checked:bg-white aria-checked:text-zinc-900 aria-checked:shadow-sm dark:text-zinc-400 dark:hover:text-white dark:aria-checked:bg-zinc-700 dark:aria-checked:text-white"
                >
                    <span className={`flex items-center gap-2 font-semibold ${rich ? "" : "justify-center"}`}>{option.icon}{option.label}</span>
                    {option.description && <span className="mt-0.5 block text-xs font-normal opacity-75">{option.description}</span>}
                </button>
            ))}
        </div>
    );
}
