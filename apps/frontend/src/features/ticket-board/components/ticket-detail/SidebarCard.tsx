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
}> = ({ title, accessory, className, bodyClassName, children }) => (
    <section className={cn('ticket-panel', className)}>
        {/* Mockup `.panel h3`: plain title, optional accessory at the right (`icon` is accepted but no longer drawn). */}
        <h3 className="td-panel-h">
            {title}
            {accessory && <span className="td-panel-acc">{accessory}</span>}
        </h3>
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
        'td-kv flex items-center justify-between gap-3 py-[7px] text-[12.5px] border-t-[0.5px] border-[var(--td-line)]',
        className,
    )}>
        <span className="flex shrink-0 items-center gap-1.5 text-[hsl(var(--idesk-text-secondary))]">
            {Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
            {label}
        </span>
        <span className="min-w-0 truncate text-right font-[550] text-[hsl(var(--idesk-text))]">{children}</span>
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

/** Spacing for the stack of inspector panels; the container supplies outer padding. */
export const sidebarPanelClass = 'space-y-3';
