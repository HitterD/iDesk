import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

export const AgentGridSkeleton: React.FC = () => (
    <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
        {[...Array(10)].map((_, i) => (
            <div key={i} className="glass-card p-4 rounded-2xl animate-pulse">
                <div className="flex items-start gap-3 mb-3">
                    <div className="w-12 h-12 bg-slate-200 dark:bg-slate-700 rounded-xl" />
                    <div className="flex-1 space-y-2">
                        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
                        <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
                    </div>
                </div>
                <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full mb-3" />
                <div className="flex gap-2 mb-3">
                    <div className="h-5 w-10 bg-slate-200 dark:bg-slate-700 rounded" />
                    <div className="h-5 w-14 bg-slate-200 dark:bg-slate-700 rounded" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                    {[1, 2, 3].map((j) => (
                        <div key={j} className="h-12 bg-slate-200 dark:bg-slate-700 rounded-lg" />
                    ))}
                </div>
            </div>
        ))}
    </div>
);

export const AgentTableSkeleton: React.FC = () => (
    <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
                <div key={i} className="rounded-2xl p-5 bg-slate-200 dark:bg-slate-700 animate-pulse h-24" />
            ))}
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                <div className="h-5 w-40 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
            </div>
            <div className="p-4 space-y-3">
                {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center gap-4">
                        <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse" />
                        <div className="flex-1 space-y-2">
                            <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                            <div className="h-3 w-48 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                        </div>
                        <div className="flex gap-2">
                            {[...Array(5)].map((_, j) => (
                                <div key={j} className="h-6 w-12 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    </div>
);

export const ErrorState: React.FC<{ message: string; onRetry: () => void }> = ({ message, onRetry }) => (
    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-8 text-center">
        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-500" />
        </div>
        <h3 className="text-lg font-bold text-red-800 dark:text-red-300 mb-2">Failed to Load Data</h3>
        <p className="text-red-600 dark:text-red-400 mb-4 max-w-md mx-auto">{message}</p>
        <button
            onClick={onRetry}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors mx-auto"
        >
            <RefreshCw className="w-4 h-4" />
            Try Again
        </button>
    </div>
);
