import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Shield, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { lockBodyScroll, unlockBodyScroll } from '@/lib/scrollLock';
import { ROLE_CONFIG, ROLE_ORDER, type UserRoleKey } from './agent-management/agent-types';

interface BulkRoleChangeDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (role: UserRoleKey) => void;
    selectedCount: number;
    isLoading?: boolean;
}

export const BulkRoleChangeDialog: React.FC<BulkRoleChangeDialogProps> = ({
    isOpen,
    onClose,
    onConfirm,
    selectedCount,
    isLoading = false,
}) => {
    const [selectedRole, setSelectedRole] = useState<UserRoleKey | null>(null);
    const dialogRef = useRef<HTMLDivElement>(null);

    useFocusTrap(dialogRef, { enabled: isOpen, onEscape: onClose });

    useEffect(() => {
        if (!isOpen) return;
        lockBodyScroll();
        return unlockBodyScroll;
    }, [isOpen]);

    // Never carry a previous pick into the next opening — the admin may have a
    // different selection of users this time.
    useEffect(() => {
        if (!isOpen) setSelectedRole(null);
    }, [isOpen]);

    if (!isOpen) return null;

    const handleConfirm = () => {
        if (selectedRole) {
            onConfirm(selectedRole);
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Dialog */}
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="bulk-role-title"
                className="relative bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md my-auto overflow-hidden animate-in zoom-in-95 duration-200 z-10 border border-slate-200/50 dark:border-slate-800 flex flex-col max-h-[90vh]"
            >
                {/* Header */}
                <div className="relative bg-gradient-to-br from-primary/20 to-secondary/20 p-6">
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="absolute top-4 right-4 p-2 min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-white/20 rounded-xl transition-colors"
                    >
                        <X className="w-5 h-5 text-slate-600 dark:text-slate-300" aria-hidden="true" />
                    </button>
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-white/30 rounded-2xl flex items-center justify-center">
                            <Shield className="w-7 h-7 text-primary" aria-hidden="true" />
                        </div>
                        <div>
                            <h2 id="bulk-role-title" className="text-xl font-bold text-slate-800 dark:text-white">
                                Change Role
                            </h2>
                            <p className="text-sm text-slate-600 dark:text-slate-300">
                                {selectedCount} user{selectedCount > 1 ? 's' : ''} selected
                            </p>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4 overflow-y-auto">
                    <p id="bulk-role-hint" className="text-sm text-slate-500 dark:text-slate-400">
                        Select the new role to assign to the selected users:
                    </p>

                    {/* Role Options — driven by ROLE_ORDER so a newly added role can never
                        be silently missing from this picker (MANAGER used to be). */}
                    <div className="space-y-3" role="radiogroup" aria-labelledby="bulk-role-hint">
                        {ROLE_ORDER.map((roleKey) => {
                            const conf = ROLE_CONFIG[roleKey];
                            const RoleIcon = conf.icon;
                            const isSelected = selectedRole === roleKey;

                            return (
                                <button
                                    key={roleKey}
                                    type="button"
                                    role="radio"
                                    aria-checked={isSelected}
                                    onClick={() => setSelectedRole(roleKey)}
                                    className={cn(
                                        "w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-[opacity,transform,colors] duration-200 ease-out",
                                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                                        isSelected
                                            ? "border-primary bg-primary/5"
                                            : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                                    )}
                                >
                                    <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shrink-0", conf.bgColor)}>
                                        <RoleIcon className={cn("w-6 h-6", conf.color)} aria-hidden="true" />
                                    </div>
                                    <div className="flex-1 text-left min-w-0">
                                        <p className="font-bold text-slate-800 dark:text-white">
                                            {conf.label}
                                        </p>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">
                                            {conf.description}
                                        </p>
                                    </div>
                                    {isSelected && (
                                        <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center shrink-0">
                                            <div className="w-2 h-2 rounded-full bg-white" />
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 pb-6 flex gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isLoading}
                        className="flex-1 px-6 py-3 min-h-[44px] border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirm}
                        disabled={!selectedRole || isLoading}
                        className="flex-1 px-6 py-3 min-h-[44px] bg-primary text-slate-900 rounded-xl font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                                Updating...
                            </>
                        ) : (
                            'Apply Changes'
                        )}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default BulkRoleChangeDialog;
