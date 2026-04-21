import React, { useState } from 'react';
import { X, Shield, Users, User, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BulkRoleChangeDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (role: 'ADMIN' | 'MANAGER' | 'AGENT' | 'USER' | 'AGENT_ORACLE' | 'AGENT_ADMIN' | 'AGENT_OPERATIONAL_SUPPORT') => void;
    selectedCount: number;
    isLoading?: boolean;
}

const ROLES = [
    {
        value: 'ADMIN' as const,
        label: 'Administrator',
        description: 'Full system access and user management',
        icon: Shield,
        color: 'text-purple-600 dark:text-purple-400',
        bgColor: 'bg-purple-100 dark:bg-purple-900/30',
    },
    {
        value: 'AGENT' as const,
        label: 'Agent',
        description: 'Ticket management and knowledge base access',
        icon: Users,
        color: 'text-blue-600 dark:text-blue-400',
        bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    },
    {
        value: 'USER' as const,
        label: 'User',
        description: 'Submit tickets and view knowledge base',
        icon: User,
        color: 'text-slate-600 dark:text-slate-400',
        bgColor: 'bg-slate-100 dark:bg-slate-700',
    },
    {
        value: 'AGENT_ADMIN' as const,
        label: 'Agent Admin',
        description: 'Manage agents and system operations',
        icon: Shield,
        color: 'text-indigo-600 dark:text-indigo-400',
        bgColor: 'bg-indigo-100 dark:bg-indigo-900/30',
    },
    {
        value: 'AGENT_ORACLE' as const,
        label: 'Agent Oracle',
        description: 'Expert agent for complex resolutions',
        icon: User,
        color: 'text-orange-600 dark:text-orange-400',
        bgColor: 'bg-orange-100 dark:bg-orange-900/30',
    },
    {
        value: 'AGENT_OPERATIONAL_SUPPORT' as const,
        label: 'Ops Support',
        description: 'Provide operational backing',
        icon: Users,
        color: 'text-teal-600 dark:text-teal-400',
        bgColor: 'bg-teal-100 dark:bg-teal-900/30',
    },
];

export const BulkRoleChangeDialog: React.FC<BulkRoleChangeDialogProps> = ({
    isOpen,
    onClose,
    onConfirm,
    selectedCount,
    isLoading = false,
}) => {
    const [selectedRole, setSelectedRole] = useState<'ADMIN' | 'MANAGER' | 'AGENT' | 'USER' | 'AGENT_ORACLE' | 'AGENT_ADMIN' | 'AGENT_OPERATIONAL_SUPPORT' | null>(null);

    if (!isOpen) return null;

    const handleConfirm = () => {
        if (selectedRole) {
            onConfirm(selectedRole);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Dialog */}
            <div className="relative bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="relative bg-gradient-to-br from-primary/20 to-secondary/20 p-6">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-xl transition-colors"
                    >
                        <X className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                    </button>
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-white/30 rounded-2xl flex items-center justify-center">
                            <Shield className="w-7 h-7 text-primary" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-800 dark:text-white">
                                Change Role
                            </h2>
                            <p className="text-sm text-slate-600 dark:text-slate-300">
                                {selectedCount} user{selectedCount > 1 ? 's' : ''} selected
                            </p>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4">
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Select the new role to assign to the selected users:
                    </p>

                    {/* Role Options */}
                    <div className="space-y-3">
                        {ROLES.map((role) => (
                            <button
                                key={role.value}
                                onClick={() => setSelectedRole(role.value)}
                                className={cn(
                                    "w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-[opacity,transform,colors] duration-200 ease-out",
                                    selectedRole === role.value
                                        ? "border-primary bg-primary/5"
                                        : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                                )}
                            >
                                <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", role.bgColor)}>
                                    <role.icon className={cn("w-6 h-6", role.color)} />
                                </div>
                                <div className="flex-1 text-left">
                                    <p className="font-bold text-slate-800 dark:text-white">
                                        {role.label}
                                    </p>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">
                                        {role.description}
                                    </p>
                                </div>
                                {selectedRole === role.value && (
                                    <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                                        <div className="w-2 h-2 rounded-full bg-white" />
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 pb-6 flex gap-3">
                    <button
                        onClick={onClose}
                        disabled={isLoading}
                        className="flex-1 px-6 py-3 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={!selectedRole || isLoading}
                        className="flex-1 px-6 py-3 bg-primary text-slate-900 rounded-xl font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Updating...
                            </>
                        ) : (
                            'Apply Changes'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BulkRoleChangeDialog;
