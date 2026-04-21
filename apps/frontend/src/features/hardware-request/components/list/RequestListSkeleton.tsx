export function RequestListSkeleton() {
    return (
        <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-14 rounded-2xl bg-slate-100 animate-pulse" />
            ))}
        </div>
    );
}
