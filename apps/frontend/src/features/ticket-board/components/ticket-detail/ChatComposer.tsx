import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUp, Check, Cpu, Eye, Globe, KeyRound, Loader2, Lock, Paperclip, Pencil, Plus, Reply, Smile, Upload, X } from 'lucide-react';
import { SegmentedControl, type SegmentedOption } from '@/components/ui/segmented-control';
import { toast } from 'sonner';
import TextareaAutosize from 'react-textarea-autosize';
import { CannedResponsePicker, SlashCommandAutocomplete, applyPlaceholders, SavedReply, TicketVariables } from '@/components/ui/CannedResponses';
import { cn } from '@/lib/utils';
import {
    ATTACHMENT_ACCEPT,
    ATTACHMENT_TOTAL_ERROR,
    MAX_ATTACHMENTS_PER_TICKET,
    fitsAttachmentTotal,
    validateAttachmentFile,
} from '@/lib/file-validation';
import { AttachmentTray } from './AttachmentTray';
import { ATTACHMENT_QUOTE, buildQuotedContent, toDisplayName } from './messageThread';

export interface ReplyTarget {
    id: string;
    senderName: string;
    content: string;
}

interface ChatComposerProps {
    inputRef: React.RefObject<HTMLTextAreaElement | null>;
    isStaff: boolean;
    canAddInternalNote: boolean;
    showCannedResponses: boolean;
    ticketVariables: TicketVariables;
    replyTo: ReplyTarget | null;
    onCancelReply: () => void;
    /** Rejects when the message was not sent; the draft is kept for a retry. */
    onSend: (content: string, files: FileList | null, isInternal: boolean, onUploadProgress: (percent: number) => void) => Promise<void>;
    onSendSticker: (sticker: string) => void;
    onTypingStart?: () => void;
    onTypingStop?: () => void;
    /** Shown to ICT on an open IT support ticket: propose a hardware request for the requester to confirm. */
    onProposeHardware?: () => void;
    onProposeEForm?: () => void;
    /** Editing one of the viewer's messages: the box holds its text and Send saves it instead. */
    editing?: { id: string; body: string } | null;
    onCancelEdit?: () => void;
    /** Rejects when the edit was not saved; the draft and the edit mode are kept. */
    onSaveEdit?: (body: string) => Promise<void>;
}

const MAX_MESSAGE_LENGTH = 5000;
/** Counter turns amber / red at these fractions of the limit (same thresholds as before the redesign). */
const COUNTER_WARN_RATIO = 0.7;
const COUNTER_OVER_RATIO = 0.9;
const TYPING_IDLE_MS = 2000;
const SLASH_PATTERN = /(^|\s)\/([a-zA-Z0-9_-]*)$/;

export const STICKERS = [
    '👍', '👎', '✅', '❌', '🔄', '⚠️', '🎉', '🙏',
    '🤔', '💡', '🔧', '💻', '📋', '🚀', '⏳', '🛑',
    '✔️', '📞', '🔍', '📌', '🔒', '🔓', '💬', '🏷️',
    '👆', '👇', '👈', '👉',
];

type PlusMenu = 'closed' | 'menu' | 'stickers';

const createFileList = (files: File[]): FileList => {
    const dt = new DataTransfer();
    files.forEach(f => dt.items.add(f));
    return dt.files;
};

type ComposeMode = 'public' | 'internal';
const MODE_OPTIONS: readonly SegmentedOption<ComposeMode>[] = [
    { value: 'public', label: 'Public Reply', icon: Globe },
    { value: 'internal', label: 'Internal Note', icon: Lock },
];

const PlusMenuPanel: React.FC<{
    view: PlusMenu;
    canAttach: boolean;
    fileCount: number;
    onAttach: () => void;
    onShowStickers: () => void;
    onSticker: (sticker: string) => void;
    onClose: () => void;
    onProposeHardware?: () => void;
    onProposeEForm?: () => void;
}> = ({ view, canAttach, fileCount, onAttach, onShowStickers, onSticker, onClose, onProposeHardware, onProposeEForm }) => {
    if (view === 'stickers') {
        return (
            <div className="td-menu td-sticker-menu" role="dialog" aria-label="Sticker">
                <div className="td-pop-title flex items-center justify-between">
                    <span>Sticker</span>
                    <button type="button" onClick={onClose} aria-label="Tutup" className="chat-ctx-x h-6 w-6"><X aria-hidden="true" /></button>
                </div>
                <div className="td-grid-pop max-h-[220px] overflow-y-auto" style={{ '--cols': 7 } as React.CSSProperties}>
                    {STICKERS.map(sticker => (
                        <button key={sticker} type="button" aria-label={`Sticker ${sticker}`} title={sticker}
                            onClick={() => { onSticker(sticker); onClose(); }}>
                            {sticker}
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="td-menu" role="menu" aria-label="Lampirkan & sticker">
            <p className="td-pop-title">Lampirkan &amp; sticker</p>
            <button type="button" role="menuitem" className="td-menu-item" onClick={onAttach} disabled={!canAttach}>
                <Paperclip aria-hidden="true" />
                <span>Lampirkan file<small>{fileCount}/{MAX_ATTACHMENTS_PER_TICKET} · juga bisa seret atau tempel</small></span>
            </button>
            <button type="button" role="menuitem" className="td-menu-item" onClick={onShowStickers}>
                <Smile aria-hidden="true" />
                <span>Sticker</span>
            </button>
            {onProposeHardware && (
                <button type="button" role="menuitem" className="td-menu-item" onClick={() => { onClose(); onProposeHardware(); }}>
                    <Cpu aria-hidden="true" />
                    <span>Hardware request<small>Usulkan barang, pemohon tinggal konfirmasi</small></span>
                </button>
            )}
            {onProposeEForm && (
                <button type="button" role="menuitem" className="td-menu-item" onClick={() => { onClose(); onProposeEForm(); }}>
                    <KeyRound aria-hidden="true" />
                    <span>Akses E-Form<small>Usulkan akses (VPN, email, …), pemohon tinggal tanda tangan</small></span>
                </button>
            )}
        </div>
    );
};

export const ChatComposer: React.FC<ChatComposerProps> = ({
    inputRef,
    isStaff,
    canAddInternalNote,
    showCannedResponses,
    ticketVariables,
    replyTo,
    onCancelReply,
    onSend,
    onSendSticker,
    onTypingStart,
    onTypingStop,
    onProposeHardware,
    onProposeEForm,
    editing = null,
    onCancelEdit,
    onSaveEdit,
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const dropZoneRef = useRef<HTMLDivElement>(null);
    const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [isInternal, setIsInternal] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    /** Upload percentage while a message is being sent, null when idle. */
    const [sendProgress, setSendProgress] = useState<number | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [messageLength, setMessageLength] = useState(0);
    const [plusMenu, setPlusMenu] = useState<PlusMenu>('closed');
    const [slashQuery, setSlashQuery] = useState('');
    const [isSlashOpen, setIsSlashOpen] = useState(false);

    const isSending = sendProgress !== null;
    const canAttach = !isSending && selectedFiles.length < MAX_ATTACHMENTS_PER_TICKET;
    const placeholderText = isInternal
        ? 'Tulis catatan internal untuk staf…'
        : isStaff
            ? 'Balas ke pemohon…'
            : 'Balas ke IT Support…';

    // Close the plus menu on outside click
    useEffect(() => {
        if (plusMenu === 'closed') return;
        const handler = (e: MouseEvent) => {
            if (!(e.target as Element).closest('[data-plus-menu]')) setPlusMenu('closed');
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [plusMenu]);

    const setInputValue = (value: string) => {
        const input = inputRef.current;
        if (!input) return;
        input.value = value;
        setMessageLength(value.length);
    };

    // Entering edit mode loads the message into the box; leaving it clears the box.
    const editingId = editing?.id;
    useEffect(() => {
        const input = inputRef.current;
        if (!input) return;
        input.value = editing?.body ?? '';
        setMessageLength(input.value.length);
        if (!editing) return undefined;
        // Next frame: the ⋯ menu that started the edit is still closing and would take the focus back.
        const frame = requestAnimationFrame(() => {
            input.focus();
            input.setSelectionRange(input.value.length, input.value.length);
        });
        return () => cancelAnimationFrame(frame);
        // eslint-disable-next-line react-hooks/exhaustive-deps -- reload only when another message is picked
    }, [editingId]);

    const handleSaveEdit = async () => {
        const body = inputRef.current?.value.trim() || '';
        if (!body || !onSaveEdit) return;
        setSendProgress(0);
        try {
            await onSaveEdit(body);
        } catch {
            // The error toast came from the API layer; keep the draft and the edit mode for a retry.
        } finally {
            setSendProgress(null);
        }
    };

    const handleSendMessage = async () => {
        if (isSending) return;
        if (editing) {
            await handleSaveEdit();
            return;
        }
        const rawContent = inputRef.current?.value.trim() || '';
        if (!rawContent && selectedFiles.length === 0) return;

        const content = replyTo && rawContent
            ? buildQuotedContent(replyTo.senderName, replyTo.content || ATTACHMENT_QUOTE, rawContent)
            : rawContent;
        const fileList = selectedFiles.length > 0 ? createFileList(selectedFiles) : null;

        setSendProgress(0);
        try {
            await onSend(content, fileList, isInternal, setSendProgress);
            setInputValue('');
            setSelectedFiles([]);
            onCancelReply();
            onTypingStop?.();
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            if (isInternal) toast.success('Catatan internal ditambahkan');
        } catch {
            // The error toast was already shown by the page; keep the draft so the user can retry.
            return;
        } finally {
            setSendProgress(null);
        }
    };

    const checkSlashCommand = () => {
        const input = inputRef.current;
        if (!input) return;
        const cursor = input.selectionStart || input.value.length;
        const match = input.value.slice(0, cursor).match(SLASH_PATTERN);
        setIsSlashOpen(Boolean(match));
        if (match) setSlashQuery('/' + match[2]);
    };

    const handleInputChange = () => {
        onTypingStart?.();
        setMessageLength(inputRef.current?.value.length || 0);
        checkSlashCommand();
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => onTypingStop?.(), TYPING_IDLE_MS);
    };

    const handleSelectSlashReply = (reply: SavedReply) => {
        const input = inputRef.current;
        if (!input) return;
        const cursor = input.selectionStart || input.value.length;
        const expanded = applyPlaceholders(reply.content, ticketVariables);
        const before = input.value.slice(0, cursor).replace(SLASH_PATTERN, `$1${expanded}`);
        setInputValue(before + input.value.slice(cursor));
        setIsSlashOpen(false);
        setTimeout(() => {
            input.focus();
            input.setSelectionRange(before.length, before.length);
        }, 0);
    };

    /** Queues files that pass the type/size checks, up to the per-message limit; returns how many were queued. */
    const addFiles = (incoming: File[]): number => {
        if (isSending || incoming.length === 0) return 0;
        const accepted = incoming.filter(file => {
            const result = validateAttachmentFile(file);
            if (!result.valid) toast.error(`${file.name}: ${result.error}`);
            return result.valid;
        });
        const room = Math.max(MAX_ATTACHMENTS_PER_TICKET - selectedFiles.length, 0);
        if (accepted.length > room) toast.error(`Maksimal ${MAX_ATTACHMENTS_PER_TICKET} file per pesan`);
        const toAdd = accepted.slice(0, room);
        if (toAdd.length > 0 && !fitsAttachmentTotal([...selectedFiles, ...toAdd])) {
            toast.error(ATTACHMENT_TOTAL_ERROR);
            return 0;
        }
        if (toAdd.length > 0) setSelectedFiles(prev => [...prev, ...toAdd]);
        return toAdd.length;
    };

    // Paste handler — captures screenshots from clipboard
    const handlePaste = (e: React.ClipboardEvent) => {
        const files = Array.from(e.clipboardData.items)
            .filter(item => item.type.startsWith('image/'))
            .map(item => item.getAsFile())
            .filter((f): f is File => f !== null);
        if (files.length === 0) return;
        e.preventDefault();
        const added = addFiles(files);
        if (added > 0) toast.success(`${added} screenshot ditempel`);
    };

    const handleFileSelect = (files: FileList | null) => {
        if (files) addFiles(Array.from(files));
        // Reset so picking the same file again (after removing it) still fires onChange.
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const stop = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); };
    const handleDragEnter = useCallback((e: React.DragEvent) => { stop(e); setIsDragging(true); }, []);
    const handleDragLeave = useCallback((e: React.DragEvent) => {
        stop(e);
        if (!dropZoneRef.current?.contains(e.relatedTarget as Node)) setIsDragging(false);
    }, []);
    const handleDrop = (e: React.DragEvent) => {
        stop(e);
        setIsDragging(false);
        addFiles(Array.from(e.dataTransfer.files));
    };

    const hasContent = messageLength > 0 && Boolean(inputRef.current?.value.trim());
    const canSend = !isSending && (hasContent || (!editing && selectedFiles.length > 0));
    const sendLabel = isSending
        ? (editing ? 'Menyimpan…' : 'Mengirim…')
        : editing ? 'Simpan perubahan' : isInternal ? 'Kirim catatan internal' : 'Kirim';

    return (
        <div
            ref={dropZoneRef}
            className={cn('chat-composer relative z-20 safe-area-pb', isInternal && 'is-internal')}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={stop}
            onDrop={handleDrop}
        >
            {isDragging && (
                <div className="absolute inset-2 z-30 flex items-center justify-center rounded-2xl border-2 border-dashed border-primary/55 bg-primary/10 backdrop-blur-xs">
                    <div className="text-center">
                        <Upload className="mx-auto mb-2 h-7 w-7 text-primary" />
                        <p className="text-sm font-semibold text-primary">Lepaskan file untuk dilampirkan</p>
                        <p className="text-xs text-primary/70">Gambar, video, PDF, Office, TXT/CSV, ZIP/RAR/7Z · maks. {MAX_ATTACHMENTS_PER_TICKET} file, 25MB/file, video 50MB</p>
                    </div>
                </div>
            )}

            {canAddInternalNote && (
                <div className="chat-compose-top">
                    <SegmentedControl
                        options={MODE_OPTIONS}
                        value={isInternal ? 'internal' : 'public'}
                        onValueChange={(mode) => setIsInternal(mode === 'internal')}
                        aria-label="Jenis balasan"
                        className="td-compose-seg"
                    />
                    <span className="chat-compose-note">
                        {isInternal
                            ? <><Lock aria-hidden="true" /><span>Hanya terlihat oleh staf IT</span></>
                            : <><Eye aria-hidden="true" /><span>Terlihat oleh pemohon</span></>}
                    </span>
                </div>
            )}

            {editing && (
                <div className="chat-compose-ctx is-editing">
                    <Pencil aria-hidden="true" />
                    <span className="chat-ctx-t"><b>Mengedit pesan</b></span>
                    <button type="button" onClick={onCancelEdit} className="chat-ctx-x" aria-label="Batalkan edit" title="Batalkan (Esc)">
                        <X aria-hidden="true" />
                    </button>
                </div>
            )}

            {replyTo && !editing && (
                <div className="chat-compose-ctx">
                    <Reply aria-hidden="true" />
                    <span className="chat-ctx-t">
                        <b>Membalas {toDisplayName(replyTo.senderName)}</b> · {replyTo.content || ATTACHMENT_QUOTE}
                    </span>
                    <button type="button" onClick={onCancelReply} className="chat-ctx-x" aria-label="Batalkan balasan" title="Batalkan (Esc)">
                        <X aria-hidden="true" />
                    </button>
                </div>
            )}

            <AttachmentTray files={selectedFiles} onRemove={i => setSelectedFiles(prev => prev.filter((_, idx) => idx !== i))} progress={sendProgress} />

            <div className="chat-compose-row">
                {showCannedResponses && (
                    <SlashCommandAutocomplete
                        query={slashQuery}
                        isOpen={isSlashOpen}
                        onClose={() => setIsSlashOpen(false)}
                        onSelect={handleSelectSlashReply}
                        variables={ticketVariables}
                    />
                )}

                <div className="chat-composer-box">
                    <div className={cn('relative flex-none', editing && 'hidden')} data-plus-menu>
                        <button
                            type="button"
                            onClick={() => setPlusMenu(prev => (prev === 'closed' ? 'menu' : 'closed'))}
                            aria-label="Lampiran & sticker"
                            title="Lampirkan & sticker"
                            aria-expanded={plusMenu !== 'closed'}
                            aria-haspopup="menu"
                            className="chat-compose-tool"
                        >
                            <Plus aria-hidden="true" />
                        </button>
                        {plusMenu !== 'closed' && (
                            <PlusMenuPanel
                                view={plusMenu}
                                canAttach={canAttach}
                                fileCount={selectedFiles.length}
                                onAttach={() => { setPlusMenu('closed'); fileInputRef.current?.click(); }}
                                onShowStickers={() => setPlusMenu('stickers')}
                                onSticker={onSendSticker}
                                onClose={() => setPlusMenu('closed')}
                                onProposeHardware={onProposeHardware}
                                onProposeEForm={onProposeEForm}
                            />
                        )}
                        <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            accept={ATTACHMENT_ACCEPT}
                            className="hidden"
                            onChange={e => handleFileSelect(e.target.files)}
                        />
                    </div>
                    <TextareaAutosize
                        ref={inputRef}
                        minRows={1}
                        maxRows={6}
                        placeholder={placeholderText}
                        aria-label={placeholderText}
                        className="max-h-[140px]"
                        onChange={handleInputChange}
                        onPaste={handlePaste}
                        onKeyDown={async e => {
                            if (e.key === 'Enter' && !e.nativeEvent.isComposing && (e.ctrlKey || e.metaKey || !e.shiftKey)) {
                                e.preventDefault();
                                await handleSendMessage();
                            }
                            if (e.key === 'Escape' && editing) onCancelEdit?.();
                            else if (e.key === 'Escape' && replyTo) onCancelReply();
                        }}
                    />
                    {showCannedResponses && (
                        <CannedResponsePicker
                            compact
                            className="chat-compose-tool"
                            variables={ticketVariables}
                            onSelect={content => {
                                setInputValue(content);
                                inputRef.current?.focus();
                            }}
                        />
                    )}
                </div>

                <button
                    type="button"
                    onClick={handleSendMessage}
                    disabled={!canSend}
                    aria-busy={isSending || undefined}
                    aria-label={sendLabel}
                    title={`${sendLabel} (Enter) · Shift+Enter untuk baris baru`}
                    className="chat-send"
                >
                    {isSending ? <Loader2 className="idesk-spin" aria-hidden="true" /> : editing ? <Check aria-hidden="true" /> : <ArrowUp aria-hidden="true" />}
                </button>
            </div>

            <div className={cn('chat-compose-foot', messageLength === 0 && 'is-idle')}>
                {/* Hidden on touch devices (CSS), where these shortcuts do not apply. */}
                <span className="chat-compose-hint">
                    <kbd>Enter</kbd> kirim · <kbd>Shift+Enter</kbd> baris baru · <kbd>Ctrl+V</kbd> tempel gambar
                </span>
                {messageLength > 0 && (
                    <span className={cn(
                        'chat-compose-count',
                        messageLength > MAX_MESSAGE_LENGTH * COUNTER_OVER_RATIO ? 'is-over'
                            : messageLength > MAX_MESSAGE_LENGTH * COUNTER_WARN_RATIO && 'is-warn',
                    )}>
                        {messageLength.toLocaleString()}/{MAX_MESSAGE_LENGTH.toLocaleString()}
                    </span>
                )}
            </div>
        </div>
    );
};
