/**
 * useConfirm Hook
 * Type-safe confirmation dialog hook with Promise-based API
 */

import * as React from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Trash2, Info, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

// ========================================
// Types
// ========================================

export type ConfirmVariant = 'default' | 'destructive' | 'warning' | 'info';

export interface ConfirmOptions {
    /** Dialog title */
    title: string;
    /** Dialog description/message */
    message?: string;
    /** Confirm button text (default: "Konfirmasi") */
    confirmText?: string;
    /** Cancel button text (default: "Batal") */
    cancelText?: string;
    /** Dialog variant affects styling and icon */
    variant?: ConfirmVariant;
    /** Optional custom icon */
    icon?: React.ReactNode;
}

interface ConfirmState extends ConfirmOptions {
    isOpen: boolean;
    resolve: ((value: boolean) => void) | null;
}

// ========================================
// Variant Configurations
// ========================================

const variantConfig: Record<ConfirmVariant, {
    icon: React.ReactNode;
    iconBg: string;
    iconColor: string;
    confirmClass: string;
}> = {
    default: {
        icon: <HelpCircle className="w-6 h-6" />,
        iconBg: 'bg-primary/10',
        iconColor: 'text-primary',
        confirmClass: 'bg-primary hover:bg-primary/90',
    },
    destructive: {
        icon: <Trash2 className="w-6 h-6" />,
        iconBg: 'bg-red-500/10',
        iconColor: 'text-red-500',
        confirmClass: 'bg-red-500 hover:bg-red-600 text-white',
    },
    warning: {
        icon: <AlertTriangle className="w-6 h-6" />,
        iconBg: 'bg-amber-500/10',
        iconColor: 'text-amber-500',
        confirmClass: 'bg-amber-500 hover:bg-amber-600 text-white',
    },
    info: {
        icon: <Info className="w-6 h-6" />,
        iconBg: 'bg-blue-500/10',
        iconColor: 'text-blue-500',
        confirmClass: 'bg-blue-500 hover:bg-blue-600 text-white',
    },
};

// ========================================
// Hook Implementation
// ========================================

export function useConfirm() {
    const [state, setState] = React.useState<ConfirmState>({
        isOpen: false,
        title: '',
        message: '',
        confirmText: 'Konfirmasi',
        cancelText: 'Batal',
        variant: 'default',
        resolve: null,
    });

    const confirm = React.useCallback((options: ConfirmOptions): Promise<boolean> => {
        return new Promise((resolve) => {
            setState({
                isOpen: true,
                title: options.title,
                message: options.message || '',
                confirmText: options.confirmText || 'Konfirmasi',
                cancelText: options.cancelText || 'Batal',
                variant: options.variant || 'default',
                icon: options.icon,
                resolve,
            });
        });
    }, []);

    const handleConfirm = React.useCallback(() => {
        state.resolve?.(true);
        setState((prev) => ({ ...prev, isOpen: false, resolve: null }));
    }, [state.resolve]);

    const handleCancel = React.useCallback(() => {
        state.resolve?.(false);
        setState((prev) => ({ ...prev, isOpen: false, resolve: null }));
    }, [state.resolve]);

    const config = variantConfig[state.variant || 'default'];
    const displayIcon = state.icon || config.icon;

    const ConfirmDialog = React.useMemo(() => {
        const DialogComponent = () => (
            <Dialog
                open={state.isOpen}
                onOpenChange={(open: boolean) => {
                    if (!open) handleCancel();
                }}
            >
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <div className="flex items-start gap-4">
                            {/* Icon */}
                            <div className={cn(
                                'flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center',
                                config.iconBg,
                                config.iconColor
                            )}>
                                {displayIcon}
                            </div>

                            {/* Content */}
                            <div className="flex-1 pt-1">
                                <DialogTitle className="text-lg font-semibold">
                                    {state.title}
                                </DialogTitle>
                                {state.message && (
                                    <DialogDescription className="mt-2">
                                        {state.message}
                                    </DialogDescription>
                                )}
                            </div>
                        </div>
                    </DialogHeader>

                    <DialogFooter className="mt-4 gap-2">
                        <Button variant="outline" onClick={handleCancel}>
                            {state.cancelText}
                        </Button>
                        <Button
                            onClick={handleConfirm}
                            className={cn(config.confirmClass)}
                        >
                            {state.confirmText}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        );

        return DialogComponent;
    }, [state, config, displayIcon, handleConfirm, handleCancel]);

    return {
        confirm,
        ConfirmDialog,
    };
}

// ========================================
// Convenience Hooks
// ========================================

/**
 * Shorthand for destructive confirmations
 */
export function useDestructiveConfirm() {
    const { confirm, ConfirmDialog } = useConfirm();

    const confirmDelete = React.useCallback(
        (title: string, message?: string) =>
            confirm({
                title,
                message,
                confirmText: 'Hapus',
                variant: 'destructive',
            }),
        [confirm]
    );

    return { confirmDelete, ConfirmDialog };
}

export default useConfirm;
