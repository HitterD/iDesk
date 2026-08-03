import React, { useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Trash2, ToggleRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { lockBodyScroll, unlockBodyScroll } from '@/lib/scrollLock';

interface ConfirmDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'warning' | 'info';
    isLoading?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    variant = 'danger',
    isLoading = false,
}) => {
    const dialogRef = useRef<HTMLDivElement>(null);

    // Dismissing mid-request would leave the caller unable to report the outcome.
    const handleClose = useCallback(() => {
        if (isLoading) return;
        onClose();
    }, [isLoading, onClose]);

    useFocusTrap(dialogRef, { enabled: isOpen, onEscape: handleClose });

    useEffect(() => {
        if (!isOpen) return;
        lockBodyScroll();
        return unlockBodyScroll;
    }, [isOpen]);

    if (!isOpen) return null;

    const variantStyles = {
        danger: {
            icon: Trash2,
            iconBg: 'bg-red-100 dark:bg-red-900/30',
            iconColor: 'text-red-600 dark:text-red-400',
            buttonBg: 'bg-red-600 hover:bg-red-700',
        },
        warning: {
            icon: AlertTriangle,
            iconBg: 'bg-amber-100 dark:bg-amber-900/30',
            iconColor: 'text-amber-600 dark:text-amber-400',
            buttonBg: 'bg-amber-600 hover:bg-amber-700',
        },
        info: {
            icon: ToggleRight,
            iconBg: 'bg-blue-100 dark:bg-blue-900/30',
            iconColor: 'text-blue-600 dark:text-blue-400',
            buttonBg: 'bg-blue-600 hover:bg-blue-700',
        },
    };

    const styles = variantStyles[variant];
    const Icon = styles.icon;

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="confirm-dialog-title"
                aria-describedby="confirm-dialog-message"
                className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm my-auto overflow-hidden animate-in zoom-in-95 duration-200 z-10 border border-slate-200/50 dark:border-slate-800"
            >
                <div className="p-6 text-center">
                    <div className={cn("w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-4", styles.iconBg)}>
                        <Icon className={cn("w-8 h-8", styles.iconColor)} aria-hidden="true" />
                    </div>
                    <h3 id="confirm-dialog-title" className="text-lg font-bold text-slate-800 dark:text-white mb-2">{title}</h3>
                    <p id="confirm-dialog-message" className="text-slate-500 dark:text-slate-400 text-sm">{message}</p>
                </div>
                <div className="flex gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700">
                    <button
                        type="button"
                        onClick={handleClose}
                        disabled={isLoading}
                        className="flex-1 min-h-[44px] px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                    >
                        {cancelText}
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={isLoading}
                        className={cn(
                            "flex-1 min-h-[44px] px-4 py-2.5 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50",
                            styles.buttonBg
                        )}
                    >
                        {isLoading ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" aria-hidden="true" />
                                <span className="sr-only">Processing</span>
                            </>
                        ) : (
                            confirmText
                        )}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};
