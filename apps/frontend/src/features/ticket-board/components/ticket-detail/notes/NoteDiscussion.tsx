import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import TextareaAutosize from 'react-textarea-autosize';
import { ArrowUp, CheckCircle2, ImagePlus, Lock, MessageSquareText, Send, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { dateSeparatorLabel, formatMessageTime, isSameDay, GROUP_WINDOW_MS } from '../messageThread';
import { notePath, type NoteMessage, type NoteUser, type TicketNote } from './types';
import { highlightMentions, MentionPicker, useMentionQuery } from '../MentionPicker';

const MAX_FILES = 5;
const POLL_MS = 5_000;
const IMAGE_ACCEPT = 'image/png,image/jpeg,image/gif,image/webp';

interface Props { note: TicketNote; userId: string; readonly: boolean; refresh: () => unknown }

export function NoteDiscussion({ note, userId, readonly, refresh }: Props) {
    const base = notePath(note.ticketId, note.id);
    const [error, setError] = useState('');
    const [sharing, setSharing] = useState<NoteMessage | null>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const query = useQuery({ queryKey: ['private-note-discussion', userId, note.id], gcTime: 0, retry: false,
        queryFn: async () => (await api.get<{ messages: NoteMessage[]; throughSequence: number }>(`${base}/messages`)).data,
        refetchInterval: POLL_MS });
    const messages = query.data?.messages ?? [];
    const refreshRef = useRef(refresh);
    useEffect(() => { refreshRef.current = refresh; }, [refresh]);
    useEffect(() => {
        if (!query.data?.throughSequence || document.visibilityState !== 'visible') return;
        void api.post(`${base}/read`, { throughSequence: query.data.throughSequence }).then(() => refreshRef.current())
            .catch(() => setError('Status baca belum diperbarui.'));
    }, [base, query.data?.throughSequence]);
    useLayoutEffect(() => {
        const list = listRef.current;
        if (list) list.scrollTop = list.scrollHeight;
    }, [messages.length]);
    const solution = async (id: string | null) => {
        try { await api.put(`${base}/solution`, { messageId: id }); await refresh(); }
        catch { setError('Solusi belum diperbarui. Coba lagi.'); }
    };
    const share = async () => {
        if (!sharing) return;
        try { await api.post(`${base}/public-reply`, { messageId: sharing.id, clientRequestId: crypto.randomUUID() }); setSharing(null); }
        catch { setError('Balasan publik belum dikirim. Periksa hak akses lalu coba lagi.'); setSharing(null); }
    };
    const memberOf = (id: string) => note.members?.find(user => user.id === id);
    return <section className="flex min-h-0 flex-1 flex-col" aria-label="Diskusi ICT">
        <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-3" aria-live="polite">
            {query.error && <p role="alert" className="text-sm text-destructive">Diskusi tidak tersedia. Tutup catatan lalu coba lagi.</p>}
            {query.isLoading && <p role="status" className="py-10 text-center text-sm text-muted-foreground">Memuat diskusi…</p>}
            {!query.isLoading && !query.error && messages.length === 0 && <EmptyDiscussion readonly={readonly} />}
            {messages.map((message, index) => {
                const prev = messages[index - 1];
                const next = messages[index + 1];
                return <Fragment key={message.id}>
                    {(!prev || !isSameDay(prev.createdAt, message.createdAt)) && <div className="chat-day">{dateSeparatorLabel(message.createdAt)}</div>}
                    <NoteBubble base={base} message={message} author={memberOf(message.authorId)} isOwn={message.authorId === userId}
                        isGroupStart={!continues(prev, message)} isGroupEnd={!continues(message, next)}
                        isSolution={note.selectedSolutionMessageId === message.id} readonly={readonly}
                        onSolution={solution} onShare={setSharing} members={note.members ?? []} />
                </Fragment>;
            })}
        </div>
        {error && <p role="alert" className="flex items-center justify-between gap-2 border-t px-4 py-2 text-xs text-destructive">
            {error}<button type="button" aria-label="Tutup pesan" onClick={() => setError('')}><X className="h-3.5 w-3.5" /></button></p>}
        {readonly
            ? <p className="flex items-center gap-2 border-t px-4 py-3 text-xs text-muted-foreground"><Lock className="h-3.5 w-3.5" />Tiket sudah ditutup. Diskusi hanya dapat dibaca.</p>
            : <NoteComposer base={base} userId={userId} members={note.members ?? []} onSent={async () => { await query.refetch(); await refresh(); }} onError={setError} />}
        <ConfirmationDialog isOpen={Boolean(sharing)} variant="warning" title="Kirim ke pemohon?"
            description={`Teks ini akan terlihat oleh pemohon sebagai balasan publik. Gambar privat tidak ikut.\n\n"${sharing?.content ?? ''}"`}
            confirmText="Kirim balasan publik" cancelText="Batal" onConfirm={() => void share()} onCancel={() => setSharing(null)} />
    </section>;
}

function continues(a?: NoteMessage, b?: NoteMessage): boolean {
    if (!a || !b || a.authorId !== b.authorId || !isSameDay(a.createdAt, b.createdAt)) return false;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() <= GROUP_WINDOW_MS;
}

function EmptyDiscussion({ readonly }: { readonly: boolean }) {
    return <div className="flex flex-col items-center py-12 text-center">
        <MessageSquareText className="mb-3 h-8 w-8 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm font-medium">Belum ada diskusi</p>
        {!readonly && <p className="mt-1 max-w-xs text-xs text-muted-foreground">Mulai diskusi dengan anggota. Ketik @ untuk menyebut seseorang.</p>}
    </div>;
}

interface BubbleProps {
    base: string; message: NoteMessage; author?: NoteUser; members: NoteUser[]; isOwn: boolean;
    isGroupStart: boolean; isGroupEnd: boolean; isSolution: boolean; readonly: boolean;
    onSolution: (id: string | null) => void; onShare: (message: NoteMessage) => void;
}

function NoteBubble({ base, message, author, members, isOwn, isGroupStart, isGroupEnd, isSolution, readonly, onSolution, onShare }: BubbleProps) {
    return <div data-direction={isOwn ? 'out' : 'in'} className={cn('chat-msg relative', isOwn && 'is-out', isGroupStart ? 'mt-3.5' : 'mt-1')}>
        <div className="chat-msg-av">{isGroupStart && !isOwn && <UserAvatar user={author} size="xs" className="h-7 w-7 rounded-full text-[10.5px]" />}</div>
        <div className="chat-msg-col">
            {isGroupStart && !isOwn && <div className="chat-who"><b>{author?.fullName ?? 'Anggota ICT'}</b></div>}
            <div className="chat-bubble-wrap">
                {!readonly && !isSolution && <div className="chat-tools z-10 [@media(hover:none)]:pointer-events-auto [@media(hover:none)]:opacity-100" role="toolbar" aria-label="Aksi pesan">
                    <button type="button" aria-label="Jadikan solusi" title="Jadikan solusi" onClick={() => onSolution(message.id)}>
                        <CheckCircle2 aria-hidden="true" /></button>
                </div>}
                <div className={cn('chat-bubble', isOwn ? 'chat-bubble-out' : 'chat-bubble-in', isSolution && 'ring-2 ring-emerald-500/70')}>
                    {isSolution && <p className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />Solusi dipakai</p>}
                    {message.content && <p className="whitespace-pre-wrap">{noteMentions(message.content, members, message.mentionedUserIds)}</p>}
                    {message.attachmentIds.map(id => <PrivateNoteImage key={id} base={base} id={id} />)}
                </div>
            </div>
            {(isGroupEnd || isSolution) && <div className={cn('mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground', isOwn && 'justify-end')}>
                <time dateTime={message.createdAt}>{formatMessageTime(message.createdAt)}</time>
                {!readonly && isSolution && <button type="button" className="font-medium hover:text-foreground hover:underline" onClick={() => onSolution(null)}>Cabut solusi</button>}
                {!readonly && isSolution && <button type="button" className="inline-flex items-center gap-1 font-medium text-primary hover:underline" onClick={() => onShare(message)}>
                    <Send className="h-3 w-3" aria-hidden="true" />Kirim ke pemohon</button>}
            </div>}
        </div>
    </div>;
}

function noteMentions(text: string, members: NoteUser[], mentioned: string[]) {
    return highlightMentions(text, members.filter(user => mentioned.includes(user.id)), (name, key) => <b key={key} className="font-semibold">{name}</b>);
}

interface ComposerProps { base: string; userId: string; members: NoteUser[]; onSent: () => Promise<unknown>; onError: (message: string) => void }

function NoteComposer({ base, userId, members, onSent, onError }: ComposerProps) {
    const [content, setContent] = useState('');
    const [files, setFiles] = useState<File[]>([]);
    const [sending, setSending] = useState(false);
    const [mentions, setMentions] = useState<string[]>([]);
    const [caret, setCaret] = useState(0);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const requestId = useRef(crypto.randomUUID());
    const candidates = members.filter(user => user.id !== userId);
    const mention = useMentionQuery(content, caret, candidates);
    const pick = (user: NoteUser) => {
        const next = mention.replace(user.fullName);
        setContent(next.value);
        setCaret(next.caret);
        setMentions(current => current.includes(user.id) ? current : [...current, user.id]);
        requestAnimationFrame(() => { inputRef.current?.focus(); inputRef.current?.setSelectionRange(next.caret, next.caret); });
    };
    const canSend = !sending && (content.trim().length > 0 || files.length > 0);
    const send = async () => {
        if (!canSend) return;
        setSending(true);
        try {
            const attachmentIds: string[] = [];
            for (const file of files) { const form = new FormData(); form.append('file', file); attachmentIds.push((await api.post(`${base}/attachments`, form)).data.id); }
            const kept = mentions.filter(id => content.includes(`@${members.find(user => user.id === id)?.fullName}`));
            await api.post(`${base}/messages`, { content, mentionedUserIds: kept, attachmentIds, clientRequestId: requestId.current });
            requestId.current = crypto.randomUUID(); setContent(''); setCaret(0); setMentions([]); setFiles([]);
            await onSent();
        } catch { onError('Pesan belum terkirim. Coba lagi; pesan tidak akan digandakan.'); }
        finally { setSending(false); }
    };
    return <div className="chat-composer relative border-t">
        {mention.active && <MentionPicker query={mention.query} users={candidates} onPick={pick} highlight={mention.index} onHighlight={mention.setIndex} />}
        {files.length > 0 && <ul className="flex flex-wrap gap-2" aria-label="Gambar dipilih">{files.map((file, i) => <li key={`${file.name}-${i}`}
            className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs">{file.name}
            <button type="button" aria-label={`Hapus ${file.name}`} onClick={() => setFiles(current => current.filter((_, j) => j !== i))}><X className="h-3 w-3" /></button></li>)}</ul>}
        <div className="chat-compose-row">
            <div className="chat-composer-box">
                <button type="button" className="chat-compose-tool" aria-label="Lampirkan gambar" title="Lampirkan gambar" onClick={() => fileRef.current?.click()}>
                    <ImagePlus aria-hidden="true" /></button>
                <input ref={fileRef} type="file" multiple accept={IMAGE_ACCEPT} className="hidden" aria-label="Gambar diskusi"
                    onChange={e => { setFiles(current => [...current, ...Array.from(e.target.files ?? [])].slice(0, MAX_FILES)); e.target.value = ''; }} />
                <TextareaAutosize ref={inputRef} minRows={1} maxRows={6} value={content} maxLength={10_000}
                    aria-label="Tulis pesan diskusi" placeholder="Tulis pesan… ketik @ untuk menyebut anggota" className="max-h-[140px]"
                    onChange={e => { setContent(e.target.value); setCaret(e.target.selectionStart ?? e.target.value.length); }}
                    onSelect={e => setCaret(e.currentTarget.selectionStart ?? content.length)}
                    onPaste={e => { const pasted = Array.from(e.clipboardData.files).filter(f => f.type.startsWith('image/')); if (pasted.length) { e.preventDefault(); setFiles(current => [...current, ...pasted].slice(0, MAX_FILES)); } }}
                    onKeyDown={e => {
                        if (mention.active && mention.handleKey(e, candidates, pick)) return;
                        if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); }
                    }} />
            </div>
            <button type="button" className="chat-send" aria-label="Kirim pesan" aria-busy={sending} disabled={!canSend} onClick={() => void send()}>
                <ArrowUp aria-hidden="true" /></button>
        </div>
        <p className="text-[11px] text-muted-foreground"><b>Enter</b> kirim · <b>Shift+Enter</b> baris baru · <b>@</b> sebut anggota</p>
    </div>;
}

function PrivateNoteImage({ base, id }: { base: string; id: string }) {
    const [src, setSrc] = useState('');
    const [failed, setFailed] = useState(false);
    useEffect(() => { let url = ''; let active = true;
        void api.get(`${base}/attachments/${id}`, { responseType: 'blob' }).then(response => {
            if (active) { url = URL.createObjectURL(response.data); setSrc(url); }
        }).catch(() => setFailed(true));
        return () => { active = false; if (url) URL.revokeObjectURL(url); };
    }, [base, id]);
    if (failed) return <span className="mt-1 block text-xs opacity-80">Gambar tidak tersedia</span>;
    return src ? <img src={src} alt="Gambar diskusi privat" className="mt-1.5 max-h-60 max-w-full rounded-lg object-contain" />
        : <span className="mt-1.5 block h-24 w-36 animate-pulse rounded-lg bg-black/10" aria-label="Memuat gambar" />;
}
