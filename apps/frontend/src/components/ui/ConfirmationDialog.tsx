import React, { useCallback, useEffect, useRef } from 'react';
import { AlertTriangle, Trash2, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { lockBodyScroll, unlockBodyScroll } from '@/lib/scrollLock';

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
    /** Blocks confirmation while a precondition is unmet (e.g. an unconfirmed input). */
    confirmDisabled?: boolean;
    /** Extra input rendered between the description and the action row. */
    children?: React.ReactNode;
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
    confirmDisabled = false,
    children,
}) => {
    const dialogRef = useRef<HTMLDivElement>(null);

    // Escape must not dismiss mid-request: the action is already in flight and
    // closing here only hides the result. Stable identity — useFocusTrap re-runs
    // its effect whenever onEscape changes.
    const handleEscape = useCallback(() => {
        if (!isLoading) onCancel();
    }, [isLoading, onCancel]);

    useFocusTrap(dialogRef, { enabled: isOpen, onEscape: handleEscape });

    useEffect(() => {
        if (!isOpen) return;
        lockBodyScroll();
        return unlockBodyScroll;
    }, [isOpen]);

    if (!isOpen) return null;

    const config = variantConfig[variant];
    const Icon = config.icon;
    const dismiss = () => { if (!isLoading) onCancel(); };

    return (
        <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={dismiss}
        >
            <div
                ref={dialogRef}
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
                        type="button"
                        onClick={dismiss}
                        disabled={isLoading}
                        aria-label={cancelText}
                        className="p-1 min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
                    >
                        <X className="w-5 h-5 text-slate-400" aria-hidden="true" />
                    </button>
                </div>

                {children && <div className="px-6 pb-2">{children}</div>}

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-700">
                    <button
                        type="button"
                        onClick={dismiss}
                        disabled={isLoading}
                        className="px-4 py-2 min-h-[44px] text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
                    >
                        {cancelText}
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={isLoading || confirmDisabled}
                        className={cn(
                            "flex items-center gap-2 px-4 py-2 min-h-[44px] text-sm font-bold rounded-lg transition-colors duration-150",
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
