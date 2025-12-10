/**
 * Skeleton Components
 * Loading placeholder components for common UI patterns
 */

import * as React from 'react';
import { cn } from '@/lib/utils';

// ========================================
// Base Skeleton
// ========================================

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
    /** Show pulse animation */
    animate?: boolean;
}

function Skeleton({ className, animate = true, ...props }: SkeletonProps) {
    return (
        <div
            className={cn(
                'rounded-[var(--radius-md)] bg-muted',
                animate && 'animate-pulse',
                className
            )}
            {...props}
        />
    );
}

// ========================================
// Skeleton Variants
// ========================================

interface SkeletonTextProps {
    /** Number of text lines */
    lines?: number;
    /** Width of last line (for natural look) */
    lastLineWidth?: string;
    className?: string;
}

function SkeletonText({ lines = 3, lastLineWidth = '60%', className }: SkeletonTextProps) {
    return (
        <div className={cn('space-y-2', className)}>
            {Array.from({ length: lines }).map((_, i) => (
                <Skeleton
                    key={i}
                    className="h-4"
                    style={{ width: i === lines - 1 ? lastLineWidth : '100%' }}
                />
            ))}
        </div>
    );
}

interface SkeletonCardProps {
    /** Show header section */
    showHeader?: boolean;
    /** Number of content lines */
    contentLines?: number;
    /** Show footer section */
    showFooter?: boolean;
    className?: string;
}

function SkeletonCard({
    showHeader = true,
    contentLines = 3,
    showFooter = true,
    className
}: SkeletonCardProps) {
    return (
        <div className={cn('rounded-xl border bg-card p-4 space-y-4', className)}>
            {showHeader && (
                <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="space-y-2 flex-1">
                        <Skeleton className="h-4 w-1/3" />
                        <Skeleton className="h-3 w-1/4" />
                    </div>
                </div>
            )}
            <SkeletonText lines={contentLines} />
            {showFooter && (
                <div className="flex gap-2 pt-2">
                    <Skeleton className="h-8 w-20 rounded-lg" />
                    <Skeleton className="h-8 w-20 rounded-lg" />
                </div>
            )}
        </div>
    );
}

interface SkeletonTableProps {
    rows?: number;
    columns?: number;
    showHeader?: boolean;
    className?: string;
}

function SkeletonTable({ rows = 5, columns = 4, showHeader = true, className }: SkeletonTableProps) {
    return (
        <div className={cn('rounded-xl border overflow-hidden', className)}>
            {showHeader && (
                <div className="bg-muted/50 p-4 border-b">
                    <div className="flex gap-4">
                        {Array.from({ length: columns }).map((_, i) => (
                            <Skeleton key={i} className="h-4 flex-1" style={{ maxWidth: i === 0 ? '40%' : '25%' }} />
                        ))}
                    </div>
                </div>
            )}
            <div className="divide-y">
                {Array.from({ length: rows }).map((_, rowIndex) => (
                    <div key={rowIndex} className="p-4 flex gap-4">
                        {Array.from({ length: columns }).map((_, colIndex) => (
                            <Skeleton
                                key={colIndex}
                                className="h-4 flex-1"
                                style={{ maxWidth: colIndex === 0 ? '40%' : '25%' }}
                            />
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}

function SkeletonStat({ showIcon = true, className }: { showIcon?: boolean; className?: string }) {
    return (
        <div className={cn('rounded-xl border bg-card p-4 space-y-3', className)}>
            <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-24" />
                {showIcon && <Skeleton className="h-8 w-8 rounded-lg" />}
            </div>
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-3 w-20" />
        </div>
    );
}

function SkeletonAvatar({ className }: { className?: string }) {
    return <Skeleton className={cn('h-10 w-10 rounded-full', className)} />;
}

function SkeletonButton({ className }: { className?: string }) {
    return <Skeleton className={cn('h-9 w-24 rounded-lg', className)} />;
}

function SkeletonList({ items = 5, showAvatar = true, className }: {
    items?: number;
    showAvatar?: boolean;
    className?: string
}) {
    return (
        <div className={cn('space-y-3', className)}>
            {Array.from({ length: items }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg border">
                    {showAvatar && <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />}
                    <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                    </div>
                    <Skeleton className="h-6 w-16 rounded-full" />
                </div>
            ))}
        </div>
    );
}

export {
    Skeleton,
    SkeletonText,
    SkeletonCard,
    SkeletonTable,
    SkeletonStat,
    SkeletonAvatar,
    SkeletonButton,
    SkeletonList,
};
