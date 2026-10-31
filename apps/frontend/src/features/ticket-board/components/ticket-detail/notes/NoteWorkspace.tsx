import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, MessageSquareText } from 'lucide-react';
import api from '@/lib/api';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { notePath, type TicketNote } from './types';
import { NoteDocumentEditor } from './NoteDocumentEditor';
import { NoteDiscussion } from './NoteDiscussion';
import { NoteMembers } from './NoteMembers';

type Tab = 'chat' | 'doc';
const TABS = [
    { value: 'chat', label: 'Diskusi', icon: MessageSquareText },
    { value: 'doc', label: 'Dokumen', icon: FileText },
] as const;

export function NoteWorkspace({ ticketId, noteId, userId, onDeleted }: { ticketId: string; noteId: string; userId: string; onDeleted: () => void }) {
    const client = useQueryClient();
    const [tab, setTab] = useState<Tab>('chat');
    const key = ['private-ticket-note', userId, ticketId, noteId];
    const query = useQuery({ queryKey: key, queryFn: async () => (await api.get<TicketNote>(notePath(ticketId, noteId))).data,
        refetchInterval: 10_000, retry: false, gcTime: 0 });
    const refresh = () => client.invalidateQueries({ queryKey: key });
    if (query.error) return <p role="alert" className="p-5 text-sm">Catatan tidak tersedia atau akses Anda telah berubah. Kembali ke daftar catatan.</p>;
    if (!query.data) return <p role="status" className="p-5 text-sm text-muted-foreground">Memuat catatan…</p>;
    const note = query.data;
    const readonly = ['CLOSED', 'CANCELLED'].includes(note.ticketStatus ?? '');
    return <div className="flex min-h-0 flex-1 flex-col">
        <div className="space-y-3 border-b px-4 pb-3">
            <h2 className="text-base font-semibold break-words">{note.title || 'Catatan tanpa judul'}</h2>
            <NoteMembers note={note} userId={userId} readonly={readonly} refresh={refresh} onDeleted={onDeleted} />
            <SegmentedControl options={TABS} value={tab} onValueChange={setTab} aria-label="Bagian catatan" />
        </div>
        {tab === 'chat'
            ? <NoteDiscussion note={note} userId={userId} readonly={readonly} refresh={refresh} />
            : <div className="min-h-0 flex-1 overflow-y-auto p-4"><NoteDocumentEditor key={note.id} note={note} readonly={readonly} /></div>}
    </div>;
}
