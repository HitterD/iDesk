import { PackageOpen } from 'lucide-react';
import type { ReactNode } from 'react';

export function EmptyState({
    icon,
    title,
    desc,
    cta,
}: {
    icon?: ReactNode;
    title: string;
    desc?: string;
    cta?: ReactNode;
}) {
    return (
        <div className="text-center py-16 px-6">
            <div className="inline-flex items-center justify-center size-14 rounded-full bg-slate-100 mb-4">
                {icon ?? <PackageOpen className="size-6 text-slate-500" />}
            </div>
            <h3 className="text-base font-semibold tracking-tight text-slate-900">{title}</h3>
            {desc && <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">{desc}</p>}
            {cta && <div className="mt-4">{cta}</div>}
        </div>
    );
}
