import type { ReactNode } from "react";
import { number } from "../../lib/format";

export type BarItem = { key: string; label: ReactNode; value: number; href?: string };

export function flag(code: string): string
{
    if (!/^[A-Z]{2}$/i.test(code))
    {
        return "🌐";
    }
    return String.fromCodePoint(...code.toUpperCase().split("").map((char) => 0x1f1e6 + char.charCodeAt(0) - 65));
}

export function countryName(code: string): string
{
    if (!/^[A-Z]{2}$/i.test(code))
    {
        return "Unknown";
    }
    try
    {
        return new Intl.DisplayNames(undefined, { type: "region" }).of(code.toUpperCase()) ?? code;
    }
    catch
    {
        return code;
    }
}

// Ranked list where each row shows its share as a tinted bar behind the label.
export function BarList({ title, items, valueLabel = "Visitors", empty = "Nothing here yet", footer }: {
    title: string;
    items: BarItem[];
    valueLabel?: string;
    empty?: string;
    footer?: ReactNode;
})
{
    const max = Math.max(1, ...items.map((item) => item.value));
    return (
        <section className="card flex flex-col p-5" aria-label={title}>
            <div className="mb-3 flex items-center justify-between text-xs font-medium tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
                <h3>{title}</h3>
                <span>{valueLabel}</span>
            </div>
            {items.length === 0
                ? <p className="muted py-6 text-center text-sm">{empty}</p>
                : (
                    <ul className="flex flex-col gap-1">
                        {items.map((item) => (
                            <li key={item.key} className="relative flex items-center justify-between gap-3 overflow-hidden rounded-lg px-3 py-1.5 text-sm">
                                <span className="absolute inset-y-0 left-0 rounded-lg bg-brand/10 dark:bg-brand/20" style={{ width: `${(item.value / max) * 100}%` }} aria-hidden="true" />
                                <span className="relative min-w-0 truncate">
                                    {item.href ? <a href={item.href} target="_blank" rel="noopener" className="hover:underline">{item.label}</a> : item.label}
                                </span>
                                <span className="relative shrink-0 font-medium tabular-nums">{number(item.value)}</span>
                            </li>
                        ))}
                    </ul>
                )}
            {footer}
        </section>
    );
}
