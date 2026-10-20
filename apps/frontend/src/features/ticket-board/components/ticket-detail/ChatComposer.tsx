import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUp, Globe, Loader2, Lock, Paperclip, Plus, Smile, Upload, X } from 'lucide-react';
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
import { ReplyPreview } from './QuoteBlock';
import { ATTACHMENT_QUOTE, buildQuotedContent } from './messageThread';

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
}

const MAX_MESSAGE_LENGTH = 5000;
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

const iconButton = 'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-40';

const PlusMenuPanel: React.FC<{
    view: PlusMenu;
    canAttach: boolean;
    onAttach: () => void;
    onShowStickers: () => void;
    onSticker: (sticker: string) => void;
    onClose: () => void;
}> = ({ view, canAttach, onAttach, onShowStickers, onSticker, onClose }) => {
    const panel = 'absolute bottom-full left-0 z-50 mb-2 rounded-2xl border border-slate-200/70 bg-white/95 p-1.5 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-2 duration-150 dark:border-slate-700/70 dark:bg-slate-800/95';
    const item = 'flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700/70 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40';

    if (view === 'stickers') {
        return (
            <div className={cn(panel, 'w-[280px] max-w-[calc(100vw-32px)] p-3 sm:w-[320px]')}>
                <div className="mb-2 flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
                    <span>Sticker</span>
                    <button type="button" onClick={onClose} aria-label="Tutup" className="rounded-full p-1 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer">
                        <X className="h-3.5 w-3.5" />
                    </button>
                </div>
                <div className="grid max-h-[220px] grid-cols-6 gap-1 overflow-y-auto sm:grid-cols-8">
                    {STICKERS.map(sticker => (
                        <button
                            key={sticker}
                            type="button"
                            onClick={() => { onSticker(sticker); onClose(); }}
                            className="mx-auto flex h-9 w-9 select-none items-center justify-center rounded-xl text-xl transition-transform hover:scale-125 hover:bg-slate-100 active:scale-95 dark:hover:bg-slate-700/80 cursor-pointer"
                            title={sticker}
                        >
                            {sticker}
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className={cn(panel, 'w-56')} role="menu">
            <button type="button" role="menuitem" className={item} onClick={onAttach} disabled={!canAttach}>
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary"><Paperclip className="h-4 w-4" /></span>
                Lampirkan file
            </button>
            <button type="button" role="menuitem" className={item} onClick={onShowStickers}>
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500/10 text-amber-600"><Smile className="h-4 w-4" /></span>
                Sticker
            </button>
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
            ? 'Balas ke requester…'
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

    const handleSendMessage = async () => {
        if (isSending) return;
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
            if (isInternal) toast.success('Internal note added');
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

    /** Queues files that pass the type/size checks, up to the per-message limit. */
    const addFiles = (incoming: File[]) => {
        if (isSending || incoming.length === 0) return;
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
            return;
        }
        if (toAdd.length > 0) setSelectedFiles(prev => [...prev, ...toAdd]);
    };

    // Paste handler — captures screenshots from clipboard
    const handlePaste = (e: React.ClipboardEvent) => {
        const files = Array.from(e.clipboardData.items)
            .filter(item => item.type.startsWith('image/'))
            .map(item => item.getAsFile())
            .filter((f): f is File => f !== null);
        if (files.length === 0) return;
        e.preventDefault();
        addFiles(files);
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

    return (
        <div
            ref={dropZoneRef}
            className={cn(
                'chat-composer relative z-20 safe-area-pb',
                isDragging && 'ring-2 ring-inset ring-primary',
            )}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={stop}
            onDrop={handleDrop}
        >
            {isDragging && (
                <div className="absolute inset-0 z-30 flex items-center justify-center rounded-2xl border-2 border-dashed border-primary bg-primary/10 backdrop-blur-xs">
                    <div className="text-center">
                        <Upload className="mx-auto mb-2 h-9 w-9 animate-bounce text-primary" />
                        <p className="text-sm font-semibold text-primary">Lepas file untuk melampirkan</p>
                        <p className="text-xs text-primary/70">Gambar, video, PDF, Office, TXT/CSV, ZIP/RAR/7Z · maks. 25MB/file, video 50MB</p>
                    </div>
                </div>
            )}

            {canAddInternalNote && (
                <div className="mb-2 flex items-center gap-2">
                    <div className="inline-flex rounded-full bg-slate-100 p-0.5 dark:bg-slate-800">
                        {([false, true] as const).map(internal => {
                            const active = isInternal === internal;
                            const Icon = internal ? Lock : Globe;
                            return (
                                <button
                                    key={String(internal)}
                                    type="button"
                                    aria-pressed={active}
                                    onClick={() => setIsInternal(internal)}
                                    className={cn(
                                        'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all cursor-pointer',
                                        active && !internal && 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white',
                                        active && internal && 'bg-amber-500 text-white shadow-sm',
                                        !active && 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300',
                                    )}
                                >
                                    <Icon className="h-3.5 w-3.5" />
                                    {internal ? 'Internal Note' : 'Public Reply'}
                                </button>
                            );
                        })}
                    </div>
                    {isInternal && (
                        <span className="text-xs text-amber-600 animate-in fade-in duration-200 dark:text-amber-400">
                            Hanya terlihat oleh Agent & Admin
                        </span>
                    )}
                </div>
            )}

            {replyTo && (
                <ReplyPreview
                    senderName={replyTo.senderName}
                    content={replyTo.content || ATTACHMENT_QUOTE}
                    onClose={onCancelReply}
                />
            )}

            <AttachmentTray files={selectedFiles} onRemove={i => setSelectedFiles(prev => prev.filter((_, idx) => idx !== i))} progress={sendProgress} />

            <div className="relative flex items-end gap-2">
                {showCannedResponses && (
                    <SlashCommandAutocomplete
                        query={slashQuery}
                        isOpen={isSlashOpen}
                        onClose={() => setIsSlashOpen(false)}
                        onSelect={handleSelectSlashReply}
                        variables={ticketVariables}
                    />
                )}

                <div className="relative mb-1" data-plus-menu>
                    <button
                        type="button"
                        onClick={() => setPlusMenu(prev => (prev === 'closed' ? 'menu' : 'closed'))}
                        aria-label="Lampiran & sticker"
                        aria-expanded={plusMenu !== 'closed'}
                        className={cn(
                            iconButton,
                            plusMenu !== 'closed'
                                ? 'bg-primary/10 text-primary'
                                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-slate-200',
                        )}
                    >
                        <Plus className={cn('h-5 w-5 transition-transform duration-200', plusMenu !== 'closed' && 'rotate-45')} />
                    </button>
                    {plusMenu !== 'closed' && (
                        <PlusMenuPanel
                            view={plusMenu}
                            canAttach={canAttach}
                            onAttach={() => { setPlusMenu('closed'); fileInputRef.current?.click(); }}
                            onShowStickers={() => setPlusMenu('stickers')}
                            onSticker={onSendSticker}
                            onClose={() => setPlusMenu('closed')}
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

                <div className={cn('chat-composer-box flex min-w-0 flex-1 items-end py-1 pl-4 pr-1', isInternal && 'is-internal')}>
                    <TextareaAutosize
                        ref={inputRef}
                        minRows={1}
                        maxRows={6}
                        placeholder={placeholderText}
                        aria-label={placeholderText}
                        className="max-h-40 flex-1 resize-none bg-transparent py-1.5 text-[15px] leading-[1.4] text-slate-900 outline-none placeholder:text-slate-500 dark:text-white dark:placeholder:text-slate-400"
                        onChange={handleInputChange}
                        onPaste={handlePaste}
                        onKeyDown={async e => {
                            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey || !e.shiftKey)) {
                                e.preventDefault();
                                await handleSendMessage();
                            }
                            if (e.key === 'Escape' && replyTo) onCancelReply();
                        }}
                    />
                    {showCannedResponses && (
                        <CannedResponsePicker
                            compact
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
                    disabled={isSending}
                    aria-label={isSending ? 'Mengirim…' : 'Kirim'}
                    title="Kirim (Enter) · Shift+Enter untuk baris baru"
                    className={cn(
                        iconButton,
                        'mb-0.5 h-9 w-9 shadow-sm',
                        isInternal ? 'bg-amber-600 text-white hover:bg-amber-700' : 'chat-send',
                    )}
                >
                    {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-[18px] w-[18px]" strokeWidth={2.5} />}
                </button>
            </div>

            {messageLength > MAX_MESSAGE_LENGTH * 0.7 && (
                <p className={cn(
                    'mt-1 text-right text-[11px] tabular-nums',
                    messageLength > MAX_MESSAGE_LENGTH * 0.9 ? 'font-semibold text-rose-500' : 'text-amber-500',
                )}>
                    {messageLength.toLocaleString()}/{MAX_MESSAGE_LENGTH.toLocaleString()}
                </p>
            )}
        </div>
    );
};
