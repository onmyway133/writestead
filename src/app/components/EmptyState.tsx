import type { ReactNode } from "react";

export function EmptyState({ icon, title, message, action }: { icon: ReactNode; title: string; message: ReactNode; action?: ReactNode })
{
    return (
        <div className="card flex flex-col items-center px-6 py-14 text-center">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-brand/10 text-brand dark:bg-brand/20">{icon}</div>
            <h2 className="mt-4 text-base font-bold tracking-tight">{title}</h2>
            <p className="muted mt-1.5 max-w-sm text-sm">{message}</p>
            {action && <div className="mt-6 flex flex-wrap justify-center gap-2">{action}</div>}
        </div>
    );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void })
{
    return (
        <div className="card flex flex-col items-center px-6 py-12 text-center">
            <p className="text-sm font-semibold">Couldn't load this</p>
            <p className="muted mt-1 text-sm">{message}</p>
            <button type="button" className="btn-secondary mt-4" onClick={onRetry}>Try again</button>
        </div>
    );
}
