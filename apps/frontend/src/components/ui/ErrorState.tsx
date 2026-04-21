import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ErrorStateProps {
    title?: string;
    message?: string;
    onRetry?: () => void;
    retryLabel?: string;
    className?: string;
    compact?: boolean;
}

/**
 * Reusable error state component for displaying API/query errors
 * with optional retry functionality
 */
export const ErrorState: React.FC<ErrorStateProps> = ({
    title = 'Terjadi Kesalahan',
    message = 'Gagal memuat data. Silakan coba lagi.',
    onRetry,
    retryLabel = 'Coba Lagi',
    className,
    compact = false,
}) => {
    if (compact) {
        return (
            <div className={cn(
                "flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl",
                className
            )}>
                <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-red-800 dark:text-red-300">{title}</p>
                    <p className="text-xs text-red-600 dark:text-red-400">{message}</p>
                </div>
                {onRetry && (
                    <button
                        onClick={onRetry}
                        className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/40 hover:bg-red-200 dark:hover:bg-red-900/60 rounded-lg transition-colors"
                        aria-label={retryLabel}
                    >
                        <RefreshCw className="w-3.5 h-3.5" />
                        {retryLabel}
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className={cn(
            "flex flex-col items-center justify-center py-16 px-4",
            className
        )}>
            <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
                <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2 text-center">
                {title}
            </h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm text-center max-w-sm mb-6">
                {message}
            </p>
            {onRetry && (
                <button
                    onClick={onRetry}
                    className="flex items-center gap-2 px-6 py-3 bg-primary text-slate-900 font-bold rounded-xl hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
                    aria-label={retryLabel}
                >
                    <RefreshCw className="w-4 h-4" />
                    {retryLabel}
                </button>
            )}
        </div>
    );
};
