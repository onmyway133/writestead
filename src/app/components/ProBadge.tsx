import { Crown } from "@phosphor-icons/react";

export function ProBadge()
{
    return (
        <span className="pill bg-brand/12 text-brand dark:bg-brand/25 dark:text-violet-200">
            <Crown weight="fill" className="size-3" />
            Pro
        </span>
    );
}
