export function Logo({ size = 28, withName = true }: { size?: number; withName?: boolean })
{
    return (
        <span className="inline-flex items-center gap-2 font-semibold tracking-tight">
            <img src="/_ws/logo-128.png" alt="" width={size} height={size} />
            {withName && <span className="text-[17px]">Writestead</span>}
        </span>
    );
}
