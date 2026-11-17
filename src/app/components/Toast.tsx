import { CheckCircle, WarningCircle } from "@phosphor-icons/react";
import { useEffect, useState } from "react";

type Toast = { id: number; message: string; tone: "success" | "error" };

const EVENT = "writestead:toast";
let nextId = 1;

export function toast(message: string, tone: Toast["tone"] = "success")
{
    window.dispatchEvent(new CustomEvent<Toast>(EVENT, { detail: { id: nextId++, message, tone } }));
}

export function ToastHost()
{
    const [toasts, setToasts] = useState<Toast[]>([]);

    useEffect(() =>
    {
        const show = (event: Event) =>
        {
            const item = (event as CustomEvent<Toast>).detail;
            setToasts((current) => [...current.slice(-2), item]);
            setTimeout(() =>
            {
                setToasts((current) => current.filter((other) => other.id !== item.id));
            }, item.tone === "error" ? 6000 : 3000);
        };
        window.addEventListener(EVENT, show);
        return () =>
        {
            window.removeEventListener(EVENT, show);
        };
    }, []);

    return (
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4" aria-live="polite">
            {toasts.map((item) => (
                <div key={item.id} className="pointer-events-auto flex max-w-md animate-pop-in items-center gap-2.5 rounded-xl bg-zinc-900 px-4 py-3 text-sm font-medium text-white shadow-lg dark:bg-zinc-100 dark:text-zinc-900">
                    {item.tone === "success"
                        ? <CheckCircle weight="fill" className="size-4 shrink-0 text-emerald-400 dark:text-emerald-600" />
                        : <WarningCircle weight="fill" className="size-4 shrink-0 text-red-400 dark:text-red-600" />}
                    {item.message}
                </div>
            ))}
        </div>
    );
}
