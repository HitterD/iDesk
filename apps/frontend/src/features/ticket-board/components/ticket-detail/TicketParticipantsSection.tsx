import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import React, { useState, useMemo } from 'react';
import {
    UserPlus,
    Trash2,
    Loader2,
    X,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { TicketActionDialog } from './TicketActionDialog';
import { toDisplayName } from './messageThread';
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
    const [removeTarget, setRemoveTarget] = useState<{ id: string; name: string } | null>(null);
    const [popoverOpen, setPopoverOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
    const [removingUserId, setRemovingUserId] = useState<string | null>(null);

    // Fetch active users for adding to ticket
    const { data: activeUsers = [], isLoading: isLoadingUsers, isError: usersError, refetch: refetchUsers } = useQuery<ActiveUser[]>({
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
                    toDisplayName(u.fullName || '').toLowerCase().includes(q) ||
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
            setRemoveTarget(null);
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
        const validIds = selectedUserIds.filter(id => availableUsers.some(user => user.id === id));
        if (!canAddUsers || isClosed || addParticipantsMutation.isPending || validIds.length === 0) return;
        addParticipantsMutation.mutate(validIds);
    };

    const totalCount = 1 + participants.length;

    return (
        <section className="ticket-panel">
            {/* Section Header */}
            <div className="td-panel-h mb-2.5 flex items-center gap-2">
                <h3 className="m-0 text-[13px] font-[650]">Anggota tiket</h3>
                <span className="text-[13px] font-medium tabular-nums text-[var(--td-text-3)]">{totalCount}</span>
                <span className="flex-1" />

                {/* Add Participant Button / Popover */}
                {canAddUsers && !isClosed && (
                    <>
                        <Button variant="subtle" className="ticket-action-member" aria-label="Tambah anggota tiket" title="Tambah anggota tiket"
                            onClick={() => { setSearchQuery(''); setSelectedUserIds([]); setPopoverOpen(true); }}>
                            <UserPlus aria-hidden="true" /><span>Tambah</span>
                        </Button>
                        <TicketActionDialog open={popoverOpen} onClose={() => setPopoverOpen(false)} title="Tambah anggota tiket" busy={addParticipantsMutation.isPending}>
                            <form className="ticket-action-inner ticket-action-simple" onSubmit={event => { event.preventDefault(); handleAddSelected(); }}>
                                <header className="ticket-action-header">
                                    <div><h2>Tambah anggota tiket</h2><p>Cari dan pilih anggota untuk bergabung.</p></div>
                                    <Button variant="subtle" type="button" aria-label="Tutup pemilih anggota" disabled={addParticipantsMutation.isPending} onClick={() => setPopoverOpen(false)}><X /></Button>
                                </header>
                                <div className="ticket-action-body">
                                    <input type="search" aria-label="Cari anggota tiket" value={searchQuery} disabled={addParticipantsMutation.isPending}
                                        onChange={event => setSearchQuery(event.target.value)} placeholder="Cari nama, email, departemen…" className="w-full" autoFocus />
                                    {isLoadingUsers ? <p role="status" className="ticket-action-help">Memuat daftar user...</p>
                                        : usersError ? <div role="alert"><p>Daftar anggota gagal dimuat.</p><Button variant="soft" type="button" onClick={() => void refetchUsers()}>Coba lagi</Button></div>
                                        : filteredUsers.length === 0 ? <p className="ticket-action-help">{searchQuery ? 'Tidak ada user yang cocok' : 'Semua user aktif sudah bergabung'}</p>
                                        : <div className="ticket-action-member-list">{filteredUsers.map(user => {
                                            const displayName = toDisplayName(user.fullName);
                                            const duplicate = availableUsers.some(other => other.id !== user.id && toDisplayName(other.fullName) === displayName);
                                            return <label key={user.id} className="ticket-action-member-row">
                                                <UserAvatar user={{ ...user, fullName: displayName }} size="sm" />
                                                <span><b>{displayName}</b><small>{user.department?.name || user.email}{duplicate && user.department?.name ? ` · ${user.email}` : ''}{duplicate ? ` · ${user.id}` : ''}</small></span>
                                                <input type="checkbox" checked={selectedUserIds.includes(user.id)} disabled={addParticipantsMutation.isPending}
                                                    onChange={() => toggleSelectUser(user.id)} />
                                            </label>;
                                        })}</div>}
                                </div>
                                <footer className="ticket-action-footer"><p aria-live="polite">{selectedUserIds.filter(id => availableUsers.some(user => user.id === id)).length} dipilih</p><div>
                                    <Button variant="soft" type="button" onClick={() => setPopoverOpen(false)} disabled={addParticipantsMutation.isPending}>Batal</Button>
                                    <Button variant="primary" className="ticket-action-member" type="submit" disabled={usersError || !selectedUserIds.some(id => availableUsers.some(user => user.id === id)) || addParticipantsMutation.isPending}>
                                        {addParticipantsMutation.isPending && <Loader2 className="animate-spin" />}Tambahkan
                                    </Button>
                                </div></footer>
                            </form>
                        </TicketActionDialog>
                    </>
                )}
            </div>

            {/* Participants List */}
            <div className="td-members max-h-64 overflow-y-auto custom-scrollbar">
                {/* 1. Ticket Creator */}
                <div className="td-person">
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
                                <p className="text-[12.5px] font-[550] text-foreground truncate">{toDisplayName(creator.fullName)}</p>
                            </div>
                            <p className="text-[11px] text-[var(--td-text-3)] truncate">
                                Pembuat tiket{creator.department?.name ? ` Â· ${creator.department.name}` : ''}
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
                            className="td-person group"
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
                                        <p className="text-[12.5px] font-[550] text-foreground truncate">{toDisplayName(displayName)}</p>
                                        <span className="px-1.5 bg-primary/10 text-primary text-[11px] font-medium rounded-full">
                                            Anggota
                                        </span>
                                    </div>
                                    <p className="text-xs text-muted-foreground truncate">
                                        {deptName || 'Partisipan'}
                                    </p>
                                </div>
                            </div>

                            {/* Delete Participant Button (Agent Oracle / Admin Only) */}
                            {canManageUsers && !isClosed && (
                                <button
                                    type="button"
                                    onClick={() => setRemoveTarget({ id: p.userId, name: displayName })}
                                    disabled={isRemoving}
                                    className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded transition-all cursor-pointer ml-1"
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
            <ConfirmationDialog appearance="ticket" isOpen={Boolean(removeTarget)} title="Keluarkan anggota?"
                description={`${removeTarget?.name || 'Anggota'} akan dikeluarkan dari tiket ini.`}
                confirmText="Keluarkan anggota" cancelText="Kembali" variant="destructive"
                isLoading={removeParticipantMutation.isPending}
                onCancel={() => setRemoveTarget(null)}
                onConfirm={() => { if (removeTarget && canManageUsers && !isClosed) removeParticipantMutation.mutate(removeTarget.id); }} />
        </section>
    );
};
