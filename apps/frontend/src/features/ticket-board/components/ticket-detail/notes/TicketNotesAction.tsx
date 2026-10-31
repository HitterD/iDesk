import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LockKeyhole } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTicketNotes } from './useTicketNotes';
import { NotesDrawer } from './NotesDrawer';

export function TicketNotesAction({ ticketId, userId }: { ticketId: string; userId: string }) {
    const [params, setParams] = useSearchParams();
    const initialNoteId = params.get('noteId') ?? undefined;
    const [open, setOpen] = useState(Boolean(initialNoteId));
    useEffect(() => { if (initialNoteId) setOpen(true); }, [initialNoteId]);
    const { notes } = useTicketNotes(ticketId, userId);
    const unread = notes.some(note => note.hasUnread);
    return <>
        <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="gap-2">
            <LockKeyhole className="h-4 w-4" />Catatan Internal ({notes.length})
            {unread && <span className="h-2 w-2 rounded-full bg-amber-600" aria-label="Ada diskusi belum dibaca" />}
        </Button>
        {open && <NotesDrawer ticketId={ticketId} userId={userId} open onOpenChange={value => {
            setOpen(value); if (!value && initialNoteId) { const next = new URLSearchParams(params); next.delete('noteId'); setParams(next, { replace: true }); }
        }} initialNoteId={initialNoteId} />}
    </>;
}
