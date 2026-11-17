import { TrendDown, TrendUp } from "@phosphor-icons/react";
import type { ReactNode } from "react";

export function Sparkline({ values, className = "h-8 w-24" }: { values: number[]; className?: string })
{
    if (values.length < 2)
    {
        return null;
    }
    const max = Math.max(1, ...values);
    const points = values.map((value, index) => `${((index / (values.length - 1)) * 100).toFixed(1)},${(28 - (value / max) * 26).toFixed(1)}`).join(" ");
    return (
        <svg viewBox="0 0 100 30" preserveAspectRatio="none" className={className} aria-hidden="true">
            <polyline points={`0,30 ${points} 100,30`} fill="#6e43f5" fillOpacity="0.1" stroke="none" />
            <polyline points={points} fill="none" stroke="#6e43f5" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        </svg>
    );
}

export function ChangeBadge({ value }: { value: number | null })
{
    if (value === null || !Number.isFinite(value))
    {
        return null;
    }
    const up = value >= 0;
    return (
        <span className={`pill ${up ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" : "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300"}`}>
            {up ? <TrendUp className="size-3" /> : <TrendDown className="size-3" />}
            {`${up ? "+" : ""}${(value * 100).toFixed(0)}%`}
        </span>
    );
}

export function KpiCard({ label, value, change, spark, hint, icon }: {
    label: string;
    value: ReactNode;
    change?: number | null;
    spark?: number[];
    hint?: ReactNode;
    icon?: ReactNode;
})
{
    return (
        <div className="card flex flex-col gap-2 p-5">
            <div className="flex items-center justify-between gap-2">
                <p className="muted flex items-center gap-1.5 text-sm font-medium [&_svg]:size-4">{icon}{label}</p>
                {change !== undefined && <ChangeBadge value={change} />}
            </div>
            <div className="flex items-end justify-between gap-2">
                <p className="text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
                {spark && <Sparkline values={spark} />}
            </div>
            {hint && <div className="muted text-xs">{hint}</div>}
        </div>
    );
}
