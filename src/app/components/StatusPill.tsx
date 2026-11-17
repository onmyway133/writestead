import type { PostStatus } from "../../shared/types";

const STYLES: Record<PostStatus, string> = {
    draft: "bg-zinc-100 text-zinc-600 dark:bg-white/8 dark:text-zinc-300",
    scheduled: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
    published: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
    unlisted: "bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300",
};

export function StatusPill({ status }: { status: PostStatus })
{
    return (
        <span className={`pill ${STYLES[status]}`}>
            <span className="size-1.5 rounded-full bg-current opacity-70" />
            {status[0].toUpperCase() + status.slice(1)}
        </span>
    );
}
