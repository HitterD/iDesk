import React from 'react';
import { AlertTriangle, Trash2, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConfirmationDialogProps {
    isOpen: boolean;
    title: string;
    description: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'default' | 'destructive' | 'warning';
    onConfirm: () => void;
    onCancel: () => void;
    isLoading?: boolean;
}

const variantConfig = {
    default: {
        icon: AlertTriangle,
        iconBg: 'bg-primary/10',
        iconColor: 'text-primary',
        confirmBg: 'bg-primary',
        confirmHover: 'hover:bg-primary/90',
        confirmText: 'text-slate-900',
    },
    destructive: {
        icon: Trash2,
        iconBg: 'bg-red-100 dark:bg-red-900/30',
        iconColor: 'text-red-500',
        confirmBg: 'bg-red-500',
        confirmHover: 'hover:bg-red-600',
        confirmText: 'text-white',
    },
    warning: {
        icon: AlertTriangle,
        iconBg: 'bg-amber-100 dark:bg-amber-900/30',
        iconColor: 'text-amber-500',
        confirmBg: 'bg-amber-500',
        confirmHover: 'hover:bg-amber-600',
        confirmText: 'text-white',
    },
};

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
    isOpen,
    title,
    description,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    variant = 'default',
    onConfirm,
    onCancel,
    isLoading = false,
}) => {
    if (!isOpen) return null;

    const config = variantConfig[variant];
    const Icon = config.icon;

    return (
        <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={onCancel}
        >
            <div
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="confirmation-title"
                aria-describedby="confirmation-description"
                className="glass-card-elevated max-w-md w-full overflow-hidden animate-scale-in"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center gap-4 p-6 pb-4">
                    <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shrink-0", config.iconBg)}>
                        <Icon className={cn("w-6 h-6", config.iconColor)} />
                    </div>
                    <div className="flex-1">
                        <h3
                            id="confirmation-title"
                            className="font-bold text-lg text-slate-800 dark:text-white"
                        >
                            {title}
                        </h3>
                        <p
                            id="confirmation-description"
                            className="text-sm text-slate-500 dark:text-slate-400 mt-1"
                        >
                            {description}
                        </p>
                    </div>
                    <button
                        onClick={onCancel}
                        disabled={isLoading}
                        className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
                    >
                        <X className="w-5 h-5 text-slate-400" />
                    </button>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-700">
                    <button
                        onClick={onCancel}
                        disabled={isLoading}
                        className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isLoading}
                        className={cn(
                            "flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg transition-colors duration-150",
                            config.confirmBg,
                            config.confirmHover,
                            config.confirmText,
                            "disabled:opacity-50 disabled:cursor-not-allowed"
                        )}
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Processing...
                            </>
                        ) : (
                            confirmText
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmationDialog;
