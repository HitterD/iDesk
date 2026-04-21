import React from 'react';

export const NotificationSkeleton: React.FC = () => {
    return (
        <div className="flex items-start gap-4 p-4 rounded-xl animate-pulse bg-slate-50/50 dark:bg-slate-800/30">
            <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-700 shrink-0" />
            <div className="flex-1 space-y-3">
                <div className="flex items-center justify-between gap-4">
                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/3" />
                    <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-16" />
                </div>
                <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-3/4" />
                <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-1/2" />
            </div>
        </div>
    );
};
