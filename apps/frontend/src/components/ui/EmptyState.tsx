import React from 'react';
import { Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
    title?: string;
    message: string;
    icon?: React.ElementType;
    action?: {
        label: string;
        onClick: () => void;
    };
    size?: 'sm' | 'default' | 'lg';
    className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
    title,
    message,
    icon: Icon = Inbox,
    action,
    size = 'default',
    className,
}) => {
    return (
        <div
            className={cn(
                "flex flex-col items-center justify-center text-center animate-fade-in-up",
                size === 'sm' && "py-8 px-4",
                size === 'default' && "py-12 px-6",
                size === 'lg' && "py-16 px-8",
                className
            )}
        >
            {/* Floating Icon */}
            <div
                className={cn(
                    "rounded-2xl mb-4 flex items-center justify-center animate-floating",
                    "bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900",
                    "border border-slate-200 dark:border-slate-700",
                    "shadow-lg shadow-slate-200/50 dark:shadow-black/20",
                    size === 'sm' && "w-12 h-12",
                    size === 'default' && "w-16 h-16",
                    size === 'lg' && "w-20 h-20",
                )}
            >
                <Icon
                    className={cn(
                        "text-slate-400 dark:text-slate-500",
                        size === 'sm' && "w-6 h-6",
                        size === 'default' && "w-8 h-8",
                        size === 'lg' && "w-10 h-10",
                    )}
                />
            </div>

            {/* Title */}
            {title && (
                <h3
                    className={cn(
                        "font-semibold text-slate-700 dark:text-slate-200 mb-1",
                        size === 'sm' && "text-sm",
                        size === 'default' && "text-base",
                        size === 'lg' && "text-lg",
                    )}
                >
                    {title}
                </h3>
            )}

            {/* Message */}
            <p
                className={cn(
                    "text-slate-500 dark:text-slate-400 max-w-sm",
                    size === 'sm' && "text-xs",
                    size === 'default' && "text-sm",
                    size === 'lg' && "text-base",
                )}
            >
                {message}
            </p>

            {/* Action Button */}
            {action && (
                <button
                    onClick={action.onClick}
                    className={cn(
                        "mt-4 inline-flex items-center gap-2 font-medium rounded-xl transition-[opacity,transform,colors] duration-200 ease-out",
                        "bg-primary text-slate-900 hover:bg-primary/90",
                        "shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30",
                        "hover:-translate-y-0.5 active:translate-y-0",
                        size === 'sm' && "px-3 py-1.5 text-xs",
                        size === 'default' && "px-4 py-2 text-sm",
                        size === 'lg' && "px-5 py-2.5 text-base",
                    )}
                >
                    {action.label}
                </button>
            )}
        </div>
    );
};
