import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Section card used by the agent and requester ticket sidebars: one white card per section
 * on a soft panel, an icon + title header, plain rows inside (no nested boxes).
 */
export const SidebarCard: React.FC<{
    title: React.ReactNode;
    icon?: React.ElementType;
    /** Shown at the right of the title, e.g. a count, badge or small action. */
    accessory?: React.ReactNode;
    className?: string;
    bodyClassName?: string;
    children: React.ReactNode;
}> = ({ title, icon: Icon, accessory, className, bodyClassName, children }) => (
    <section className={cn(
        'rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-slate-900/[0.05] dark:bg-slate-900 dark:ring-white/[0.06]',
        className,
    )}>
        <div className="mb-3 flex min-h-6 items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-[13px] font-semibold text-slate-900 dark:text-slate-100">
                {Icon && (
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                )}
                {title}
            </h3>
            {accessory}
        </div>
        <div className={bodyClassName}>{children}</div>
    </section>
);

/** Label/value row; consecutive rows are separated by hairlines. */
export const InfoRow: React.FC<{
    label: React.ReactNode;
    icon?: React.ElementType;
    children: React.ReactNode;
    className?: string;
}> = ({ label, icon: Icon, children, className }) => (
    <div className={cn(
        'flex min-h-9 items-center justify-between gap-3 py-1.5 text-[13px] [&+&]:border-t [&+&]:border-slate-100 dark:[&+&]:border-slate-800',
        className,
    )}>
        <span className="flex shrink-0 items-center gap-1.5 text-slate-500 dark:text-slate-400">
            {Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
            {label}
        </span>
        <span className="min-w-0 truncate text-right font-medium text-slate-900 dark:text-slate-100">{children}</span>
    </div>
);

/** Small pill for the card accessory slot. */
export const CardBadge: React.FC<{ tone?: 'neutral' | 'primary' | 'amber' | 'rose' | 'emerald'; className?: string; children: React.ReactNode }> = ({
    tone = 'neutral',
    className,
    children,
}) => (
    <span className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
        tone === 'neutral' && 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
        tone === 'primary' && 'bg-primary/10 text-primary',
        tone === 'amber' && 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300',
        tone === 'rose' && 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300',
        tone === 'emerald' && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
        className,
    )}>
        {children}
    </span>
);

/** Inline select trigger: reads as a value at the right of a row, highlights on hover. */
export const fieldTriggerClass =
    'h-8 w-auto max-w-[62%] gap-1.5 px-2 -mr-2 text-[13px] font-medium bg-transparent border-0 shadow-none rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer justify-end [&>svg]:opacity-40';

/** Background + spacing for the sidebar panel that holds the cards. */
export const sidebarPanelClass = 'space-y-3 p-4';
