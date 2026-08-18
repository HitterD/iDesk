import React from 'react';
import { cn } from '@/lib/utils';
import { useIsUserOnline } from '@/hooks/usePresence';

type PresenceDotSize = 'sm' | 'md';

const SIZE_CLASSES: Record<PresenceDotSize, string> = {
    sm: 'w-2 h-2',
    md: 'w-2.5 h-2.5',
};

interface PresenceDotProps {
    userId?: string;
    /** Name of the user the dot belongs to, so the announcement is not a bare "Online". */
    userName?: string;
    size?: PresenceDotSize;
    /** Renders a ring so the dot stays legible when overlapped on an avatar. */
    ringed?: boolean;
    /**
     * Hides the dot from assistive tech. Set this when the same status is already
     * announced nearby in text, so a screen reader does not read it twice.
     */
    decorative?: boolean;
    className?: string;
}

/**
 * Live online/offline indicator for a single user.
 * Subscribes with a narrow selector, so it re-renders only when that user's
 * own presence flips — not on every roster change.
 */
export const PresenceDot: React.FC<PresenceDotProps> = ({ userId, userName, size = 'md', ringed = false, decorative = false, className }) => {
    const isOnline = useIsUserOnline(userId);
    const status = isOnline ? 'Online' : 'Offline';
    const label = userName ? `${userName} is ${status.toLowerCase()}` : status;

    return (
        <span
            role={decorative ? undefined : 'status'}
            aria-label={decorative ? undefined : label}
            aria-hidden={decorative || undefined}
            title={label}
            className={cn(
                'inline-block rounded-full shrink-0',
                SIZE_CLASSES[size],
                isOnline ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600',
                ringed && 'ring-2 ring-white dark:ring-slate-900',
                className,
            )}
        />
    );
};

/**
 * Dot plus text label, for list rows where the status needs a word next to it.
 */
export const PresenceBadge: React.FC<{ userId?: string; className?: string }> = ({ userId, className }) => {
    const isOnline = useIsUserOnline(userId);

    return (
        <span className={cn('inline-flex items-center gap-1.5', className)}>
            {/* The label below carries the status; the dot would just repeat it. */}
            <PresenceDot userId={userId} size="sm" decorative />
            <span className={cn(
                'text-xs font-medium',
                isOnline ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400',
            )}>
                {isOnline ? 'Online' : 'Offline'}
            </span>
        </span>
    );
};
