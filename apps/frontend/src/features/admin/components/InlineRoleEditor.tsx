import React, { useState, useRef, useEffect } from 'react';
import { Shield, ChevronDown, Check, X, Crown, User, Loader2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '@/lib/api';
import { cn } from '@/lib/utils';

interface InlineRoleEditorProps {
    userId: string;
    currentRole: 'ADMIN' | 'MANAGER' | 'AGENT' | 'USER';
    onUpdate?: () => void;
}

const ROLE_CONFIG = {
    ADMIN: { icon: Shield, color: 'text-purple-600', bg: 'bg-purple-100 dark:bg-purple-900/30', label: 'Admin' },
    MANAGER: { icon: Crown, color: 'text-amber-600', bg: 'bg-amber-100 dark:bg-amber-900/30', label: 'Manager' },
    AGENT: { icon: User, color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-900/30', label: 'Agent' },
    USER: { icon: User, color: 'text-slate-600', bg: 'bg-slate-100 dark:bg-slate-800', label: 'User' },
};

const ROLES: ('ADMIN' | 'MANAGER' | 'AGENT' | 'USER')[] = ['ADMIN', 'MANAGER', 'AGENT', 'USER'];

export const InlineRoleEditor: React.FC<InlineRoleEditorProps> = ({
    userId,
    currentRole,
    onUpdate
}) => {
    const queryClient = useQueryClient();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const mutation = useMutation({
        mutationFn: async (role: string) => {
            const res = await api.patch(`/users/${userId}/role`, { role });
            return res.data;
        },
        onSuccess: () => {
            toast.success('Role updated');
            queryClient.invalidateQueries({ queryKey: ['users'] });
            queryClient.invalidateQueries({ queryKey: ['agent-stats'] });
            setIsOpen(false);
            onUpdate?.();
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.message || 'Failed to update role');
        },
    });

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isOpen]);

    const config = ROLE_CONFIG[currentRole];
    const Icon = config.icon;

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(!isOpen);
                }}
                disabled={mutation.isPending}
                className={cn(
                    "flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-bold transition-colors duration-150",
                    config.bg, config.color,
                    "hover:ring-2 hover:ring-primary/50 cursor-pointer",
                    mutation.isPending && "opacity-50 cursor-wait"
                )}
            >
                {mutation.isPending ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                    <Icon className="w-3 h-3" />
                )}
                {config.label}
                <ChevronDown className={cn("w-3 h-3 transition-transform", isOpen && "rotate-180")} />
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 mt-1 z-50 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-1 min-w-[120px] animate-in fade-in zoom-in-95">
                    {ROLES.map((role) => {
                        const roleConfig = ROLE_CONFIG[role];
                        const RoleIcon = roleConfig.icon;
                        const isSelected = role === currentRole;

                        return (
                            <button
                                key={role}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (role !== currentRole) {
                                        mutation.mutate(role);
                                    }
                                }}
                                className={cn(
                                    "w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors",
                                    isSelected
                                        ? "bg-primary/10 text-primary"
                                        : "hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                                )}
                            >
                                <RoleIcon className={cn("w-4 h-4", roleConfig.color)} />
                                <span className="flex-1 text-left">{roleConfig.label}</span>
                                {isSelected && <Check className="w-4 h-4 text-primary" />}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
