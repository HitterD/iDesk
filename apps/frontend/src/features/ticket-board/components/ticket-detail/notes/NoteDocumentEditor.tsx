import { useEffect, useMemo, useRef, useState } from 'react';
import { EditorContent, useEditor, type JSONContent } from '@tiptap/react';
import { Button } from '@/components/ui/button';
import api from '@/lib/api';
import { notePath, type NoteSession, type TicketNote } from './types';
import { noteEditorExtensions } from './noteEditorExtensions';

const HEARTBEAT_MS = 15_000;
const AUTOSAVE_MS = 1_000;

export function NoteDocumentEditor({ note, readonly }: { note: TicketNote; readonly: boolean }) {
    const base = notePath(note.ticketId, note.id);
    const [session, setSession] = useState<NoteSession | null>(null);
    const [status, setStatus] = useState('');
    const [error, setError] = useState('');
    const [revisions, setRevisions] = useState<{ id: string; document: JSONContent; closedAt: string }[] | null>(null);
    const blocked = useRef(false);
    const version = useRef(note.contentVersion);
    const dirty = useRef(false);
    const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const queue = useRef<Promise<unknown>>(Promise.resolve());
    const liveSession = useRef<NoteSession | null>(null);
    const latestSave = useRef<() => Promise<unknown>>(() => Promise.resolve());
    const extensions = useMemo(() => noteEditorExtensions(note.ticketId, note.id), [note.ticketId, note.id]);
    const editor = useEditor({ extensions, content: note.document, editable: false,
        editorProps: { attributes: { class: 'min-h-36 p-3 outline-none prose prose-sm dark:prose-invert max-w-none', role: 'textbox', 'aria-label': 'Isi dokumen catatan' } },
        onUpdate: () => { if (!liveSession.current) return; dirty.current = true; setStatus('Belum disimpan'); clearTimeout(timer.current);
            timer.current = setTimeout(() => { void save(); }, AUTOSAVE_MS); },
    });
    const save = () => {
        const current = liveSession.current;
        if (!current || !editor || !dirty.current || blocked.current) return queue.current;
        const document = editor.getJSON(); dirty.current = false;
        queue.current = queue.current.then(async () => {
            const response = await api.put(`${base}/document`, { sessionId: current.sessionId, expectedVersion: version.current, document });
            version.current = response.data.contentVersion; setStatus('Tersimpan');
        }).catch(() => { blocked.current = true; dirty.current = true; editor.setEditable(false, false); setError('Sesi edit berubah atau simpan gagal. Salin draft Anda sebelum memuat ulang.'); });
        return queue.current;
    };
    latestSave.current = save;
    useEffect(() => {
        if (!session && editor) editor.commands.setContent(note.document, { emitUpdate: false });
    }, [note.document, editor, session]);
    useEffect(() => {
        if (!session) return;
        const heartbeat = setInterval(() => { void api.post(`${base}/lease/heartbeat`, { sessionId: session.sessionId })
            .catch(() => { blocked.current = true; editor?.setEditable(false, false); setError('Sesi edit berakhir. Draft Anda tetap terlihat; muat ulang sebelum melanjutkan.'); }); }, HEARTBEAT_MS);
        return () => clearInterval(heartbeat);
    }, [base, session, editor]);
    useEffect(() => () => { clearTimeout(timer.current); const current = liveSession.current;
        if (current) void latestSave.current().then(() => {
            if (!dirty.current) return api.post(`${base}/lease/release`, { sessionId: current.sessionId });
        }).catch(() => console.warn('Sesi catatan akan kedaluwarsa otomatis; perubahan terakhir belum terkonfirmasi.'));
    }, [base]);
    useEffect(() => { if (readonly) editor?.setEditable(false, false); }, [readonly, editor]);
    const acquire = async () => {
        try { const { data } = await api.post<NoteSession>(`${base}/lease`); liveSession.current = data; version.current = data.contentVersion;
            editor?.commands.setContent(data.document, { emitUpdate: false }); editor?.setEditable(true, false); setSession(data); setError(''); setStatus('Mengedit');
        } catch { setError('Catatan sedang diedit atau sesi edit belum tersedia. Coba kembali setelah lock berakhir.'); }
    };
    const finish = async () => {
        await save(); if (dirty.current || !session) return;
        try { await api.post(`${base}/lease/release`, { sessionId: session.sessionId }); liveSession.current = null; setSession(null); editor?.setEditable(false, false); setStatus('Tersimpan'); }
        catch { setError('Sesi edit belum dapat ditutup. Coba lagi.'); }
    };
    const upload = async (file?: File) => {
        if (!file || !session) return;
        try { const form = new FormData(); form.append('file', file); const { data } = await api.post(`${base}/attachments`, form);
            editor?.chain().focus().insertContent({ type: 'image', attrs: { attachmentId: data.id } }).run();
        } catch { setError('Gambar belum berhasil diunggah.'); }
    };
    return <section className="space-y-3">
        <div className="flex items-center justify-between gap-2"><h3 className="font-semibold">Dokumen bersama</h3>
            <div className="flex items-center gap-2"><span className="text-xs text-muted-foreground" role="status">{status}</span>
                {!readonly && <Button size="sm" variant="outline" onClick={() => void (session ? finish() : acquire())}>{session ? 'Selesai edit' : 'Edit dokumen'}</Button>}</div></div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {session && !readonly && <div className="flex flex-wrap items-center gap-1" aria-label="Format dokumen">
            {[['Tebal', () => editor?.chain().focus().toggleBold().run()], ['Daftar', () => editor?.chain().focus().toggleBulletList().run()],
                ['Checklist', () => editor?.chain().focus().toggleTaskList().run()], ['Kode', () => editor?.chain().focus().toggleCodeBlock().run()]].map(([label, action]) =>
                <Button key={String(label)} size="sm" variant="ghost" onClick={action as () => void}>{String(label)}</Button>)}
            <label className="cursor-pointer px-2 py-1 text-sm underline">Tambah gambar<input aria-label="Tambah gambar dokumen" type="file" accept="image/png,image/jpeg,image/gif,image/webp" className="sr-only" onChange={e => void upload(e.target.files?.[0])} /></label>
        </div>}
        <div className="rounded-md border bg-background" onPaste={event => { const file = Array.from(event.clipboardData.files).find(item => item.type.startsWith('image/')); if (file && session) { event.preventDefault(); void upload(file); } }}><EditorContent editor={editor} /></div>
        <Button size="sm" variant="ghost" onClick={() => void api.get(`${base}/revisions`).then(response => setRevisions(response.data)).catch(() => setError('Riwayat tidak dapat dimuat.'))}>Riwayat versi</Button>
        {revisions && <ul className="space-y-2 text-sm">{revisions.length === 0 && <li>Belum ada sesi edit yang selesai.</li>}{revisions.map(revision => <li key={revision.id}><button className="underline" onClick={() => { if (!session) editor?.commands.setContent(revision.document, { emitUpdate: false }); }}>{new Date(revision.closedAt).toLocaleString('id-ID')}</button></li>)}</ul>}
    </section>;
}
