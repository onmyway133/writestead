import { Crown } from "@phosphor-icons/react";
import { navigate } from "../../lib/router";
import { useSession } from "../../lib/session";

// Shown in place of data that needs Pro. Self-hosted installs never see it.
export function ProHint({ text }: { text: string })
{
    const { me } = useSession();
    return (
        <div className="flex items-start gap-3 rounded-xl bg-brand/8 p-4 text-sm dark:bg-brand/15">
            <Crown weight="fill" className="mt-0.5 size-4 shrink-0 text-brand" />
            <div className="min-w-0">
                <p className="font-medium">{text}</p>
                {me.mode === "multi" && (
                    <button type="button" className="mt-1 font-semibold text-brand hover:underline" onClick={() =>
                    {
                        navigate("/admin/settings/plan");
                    }}>Upgrade to Pro</button>
                )}
            </div>
        </div>
    );
}
