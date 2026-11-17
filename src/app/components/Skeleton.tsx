// Placeholder rows shaped like the table or cards that will load in.
export function TableSkeleton({ rows = 6 }: { rows?: number })
{
    return (
        <div className="card divide-y divide-transparent p-4" role="status" aria-label="Loading">
            {Array.from({ length: rows }, (_, index) => (
                <div key={index} className="flex items-center gap-4 py-3">
                    <div className="skeleton h-4 flex-1" />
                    <div className="skeleton h-4 w-20" />
                    <div className="skeleton h-4 w-24" />
                </div>
            ))}
        </div>
    );
}

export function CardsSkeleton({ count = 4 }: { count?: number })
{
    return (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" role="status" aria-label="Loading">
            {Array.from({ length: count }, (_, index) => (
                <div key={index} className="card space-y-3 p-5">
                    <div className="skeleton h-3 w-20" />
                    <div className="skeleton h-7 w-28" />
                </div>
            ))}
        </div>
    );
}
