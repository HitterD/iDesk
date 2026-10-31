import { useState } from 'react';
import { ArrowLeft, AtSign, Check, ChevronRight, LockKeyhole, MessageSquareText, Plus } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useTicketNotes } from './useTicketNotes';
import { NoteWorkspace } from './NoteWorkspace';
import type { NoteUser, TicketNote } from './types';

interface Props { ticketId: string; userId: string; open: boolean; onOpenChange: (open: boolean) => void; initialNoteId?: string }

export function NotesDrawer({ ticketId, userId, open, onOpenChange, initialNoteId }: Props) {
    const { notes, candidates, loading, error, create, refresh } = useTicketNotes(ticketId, userId, open);
    const [selected, setSelected] = useState(initialNoteId ?? '');
    const [creating, setCreating] = useState(false);
    return <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full max-w-none gap-0 overflow-hidden bg-background p-0 text-foreground sm:max-w-xl">
            <SheetHeader className="border-b px-5 pb-3 pr-12 pt-5">
                <SheetTitle className="flex items-center gap-2 text-base"><LockKeyhole className="h-4 w-4 text-amber-600" />Catatan Internal</SheetTitle>
                <SheetDescription className="text-xs">Hanya anggota yang dipilih yang dapat melihat catatan ini.</SheetDescription>
            </SheetHeader>
            {selected
                ? <div className="flex min-h-0 flex-1 flex-col pt-2">
                    <Button variant="ghost" size="sm" onClick={() => setSelected('')} className="mx-2 mb-1 self-start">
                        <ArrowLeft className="mr-2 h-4 w-4" />Semua catatan</Button>
                    <NoteWorkspace ticketId={ticketId} noteId={selected} userId={userId} onDeleted={() => { setSelected(''); void refresh(); }} />
                </div>
                : <div className="min-h-0 flex-1 overflow-y-auto p-4">
                    {creating
                        ? <CreateNoteForm candidates={candidates.filter(user => user.id !== userId)} onCancel={() => setCreating(false)}
                            onCreate={async (title, members) => { const note = await create(title, members); setCreating(false); setSelected(note.id); }} />
                        : <Button onClick={() => setCreating(true)} className="mb-4 w-full"><Plus className="mr-2 h-4 w-4" />Buat catatan baru</Button>}
                    {loading && <p role="status" className="py-6 text-center text-sm text-muted-foreground">Memuat catatan…</p>}
                    {error && <div role="alert" className="py-6 text-center text-sm"><p>Catatan tidak dapat dimuat.</p>
                        <Button variant="outline" size="sm" className="mt-2" onClick={() => void refresh()}>Coba lagi</Button></div>}
                    {!loading && !error && notes.length === 0 && !creating && <div className="py-12 text-center">
                        <MessageSquareText className="mx-auto mb-3 h-8 w-8 text-muted-foreground" aria-hidden="true" />
                        <p className="text-sm font-medium">Belum ada catatan untuk Anda</p>
                        <p className="mx-auto mt-1 max-w-xs text-xs text-muted-foreground">Buat catatan untuk berdiskusi dengan rekan ICT tanpa terlihat oleh pemohon.</p></div>}
                    <ul className="space-y-2">{notes.map(note => <li key={note.id}><NoteCard note={note} onOpen={() => setSelected(note.id)} /></li>)}</ul>
                </div>}
        </SheetContent>
    </Sheet>;
}

function NoteCard({ note, onOpen }: { note: TicketNote; onOpen: () => void }) {
    return <button type="button" onClick={onOpen}
        className="flex w-full items-center gap-3 rounded-xl border bg-card px-3 py-3 text-left transition-colors hover:bg-muted/60 focus-visible:outline focus-visible:outline-2">
        <div className="min-w-0 flex-1">
            <p className={cn('truncate text-sm', note.hasUnread ? 'font-semibold' : 'font-medium')}>{note.title || 'Catatan tanpa judul'}</p>
            <div className="mt-1.5 flex items-center gap-2">
                <div className="flex -space-x-1.5" aria-hidden="true">{(note.members ?? []).slice(0, 4).map(member =>
                    <UserAvatar key={member.id} user={member} size="xs" className="h-5 w-5 rounded-full text-[9px] ring-2 ring-card" />)}</div>
                {note.members && <span className="text-[11px] text-muted-foreground">{note.members.length} anggota</span>}
            </div>
        </div>
        {note.hasMention && <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
            <AtSign className="h-3 w-3" aria-hidden="true" />Anda disebut</span>}
        {note.hasUnread && !note.hasMention && <span className="h-2.5 w-2.5 rounded-full bg-primary" aria-label="Ada pesan belum dibaca" />}
        <ChevronRight className="h-4 w-4 flex-none text-muted-foreground" aria-hidden="true" />
    </button>;
}

interface FormProps { candidates: NoteUser[]; onCancel: () => void; onCreate: (title: string, members: string[]) => Promise<void> }

function CreateNoteForm({ candidates, onCancel, onCreate }: FormProps) {
    const [title, setTitle] = useState('');
    const [members, setMembers] = useState<string[]>([]);
    const [saving, setSaving] = useState(false);
    const toggle = (id: string) => setMembers(current => current.includes(id) ? current.filter(x => x !== id) : [...current, id]);
    const submit = async () => {
        setSaving(true);
        try { await onCreate(title, members); } catch { toast.error('Catatan belum dibuat. Coba lagi.'); } finally { setSaving(false); }
    };
    return <section className="mb-5 space-y-4 rounded-xl border bg-card p-4" aria-label="Buat catatan baru">
        <label className="block text-sm font-medium">Judul catatan
            <Input aria-label="Judul catatan" value={title} maxLength={200} autoFocus placeholder="Contoh: Diagnosis printer lantai 2"
                onChange={e => setTitle(e.target.value)} className="mt-1.5" /></label>
        <fieldset>
            <legend className="text-sm font-medium">Pilih anggota ICT</legend>
            <p className="mb-2 text-xs text-muted-foreground">Anda otomatis ikut. Tanpa anggota lain, catatan menjadi pribadi.</p>
            {candidates.length === 0 && <p className="text-xs text-muted-foreground">Tidak ada staf lain yang menangani tiket ini.</p>}
            <div className="flex max-h-44 flex-wrap gap-2 overflow-y-auto">{candidates.map(user => {
                const on = members.includes(user.id);
                return <label key={user.id} className={cn('inline-flex cursor-pointer items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-sm transition-colors',
                    on ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-muted')}>
                    <input type="checkbox" className="sr-only" checked={on} onChange={() => toggle(user.id)} aria-label={user.fullName} />
                    {on ? <span className="grid h-6 w-6 place-items-center rounded-full bg-primary text-primary-foreground"><Check className="h-3.5 w-3.5" aria-hidden="true" /></span>
                        : <UserAvatar user={user} size="xs" className="h-6 w-6 rounded-full text-[10px]" />}
                    {user.fullName}</label>;
            })}</div>
        </fieldset>
        <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onCancel}>Batal</Button>
            <Button disabled={saving} onClick={() => void submit()}>{saving ? 'Membuat…' : 'Buat catatan'}</Button>
        </div>
    </section>;
}
