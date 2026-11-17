import { useId, useMemo, useState } from "react";
import { number } from "../../lib/format";

export type Point = { label: string; value: number; secondary?: number };

const WIDTH = 640;
const HEIGHT = 200;
const PAD = { top: 12, right: 12, bottom: 24, left: 40 };

function niceMax(value: number): number
{
    if (value <= 4)
    {
        return 4;
    }
    const magnitude = 10 ** Math.floor(Math.log10(value));
    const step = [1, 2, 2.5, 5, 10].find((item) => item * magnitude >= value / 4) ?? 10;
    return Math.ceil(value / (step * magnitude)) * step * magnitude;
}

function shortDay(label: string): string
{
    const date = new Date(`${label}T00:00:00Z`);
    if (Number.isNaN(date.getTime()))
    {
        return label;
    }
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", timeZone: "UTC" }).format(date);
}

// Line and area chart with a hover tooltip. The data is also given as a hidden table for screen readers.
export function AreaChart({ points, label, valueLabel = "Value", secondaryLabel, height = HEIGHT }: {
    points: Point[];
    label: string;
    valueLabel?: string;
    secondaryLabel?: string;
    height?: number;
})
{
    const gradientId = useId();
    const [hover, setHover] = useState<number | null>(null);
    const max = useMemo(() =>
    {
        return niceMax(Math.max(1, ...points.map((point) => Math.max(point.value, point.secondary ?? 0))));
    }, [points]);
    const innerWidth = WIDTH - PAD.left - PAD.right;
    const innerHeight = height - PAD.top - PAD.bottom;
    const x = (index: number) => PAD.left + (points.length <= 1 ? innerWidth / 2 : (index / (points.length - 1)) * innerWidth);
    const y = (value: number) => PAD.top + innerHeight - (value / max) * innerHeight;
    const line = (key: "value" | "secondary") => points.map((point, index) => `${index === 0 ? "M" : "L"}${x(index).toFixed(1)} ${y(point[key] ?? 0).toFixed(1)}`).join(" ");
    const area = points.length > 0 ? `${line("value")} L${x(points.length - 1).toFixed(1)} ${PAD.top + innerHeight} L${x(0).toFixed(1)} ${PAD.top + innerHeight} Z` : "";
    const ticks = [0, max / 2, max];
    const labelEvery = Math.max(1, Math.ceil(points.length / 6));
    const active = hover !== null ? points[hover] : null;

    function onMove(event: React.PointerEvent<SVGSVGElement>)
    {
        const rect = event.currentTarget.getBoundingClientRect();
        const relative = ((event.clientX - rect.left) / rect.width) * WIDTH;
        const index = Math.round(((relative - PAD.left) / innerWidth) * (points.length - 1));
        setHover(Math.min(points.length - 1, Math.max(0, index)));
    }

    if (points.length === 0)
    {
        return (
            <div className="flex items-center justify-center rounded-xl bg-zinc-50 text-sm text-zinc-400 dark:bg-white/3" style={{ height }}>
                No data for this period yet
            </div>
        );
    }

    return (
        <figure className="relative" aria-label={label}>
            <svg
                viewBox={`0 0 ${WIDTH} ${height}`}
                className="w-full overflow-visible text-zinc-400"
                role="img"
                aria-hidden="true"
                onPointerMove={onMove}
                onPointerLeave={() =>
                {
                    setHover(null);
                }}
            >
                <defs>
                    <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#6e43f5" stopOpacity="0.22" />
                        <stop offset="100%" stopColor="#6e43f5" stopOpacity="0" />
                    </linearGradient>
                </defs>
                {ticks.map((tick) => (
                    <g key={tick}>
                        <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y(tick)} y2={y(tick)} stroke="currentColor" strokeOpacity="0.18" strokeDasharray="3 4" />
                        <text x={PAD.left - 8} y={y(tick) + 4} textAnchor="end" fontSize="11" fill="currentColor">{number(Math.round(tick))}</text>
                    </g>
                ))}
                {points.map((point, index) => index % labelEvery === 0 || index === points.length - 1
                    ? <text key={point.label} x={x(index)} y={height - 6} textAnchor="middle" fontSize="11" fill="currentColor">{shortDay(point.label)}</text>
                    : null)}
                <path d={area} fill={`url(#${gradientId})`} />
                {secondaryLabel && <path d={line("secondary")} fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinejoin="round" strokeDasharray="5 4" />}
                <path d={line("value")} fill="none" stroke="#6e43f5" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
                {hover !== null && (
                    <g>
                        <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + innerHeight} stroke="#6e43f5" strokeOpacity="0.35" />
                        <circle cx={x(hover)} cy={y(points[hover].value)} r="4.5" fill="#6e43f5" stroke="white" strokeWidth="2" />
                    </g>
                )}
            </svg>
            {active && hover !== null && (
                <div
                    className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg bg-zinc-900 px-3 py-2 text-xs text-white shadow-lg dark:bg-zinc-100 dark:text-zinc-900"
                    style={{ left: `${(x(hover) / WIDTH) * 100}%` }}
                >
                    <p className="font-semibold">{shortDay(active.label)}</p>
                    <p>{valueLabel}: {number(active.value)}</p>
                    {secondaryLabel && <p>{secondaryLabel}: {number(active.secondary ?? 0)}</p>}
                </div>
            )}
            <table className="sr-only">
                <caption>{label}</caption>
                <thead><tr><th>Date</th><th>{valueLabel}</th>{secondaryLabel && <th>{secondaryLabel}</th>}</tr></thead>
                <tbody>
                    {points.map((point) => (
                        <tr key={point.label}><td>{point.label}</td><td>{point.value}</td>{secondaryLabel && <td>{point.secondary ?? 0}</td>}</tr>
                    ))}
                </tbody>
            </table>
        </figure>
    );
}

// Fills days with no rows so the line doesn't skip gaps.
export function fillDays<Row extends { day: string }>(rows: Row[], days: number, pick: (row: Row | undefined) => { value: number; secondary?: number }): Point[]
{
    const byDay = new Map(rows.map((row) => [row.day, row]));
    const points: Point[] = [];
    const today = new Date();
    for (let offset = days - 1; offset >= 0; offset--)
    {
        const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - offset));
        const key = date.toISOString().slice(0, 10);
        points.push({ label: key, ...pick(byDay.get(key)) });
    }
    return points;
}
