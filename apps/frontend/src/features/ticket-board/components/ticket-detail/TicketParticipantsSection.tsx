import React, { useState, useMemo } from 'react';
import {
    Users,
    UserPlus,
    Trash2,
    Search,
    Loader2,
    Check,
    X,
    Shield,
    Sparkles,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import type { TicketParticipant } from './types';

interface TicketParticipantsSectionProps {
    ticketId: string;
    creator: {
        id?: string;
        fullName: string;
        email?: string;
        department?: { name?: string };
        avatarUrl?: string | null;
    };
    participants?: TicketParticipant[];
    canManageUsers: boolean; // Only AGENT_ORACLE and ADMIN can delete participants
    canAddUsers: boolean;    // Creator, existing participants, AGENT_ORACLE, ADMIN can add
    isClosed?: boolean;
}

interface ActiveUser {
    id: string;
    fullName: string;
    email: string;
    role?: string;
    avatarUrl?: string | null;
    department?: {
        id: string;
        name: string;
    };
}

export const TicketParticipantsSection: React.FC<TicketParticipantsSectionProps> = ({
    ticketId,
    creator,
    participants = [],
    canManageUsers,
    canAddUsers,
    isClosed = false,
}) => {
    const queryClient = useQueryClient();
    const [popoverOpen, setPopoverOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
    const [removingUserId, setRemovingUserId] = useState<string | null>(null);

    // Fetch active users for adding to ticket
    const { data: activeUsers = [], isLoading: isLoadingUsers } = useQuery<ActiveUser[]>({
        queryKey: ['users', 'active-for-participants'],
        queryFn: async () => {
            const res = await api.get('/users/approvers');
            return res.data;
        },
        enabled: popoverOpen,
        staleTime: 60 * 1000,
    });

    // Exclude creator and already joined participants
    const existingUserIds = useMemo(() => {
        const set = new Set<string>();
        if (creator?.id) set.add(creator.id);
        participants.forEach((p) => {
            if (p.userId) set.add(p.userId);
        });
        return set;
    }, [creator?.id, participants]);

    const availableUsers = useMemo(() => {
        return activeUsers.filter((u) => !existingUserIds.has(u.id));
    }, [activeUsers, existingUserIds]);

    const filteredUsers = useMemo(() => {
        if (!searchQuery.trim()) return availableUsers.slice(0, 50);
        const q = searchQuery.toLowerCase().trim();
        return availableUsers
            .filter(
                (u) =>
                    u.fullName?.toLowerCase().includes(q) ||
                    u.email?.toLowerCase().includes(q) ||
                    u.department?.name?.toLowerCase().includes(q)
            )
            .slice(0, 50);
    }, [availableUsers, searchQuery]);

    // Mutation: Add Participants
    const addParticipantsMutation = useMutation({
        mutationFn: async (userIds: string[]) => {
            const res = await api.post(`/tickets/${ticketId}/participants`, { userIds });
            return res.data;
        },
        onSuccess: () => {
            toast.success('User berhasil ditambahkan ke tiket');
            queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] });
            setSelectedUserIds([]);
            setSearchQuery('');
            setPopoverOpen(false);
        },
        onError: (err: any) => {
            const msg = err?.response?.data?.message || 'Gagal menambahkan user';
            toast.error(msg);
        },
    });

    // Mutation: Remove Participant
    const removeParticipantMutation = useMutation({
        mutationFn: async (userId: string) => {
            setRemovingUserId(userId);
            const res = await api.delete(`/tickets/${ticketId}/participants/${userId}`);
            return res.data;
        },
        onSuccess: () => {
            toast.success('Partisipan berhasil dikeluarkan');
            queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] });
        },
        onError: (err: any) => {
            const msg = err?.response?.data?.message || 'Gagal mengeluarkan partisipan';
            toast.error(msg);
        },
        onSettled: () => {
            setRemovingUserId(null);
        },
    });

    const toggleSelectUser = (id: string) => {
        setSelectedUserIds((prev) =>
            prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
        );
    };

    const handleAddSelected = () => {
        if (selectedUserIds.length === 0) return;
        addParticipantsMutation.mutate(selectedUserIds);
    };

    const totalCount = 1 + participants.length;

    return (
        <div className="bg-white dark:bg-slate-800/95 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-700/60 shadow-2xs space-y-3">
            {/* Section Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400">
                        <Users className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                        Anggota Tiket
                    </span>
                    <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-bold h-4">
                        {totalCount}
                    </Badge>
                </div>

                {/* Add Participant Button / Popover */}
                {canAddUsers && !isClosed && (
                    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                        <PopoverTrigger asChild>
                            <button
                                type="button"
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-lg transition-colors cursor-pointer border border-blue-200/60 dark:border-blue-700/50"
                            >
                                <UserPlus className="w-3.5 h-3.5" />
                                <span>+ Tambah</span>
                            </button>
                        </PopoverTrigger>
                        <PopoverContent
                            align="end"
                            sideOffset={8}
                            className="w-80 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 animate-in fade-in zoom-in-95 duration-150"
                        >
                            <div className="space-y-2.5">
                                <div className="flex items-center justify-between pb-1 border-b border-border">
                                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-white">
                                        <UserPlus className="w-4 h-4 text-blue-600" />
                                        <span>Undang User ke Tiket</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setPopoverOpen(false)}
                                        className="p-1 text-muted-foreground hover:text-foreground rounded transition-colors"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </div>

                                {/* Search Input */}
                                <div className="relative">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Cari nama, email, departemen..."
                                        className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-100 dark:bg-slate-800 border-none rounded-lg outline-none text-foreground placeholder:text-muted-foreground"
                                        autoFocus
                                    />
                                </div>

                                {/* Users List */}
                                <div className="max-h-52 overflow-y-auto space-y-1 pr-0.5 custom-scrollbar">
                                    {isLoadingUsers ? (
                                        <div className="py-6 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                                            <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                                            <span>Memuat daftar user...</span>
                                        </div>
                                    ) : filteredUsers.length === 0 ? (
                                        <div className="py-6 text-center text-xs text-muted-foreground">
                                            {searchQuery ? 'Tidak ada user yang cocok' : 'Semua user aktif sudah bergabung'}
                                        </div>
                                    ) : (
                                        filteredUsers.map((u) => {
                                            const isSelected = selectedUserIds.includes(u.id);
                                            return (
                                                <button
                                                    key={u.id}
                                                    type="button"
                                                    onClick={() => toggleSelectUser(u.id)}
                                                    className={cn(
                                                        'w-full flex items-center justify-between p-2 rounded-lg text-left text-xs transition-colors cursor-pointer border',
                                                        isSelected
                                                            ? 'bg-blue-50/80 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-900 dark:text-blue-200'
                                                            : 'bg-card hover:bg-slate-100 dark:hover:bg-slate-800 border-transparent text-foreground'
                                                    )}
                                                >
                                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                                        <UserAvatar
                                                            user={{
                                                                id: u.id,
                                                                fullName: u.fullName,
                                                                avatarUrl: u.avatarUrl,
                                                            }}
                                                            size="xs"
                                                        />
                                                        <div className="min-w-0 flex-1">
                                                            <p className="font-semibold truncate">{u.fullName}</p>
                                                            <p className="text-[10px] text-muted-foreground truncate">
                                                                {u.department?.name || u.email}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div
                                                        className={cn(
                                                            'w-4 h-4 rounded flex items-center justify-center transition-colors ml-2 shrink-0',
                                                            isSelected
                                                                ? 'bg-blue-600 text-white'
                                                                : 'border border-slate-300 dark:border-slate-600'
                                                        )}
                                                    >
                                                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                                                    </div>
                                                </button>
                                            );
                                        })
                                    )}
                                </div>

                                {/* Action Buttons */}
                                <div className="pt-2 border-t border-border flex items-center justify-between gap-2">
                                    <span className="text-[11px] text-muted-foreground font-medium">
                                        {selectedUserIds.length} dipilih
                                    </span>
                                    <div className="flex items-center gap-1.5">
                                        <button
                                            type="button"
                                            onClick={() => setPopoverOpen(false)}
                                            className="px-2.5 py-1 text-xs font-semibold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                        >
                                            Batal
                                        </button>
                                        <button
                                            type="button"
                                            disabled={selectedUserIds.length === 0 || addParticipantsMutation.isPending}
                                            onClick={handleAddSelected}
                                            className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 cursor-pointer"
                                        >
                                            {addParticipantsMutation.isPending ? (
                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            ) : (
                                                <UserPlus className="w-3.5 h-3.5" />
                                            )}
                                            <span>Tambahkan</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>
                )}
            </div>

            {/* Participants List */}
            <div className="space-y-1.5 max-h-60 overflow-y-auto pr-0.5 custom-scrollbar">
                {/* 1. Ticket Creator */}
                <div className="flex items-center justify-between p-2 rounded-lg bg-card border border-slate-200/70 dark:border-slate-700/60 shadow-2xs">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <UserAvatar
                            user={{
                                id: creator.id,
                                fullName: creator.fullName,
                                avatarUrl: creator.avatarUrl,
                            }}
                            size="sm"
                        />
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                                <p className="text-xs font-bold text-foreground truncate">{creator.fullName}</p>
                                <span className="px-1.5 py-0.2 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-[9px] font-bold rounded-full">
                                    Creator
                                </span>
                            </div>
                            <p className="text-[10px] text-muted-foreground truncate">
                                {creator.department?.name || creator.email || 'Requester'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* 2. Joined Participants */}
                {participants.map((p) => {
                    const isRemoving = removingUserId === p.userId && removeParticipantMutation.isPending;
                    const u = p.user;
                    const displayName = u?.fullName || 'User';
                    const deptName = u?.department?.name || u?.email;

                    return (
                        <div
                            key={p.id}
                            className="group flex items-center justify-between p-2 rounded-lg bg-card border border-slate-200/70 dark:border-slate-700/60 shadow-2xs hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
                        >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                <UserAvatar
                                    user={{
                                        id: p.userId,
                                        fullName: displayName,
                                        avatarUrl: u?.avatarUrl,
                                    }}
                                    size="sm"
                                />
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5">
                                        <p className="text-xs font-bold text-foreground truncate">{displayName}</p>
                                        <span className="px-1.5 py-0.2 bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 text-[9px] font-bold rounded-full">
                                            Joined
                                        </span>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground truncate">
                                        {deptName || 'Partisipan'}
                                    </p>
                                </div>
                            </div>

                            {/* Delete Participant Button (Agent Oracle / Admin Only) */}
                            {canManageUsers && !isClosed && (
                                <button
                                    type="button"
                                    onClick={() => removeParticipantMutation.mutate(p.userId)}
                                    disabled={isRemoving}
                                    className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded transition-all cursor-pointer ml-1"
                                    title="Keluarkan dari tiket (Khusus Oracle Agent / Admin)"
                                >
                                    {isRemoving ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin text-red-500" />
                                    ) : (
                                        <Trash2 className="w-3.5 h-3.5" />
                                    )}
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
