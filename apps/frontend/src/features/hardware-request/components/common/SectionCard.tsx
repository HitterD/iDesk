import type { ReactNode } from 'react';

export function SectionCard({ title, action, children, className = '' }: {
    title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string;
}) {
    return (
        <section className={`rounded-2xl bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-800 shadow-sm ${className}`}>
            {(title || action) && (
                <header className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
                    <h3 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-white">{title}</h3>
                    {action}
                </header>
            )}
            <div className="p-5">{children}</div>
        </section>
    );
}
