import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Trash2, UserMinus, UserPlus, Users } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { notePath, type NoteUser, type TicketNote } from './types';

const VISIBLE_AVATARS = 4;
type Pending = { kind: 'remove'; user: NoteUser } | { kind: 'delete' } | null;

interface Props { note: TicketNote; userId: string; readonly: boolean; refresh: () => unknown; onDeleted: () => void }

export function NoteMembers({ note, userId, readonly, refresh, onDeleted }: Props) {
    const [open, setOpen] = useState(false);
    const [pending, setPending] = useState<Pending>(null);
    const members = note.members ?? [];
    const isCreator = note.createdById === userId;
    const candidates = useQuery({ queryKey: ['private-note-candidates', userId, note.ticketId], enabled: open && !readonly,
        queryFn: async () => (await api.get<NoteUser[]>(`${notePath(note.ticketId)}/candidates`)).data, gcTime: 0 });
    const invitable = (candidates.data ?? []).filter(user => !members.some(member => member.id === user.id));
    const act = async (action: () => Promise<unknown>, failure: string) => {
        try { await action(); await refresh(); } catch { toast.error(failure); }
    };
    const confirm = async () => {
        const current = pending;
        setPending(null);
        if (current?.kind === 'remove') await act(() => api.delete(`${notePath(note.ticketId, note.id)}/members/${current.user.id}`), 'Anggota belum dikeluarkan.');
        if (current?.kind === 'delete') await act(async () => { await api.delete(notePath(note.ticketId, note.id)); onDeleted(); }, 'Catatan belum dihapus.');
    };
    return <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
            <div className="flex -space-x-2" aria-hidden="true">{members.slice(0, VISIBLE_AVATARS).map(member =>
                <UserAvatar key={member.id} user={member} size="xs" className="h-7 w-7 rounded-full text-[10.5px] ring-2 ring-background" />)}</div>
            <span className="truncate text-xs text-muted-foreground">{memberSummary(members, userId)}</span>
        </div>
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild><button type="button" className="inline-flex flex-none items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium hover:bg-muted focus-visible:outline focus-visible:outline-2">
                <Users className="h-3.5 w-3.5" aria-hidden="true" />{readonly ? 'Anggota' : 'Kelola'}</button></PopoverTrigger>
            <PopoverContent align="end" className="w-72 p-0">
                <p className="border-b px-3 py-2 text-xs font-semibold">Anggota ({members.length})</p>
                <ul className="max-h-48 overflow-y-auto py-1">{members.map(member => <li key={member.id} className="flex items-center gap-2 px-3 py-1.5 text-sm">
                    <UserAvatar user={member} size="xs" className="h-6 w-6 rounded-full text-[10px]" />
                    <span className="min-w-0 flex-1 truncate">{member.fullName}{member.id === userId && ' (Anda)'}</span>
                    {member.id === note.createdById && <span className="text-[11px] text-muted-foreground">Pembuat</span>}
                    {!readonly && isCreator && member.id !== userId && <button type="button" aria-label={`Keluarkan ${member.fullName}`} title="Keluarkan"
                        className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive" onClick={() => setPending({ kind: 'remove', user: member })}>
                        <UserMinus className="h-3.5 w-3.5" /></button>}
                </li>)}</ul>
                {!readonly && <div className="border-t py-1">
                    <p className="px-3 pt-1.5 text-[11px] font-medium text-muted-foreground">Undang staf yang menangani tiket</p>
                    {candidates.isLoading && <p className="px-3 py-2 text-xs text-muted-foreground">Memuat…</p>}
                    {!candidates.isLoading && invitable.length === 0 && <p className="px-3 py-2 text-xs text-muted-foreground">Semua staf yang bisa diundang sudah menjadi anggota.</p>}
                    <ul className="max-h-40 overflow-y-auto">{invitable.map(user => <li key={user.id}>
                        <button type="button" className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-muted"
                            onClick={() => void act(() => api.post(`${notePath(note.ticketId, note.id)}/members`, { userIds: [user.id] }), 'Anggota belum diundang.')}>
                            <UserAvatar user={user} size="xs" className="h-6 w-6 rounded-full text-[10px]" />
                            <span className="min-w-0 flex-1 truncate">{user.fullName}</span><UserPlus className="h-3.5 w-3.5 text-primary" aria-hidden="true" /></button>
                    </li>)}</ul>
                </div>}
                {!readonly && isCreator && <button type="button" className="flex w-full items-center gap-2 border-t px-3 py-2 text-xs text-destructive hover:bg-destructive/5"
                    onClick={() => setPending({ kind: 'delete' })}><Trash2 className="h-3.5 w-3.5" aria-hidden="true" />Hapus catatan</button>}
            </PopoverContent>
        </Popover>
        <ConfirmationDialog isOpen={Boolean(pending)} variant="destructive"
            title={pending?.kind === 'delete' ? 'Hapus catatan?' : 'Keluarkan anggota?'}
            description={pending?.kind === 'delete' ? 'Catatan, dokumen, dan diskusinya tidak bisa dibuka lagi oleh semua anggota.'
                : `${pending?.kind === 'remove' ? pending.user.fullName : ''} tidak akan bisa melihat catatan ini lagi.`}
            confirmText={pending?.kind === 'delete' ? 'Hapus' : 'Keluarkan'} cancelText="Batal"
            onConfirm={() => void confirm()} onCancel={() => setPending(null)} />
    </div>;
}

function memberSummary(members: NoteUser[], userId: string): string {
    if (members.length <= 1) return 'Hanya Anda (catatan pribadi)';
    const others = members.filter(member => member.id !== userId).map(member => member.fullName);
    return `Anda dan ${others.slice(0, 2).join(', ')}${others.length > 2 ? ` +${others.length - 2} lainnya` : ''}`;
}
