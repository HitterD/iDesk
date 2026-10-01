import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import {
    MessageSquare,
    Wifi,
    Send,
    Paperclip,
    Lock,
    Globe,
    X,
    Upload,
    FileText,
    Loader2,
    Reply,
    Smile,
    Pin,
    ChevronDown,
    Calendar,
    Building,
    Monitor,
    Clock,
    User,
    Users,
} from 'lucide-react';
import { toast } from 'sonner';
import TextareaAutosize from 'react-textarea-autosize';
import { TicketDetail } from './types';
import { CLOSED_TICKET_NOTICE } from './constants';
import { MessageAttachments } from './MessageAttachments';
import { AttachmentTray } from './AttachmentTray';
import { MessageActionMenu } from './MessageActionMenu';
import { CannedResponsePicker, SlashCommandAutocomplete, applyPlaceholders, SavedReply } from '@/components/ui/CannedResponses';
import { MessageReactions } from '@/components/ui/ChatReactions';
import { SystemMessageEvent } from './SystemMessageEvent';
import { useAuth } from '@/stores/useAuth';
import { cn } from '@/lib/utils';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { formatDateTimeID, formatRelativeTime } from '@/lib/utils/dateFormat';
import { PDFPreviewModal, usePDFPreview } from '@/features/reports/components/PDFPreviewModal';
import { ATTACHMENT_ACCEPT, MAX_ATTACHMENTS_PER_TICKET, validateAttachmentFile } from '@/lib/file-validation';

interface TicketChatProps {
    ticket: TicketDetail;
    isConnected: boolean;
    /** Rejects when the message was not sent; the draft is kept for a retry. */
    onSendMessage: (
        content: string,
        files?: FileList | null,
        isInternal?: boolean,
        onUploadProgress?: (percent: number) => void,
    ) => Promise<void>;
    onImageClick: (url: string) => void;
    typingUsers?: { [key: string]: string };
    onTypingStart?: () => void;
    onTypingStop?: () => void;
    showCannedResponses?: boolean;
}

interface ReplyTo {
    id: string;
    senderName: string;
    content: string;
}

const STICKERS = [
    '👍', '👎', '✅', '❌', '🔄', '⚠️', '🎉', '🙏',
    '🤔', '💡', '🔧', '💻', '📋', '🚀', '⏳', '🛑',
    '✔️', '📞', '🔍', '📌', '🔒', '🔓', '💬', '🏷️',
    '👆', '👇', '👈', '👉',
];

const ReplyPreview: React.FC<{ replyTo: ReplyTo; onClose: () => void }> = ({ replyTo, onClose }) => (
    <div className="mb-2 flex items-start gap-2 p-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl border-l-4 border-primary animate-in slide-in-from-bottom-2 duration-200">
        <Reply className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-primary">{replyTo.senderName}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{replyTo.content}</p>
        </div>
        <button
            onClick={onClose}
            className="p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors shrink-0 cursor-pointer"
        >
            <X className="w-3.5 h-3.5 text-slate-400" />
        </button>
    </div>
);

const StickerPicker: React.FC<{ onSelect: (sticker: string) => void; onClose: () => void }> = ({ onSelect, onClose }) => (
    <div className="absolute bottom-full mb-2 left-0 w-[280px] sm:w-[320px] max-w-[calc(100vw-32px)] bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200/80 dark:border-slate-700/80 p-3 z-50 animate-in fade-in slide-in-from-bottom-2 duration-150 origin-bottom-left">
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-slate-700/60 text-xs font-bold text-slate-600 dark:text-slate-300">
            <span>Sticker &amp; Emoji Reaksi</span>
            <button
                type="button"
                onClick={onClose}
                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg transition-colors cursor-pointer"
                title="Tutup"
            >
                <X className="w-3.5 h-3.5" />
            </button>
        </div>
        <div className="grid grid-cols-6 sm:grid-cols-8 gap-1.5 max-h-[220px] overflow-y-auto pr-1">
            {STICKERS.map((sticker) => (
                <button
                    key={sticker}
                    type="button"
                    onClick={() => { onSelect(sticker); onClose(); }}
                    className="w-8 h-8 flex items-center justify-center text-xl hover:bg-slate-100 dark:hover:bg-slate-700/80 rounded-xl transition-all duration-150 hover:scale-125 hover:-translate-y-0.5 active:scale-95 mx-auto cursor-pointer select-none"
                    title={sticker}
                >
                    {sticker}
                </button>
            ))}
        </div>
    </div>
);

const QuoteBlock: React.FC<{ text: string }> = ({ text }) => {
    const match = text.match(/^↩ (.+?): (.+?)\n\n([\s\S]*)$/);
    if (!match) return <p className="text-sm whitespace-pre-wrap leading-relaxed">{text}</p>;
    const [, sender, quote, rest] = match;
    return (
        <div>
            <div className="mb-2 p-2 rounded-lg bg-black/10 dark:bg-white/10 border-l-4 border-current/30">
                <p className="text-xs font-bold opacity-70">{sender}</p>
                <p className="text-xs opacity-60 truncate">{quote}</p>
            </div>
            {rest && <p className="text-sm whitespace-pre-wrap leading-relaxed">{rest}</p>}
        </div>
    );
};

export const TicketChat: React.FC<TicketChatProps> = ({
    ticket,
    isConnected,
    onSendMessage,
    onImageClick,
    typingUsers = {},
    onTypingStart,
    onTypingStop,
    showCannedResponses
}) => {
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const rootIssueRef = useRef<HTMLDivElement>(null);
    const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const dropZoneRef = useRef<HTMLDivElement>(null);
    const messageInputRef = useRef<HTMLTextAreaElement>(null);
    const [isInternal, setIsInternal] = useState(false);
    const [isPinnedExpanded, setIsPinnedExpanded] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    /** Upload percentage while a message is being sent, null when idle. */
    const [sendProgress, setSendProgress] = useState<number | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [messageLength, setMessageLength] = useState(0);
    const [replyTo, setReplyTo] = useState<ReplyTo | null>(null);
    const [showStickers, setShowStickers] = useState(false);
    const [messageReactions, setMessageReactions] = useState<Record<string, Array<{ emoji: string; count: number; users: string[]; hasReacted: boolean }>>>({});
    const [slashQuery, setSlashQuery] = useState('');
    const [isSlashOpen, setIsSlashOpen] = useState(false);
    const { user } = useAuth();
    const pdfPreview = usePDFPreview();
    const isTicketClosed = ticket.status === 'CLOSED';

    const handleAddReaction = useCallback((messageId: string, emoji: string) => {
        const currentUserName = user?.fullName || 'User';
        setMessageReactions(prev => {
            const list = prev[messageId] || [];
            const existing = list.find(r => r.emoji === emoji);
            if (existing) {
                if (existing.hasReacted) return prev;
                return {
                    ...prev,
                    [messageId]: list.map(r => r.emoji === emoji ? {
                        ...r,
                        count: r.count + 1,
                        users: [...r.users, currentUserName],
                        hasReacted: true,
                    } : r)
                };
            }
            return {
                ...prev,
                [messageId]: [...list, { emoji, count: 1, users: [currentUserName], hasReacted: true }]
            };
        });
    }, [user?.fullName]);

    const handleRemoveReaction = useCallback((messageId: string, emoji: string) => {
        const currentUserName = user?.fullName || 'User';
        setMessageReactions(prev => {
            const list = prev[messageId] || [];
            return {
                ...prev,
                [messageId]: list.map(r => {
                    if (r.emoji === emoji) {
                        return {
                            ...r,
                            count: Math.max(0, r.count - 1),
                            users: r.users.filter(u => u !== currentUserName),
                            hasReacted: false,
                        };
                    }
                    return r;
                }).filter(r => r.count > 0)
            };
        });
    }, [user?.fullName]);

    const ticketVariables = useMemo(() => ({
        user_name: (ticket as any).requester?.fullName || (ticket as any).customerSession?.fullName || ticket.user?.fullName || 'Customer',
        agent_name: user?.fullName || 'Agent',
        ticket_id: ticket.ticketNumber || ticket.id?.slice(0, 8) || '',
        category: ticket.category || '',
    }), [ticket, user]);

    const MAX_MESSAGE_LENGTH = 5000;
    const isStaff = Boolean(user?.role && user.role !== 'USER');
    const canAddInternalNote = user?.role === 'ADMIN' || user?.role === 'AGENT';
    const placeholderText = isInternal
        ? "Write an internal note for staff…"
        : isStaff
            ? "Type your reply to requester…"
            : "Type your reply to IT Support…";

    // Initial Attachments from the report
    const initialMessage = ticket.messages?.find(
        m => !m.isSystemMessage && m.attachments?.length > 0
    );
    const initialAttachments = initialMessage?.attachments ?? [];

    // Identify the initial ticket creation message that is already displayed in Root Issue Card
    const genesisMessageId = useMemo(() => {
        if (!ticket.messages || ticket.messages.length === 0 || !ticket.description) return null;
        const sorted = [...ticket.messages].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        const first = sorted[0];
        if (
            first &&
            first.content?.trim() === ticket.description?.trim() &&
            (!first.sender?.id || first.sender?.id === ticket.user?.id)
        ) {
            return first.id;
        }
        return null;
    }, [ticket.messages, ticket.description, ticket.user?.id]);

    // Auto-scroll on new messages
    useEffect(() => {
        if (ticket?.messages) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [ticket?.messages, typingUsers]);

    // Close sticker picker on outside click
    useEffect(() => {
        if (!showStickers) return;
        const handler = (e: MouseEvent) => {
            const target = e.target as Element;
            if (!target.closest('[data-sticker-area]')) setShowStickers(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showStickers]);

    const createFileList = (files: File[]): FileList => {
        const dt = new DataTransfer();
        files.forEach(f => dt.items.add(f));
        return dt.files;
    };

    const isSending = sendProgress !== null;

    const handleSendMessage = async () => {
        if (isSending) return;
        const rawContent = messageInputRef.current?.value.trim();
        if (!rawContent && selectedFiles.length === 0) return;

        let content = rawContent || '';
        if (replyTo && content) {
            content = `↩ ${replyTo.senderName}: ${replyTo.content.slice(0, 80)}${replyTo.content.length > 80 ? '…' : ''}\n\n${content}`;
        }

        const fileList = selectedFiles.length > 0 ? createFileList(selectedFiles) : null;

        setSendProgress(0);
        try {
            await onSendMessage(content, fileList, isInternal, setSendProgress);

            if (messageInputRef.current) messageInputRef.current.value = '';
            setMessageLength(0);
            setSelectedFiles([]);
            setReplyTo(null);

            if (onTypingStop) onTypingStop();
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

            if (isInternal) toast.success('Internal note added');
        } catch {
            // Swallow the rejection here to prevent unhandled promise rejection.
            // The error toast was already shown by BentoTicketDetailPage.
            // Do not clear the draft (content/files/replyTo) so the user can retry.
            return;
        } finally {
            setSendProgress(null);
        }
    };

    const handleSendSticker = async (sticker: string) => {
        await onSendMessage(sticker, null, false);
    };

    const checkSlashCommand = () => {
        const input = messageInputRef.current;
        if (!input) return;
        const text = input.value;
        const cursor = input.selectionStart || text.length;
        const textBeforeCursor = text.slice(0, cursor);

        const match = textBeforeCursor.match(/(^|\s)\/([a-zA-Z0-9_-]*)$/);
        if (match) {
            setSlashQuery('/' + match[2]);
            setIsSlashOpen(true);
        } else {
            setIsSlashOpen(false);
        }
    };

    const handleInputChange = () => {
        if (onTypingStart) onTypingStart();
        setMessageLength(messageInputRef.current?.value.length || 0);
        checkSlashCommand();
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
            if (onTypingStop) onTypingStop();
        }, 2000);
    };

    const handleSelectSlashReply = (reply: SavedReply) => {
        const input = messageInputRef.current;
        if (!input) return;
        const text = input.value;
        const cursor = input.selectionStart || text.length;
        const textBeforeCursor = text.slice(0, cursor);
        const textAfterCursor = text.slice(cursor);

        const expandedContent = applyPlaceholders(reply.content, ticketVariables);
        const newTextBefore = textBeforeCursor.replace(/(^|\s)\/([a-zA-Z0-9_-]*)$/, `$1${expandedContent}`);
        const newFullText = newTextBefore + textAfterCursor;

        input.value = newFullText;
        setMessageLength(newFullText.length);
        setIsSlashOpen(false);

        setTimeout(() => {
            input.focus();
            const newPos = newTextBefore.length;
            input.setSelectionRange(newPos, newPos);
        }, 0);
    };

    // Paste handler — captures screenshots from clipboard
    const handlePaste = (e: React.ClipboardEvent) => {
        const items = Array.from(e.clipboardData.items);
        const imageItems = items.filter(item => item.type.startsWith('image/'));
        if (imageItems.length === 0) return;
        e.preventDefault();
        const files = imageItems
            .map(item => item.getAsFile())
            .filter((f): f is File => f !== null);
        addFiles(files);
    };

    /** Queues files that pass the type/size checks, up to the per-message limit. */
    const addFiles = (incoming: File[]) => {
        if (isSending || incoming.length === 0) return;
        const accepted: File[] = [];
        for (const file of incoming) {
            const result = validateAttachmentFile(file);
            if (result.valid) {
                accepted.push(file);
            } else {
                toast.error(`${file.name}: ${result.error}`);
            }
        }
        const room = Math.max(MAX_ATTACHMENTS_PER_TICKET - selectedFiles.length, 0);
        if (accepted.length > room) {
            toast.error(`Maksimal ${MAX_ATTACHMENTS_PER_TICKET} file per pesan`);
        }
        const toAdd = accepted.slice(0, room);
        if (toAdd.length > 0) setSelectedFiles(prev => [...prev, ...toAdd]);
    };

    const handleFileSelect = (files: FileList | null) => {
        if (files) addFiles(Array.from(files));
        // Reset so picking the same file again (after removing it) still fires onChange.
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const removeFile = (index: number) => {
        setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleDragEnter = useCallback((e: React.DragEvent) => {
        e.preventDefault(); e.stopPropagation(); setIsDragging(true);
    }, []);
    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault(); e.stopPropagation();
        if (!dropZoneRef.current?.contains(e.relatedTarget as Node)) setIsDragging(false);
    }, []);
    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault(); e.stopPropagation();
    }, []);
    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault(); e.stopPropagation(); setIsDragging(false);
        addFiles(Array.from(e.dataTransfer.files));
    };

    const typingUserNames = Object.values(typingUsers);

    const scrollToRootIssue = () => {
        rootIssueRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    return (
        <div className="flex flex-col h-full overflow-hidden relative">

            {/* ── Chat-app Style Pinned Issue Header Banner (Hidden on mobile for cleaner view) ── */}
            <div className="hidden sm:flex shrink-0 bg-primary/5 dark:bg-primary/10 border-b border-primary/20 dark:border-primary/30 px-5 py-2.5 items-center justify-between gap-3 shadow-2xs backdrop-blur-md z-10">
                <div
                    onClick={scrollToRootIssue}
                    className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer select-none group"
                    title="Click to jump to initial issue description"
                >
                    <div className="w-8 h-8 rounded-xl bg-primary/10 dark:bg-primary/20 text-primary flex items-center justify-center shrink-0 border border-primary/20 shadow-2xs">
                        <Pin className="w-4 h-4 fill-primary/20 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-foreground truncate group-hover:text-primary transition-colors">
                                Pinned: {ticket.title}
                            </span>
                            {initialAttachments.length > 0 && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-md text-[10px] font-bold bg-primary/10 dark:bg-primary/20 text-primary border border-primary/20 dark:border-primary/30">
                                    <Paperclip className="w-2.5 h-2.5" />
                                    {initialAttachments.length}
                                </span>
                            )}
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-slate-400 truncate">
                            {ticket.description || 'No description provided'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    {/* Live connection badge */}
                    <div className={cn(
                        "flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-lg border",
                        isConnected
                            ? "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/50"
                            : "text-slate-500 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                    )}>
                        <Wifi className={cn("w-3 h-3", isConnected && "animate-pulse")} />
                        <span>{isConnected ? 'Live' : 'Offline'}</span>
                    </div>

                    <button
                        type="button"
                        onClick={() => setIsPinnedExpanded(prev => !prev)}
                        className="p-1.5 rounded-lg text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                        title={isPinnedExpanded ? "Collapse pinned details" : "Expand pinned details"}
                    >
                        <ChevronDown className={cn("w-4 h-4 transition-transform duration-200", isPinnedExpanded && "rotate-180")} />
                    </button>
                </div>
            </div>

            {/* Expanded Pinned Drawer */}
            {isPinnedExpanded && (
                <div className="hidden sm:block shrink-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-5 space-y-3 animate-in slide-in-from-top-2 duration-200 shadow-md z-10 max-h-60 overflow-y-auto custom-scrollbar">
                    <div className="flex items-center justify-between text-xs text-slate-500 pb-2 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-2">
                            <span>Reported by <strong className="text-slate-900 dark:text-white">{ticket.user.fullName}</strong></span>
                            <span>•</span>
                            <span>{formatDateTimeID(ticket.createdAt)} ({formatRelativeTime(ticket.createdAt)})</span>
                        </div>
                        {ticket.device && (
                            <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md text-[11px] font-mono text-slate-700 dark:text-slate-300">
                                {ticket.device}
                            </span>
                        )}
                    </div>
                    <div className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700">
                        {ticket.description || <span className="italic text-slate-400">No description provided</span>}
                    </div>
                    {initialAttachments.length > 0 && (
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Initial Attachments ({initialAttachments.length})</p>
                            <MessageAttachments
                                attachments={initialAttachments}
                                attachmentInfo={initialMessage?.attachmentInfo}
                                onImageClick={onImageClick}
                                onPdfClick={(url, filename) => pdfPreview.openPreview(url, filename, 'PDF Attachment')}
                                isRequester={false}
                            />
                        </div>
                    )}
                </div>
            )}

            {/* ── Main Messages Stream ── */}
            <div className="p-3 sm:p-6 space-y-4 sm:space-y-5 flex-1 overflow-y-auto custom-scrollbar bg-slate-100/60 dark:bg-[#090d16]">

                {/* 🌟 1. ROOT ISSUE CARD (Genesis Message in Conversation) 🌟 */}
                <div ref={rootIssueRef} className="p-3.5 sm:p-5 rounded-xl sm:rounded-2xl bg-white dark:bg-slate-800/95 border border-primary/20 dark:border-primary/30 shadow-xs space-y-2.5 sm:space-y-3.5">
                    {/* Header */}
                    <div className="flex items-center justify-between pb-2.5 sm:pb-3 border-b border-slate-100 dark:border-slate-700/60">
                        <div className="flex items-center gap-2.5 sm:gap-3">
                            <UserAvatar user={ticket.user} size="sm" className="sm:w-10 sm:h-10 rounded-lg sm:rounded-xl shadow-xs" />
                            <div>
                                <div className="flex items-center gap-2">
                                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                                        {ticket.user.fullName}
                                    </h3>
                                    <span className="px-1.5 sm:px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold bg-primary/10 dark:bg-primary/20 text-primary border border-primary/20 dark:border-primary/30">
                                        Ticket Creator
                                    </span>
                                </div>
                                <p className="text-[11px] sm:text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                                    Submitted {formatDateTimeID(ticket.createdAt)} ({formatRelativeTime(ticket.createdAt)})
                                </p>
                            </div>
                        </div>

                        <span className="text-[11px] sm:text-xs font-bold text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-primary" strokeWidth={1.75} />
                            Original Issue Report
                        </span>
                    </div>

                    {/* Title & Description */}
                    <div className="space-y-1.5 sm:space-y-2">
                        <h4 className="hidden sm:block text-sm font-bold text-slate-900 dark:text-white">
                            {ticket.title}
                        </h4>
                        <div className="p-3 sm:p-3.5 rounded-xl bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-700/60">
                            <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap break-words">
                                {ticket.description || <span className="italic text-slate-400">No additional description provided.</span>}
                            </p>
                        </div>
                    </div>

                    {/* Initial Attachments */}
                    {initialAttachments.length > 0 && (
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60">
                            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
                                Attachments ({initialAttachments.length})
                            </p>
                            <MessageAttachments
                                attachments={initialAttachments}
                                attachmentInfo={initialMessage?.attachmentInfo}
                                onImageClick={onImageClick}
                                onPdfClick={(url, filename) => pdfPreview.openPreview(url, filename, 'PDF Attachment')}
                                isRequester={false}
                            />
                        </div>
                    )}
                </div>

                {/* 🌟 2. CHAT MESSAGES STREAM 🌟 */}
                {ticket.messages
                    ?.slice()
                    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
                    .map((message) => {
                        // Skip genesis message since it is already rendered in Root Issue Card
                        if (genesisMessageId && message.id === genesisMessageId) {
                            return null;
                        }

                        const isResolutionStatement =
                            message.content?.includes('Tiket Dinyatakan Selesai') ||
                            message.content?.includes('Tiket Diselesaikan (Resolved)');

                        // System notification message or resolution statement card
                        if (message.isSystemMessage || isResolutionStatement) {
                            return (
                                <SystemMessageEvent
                                    key={message.id}
                                    content={message.content}
                                    createdAt={message.createdAt}
                                    attachments={message.attachments}
                                    onImageClick={onImageClick}
                                />
                            );
                        }

                        const isOwnMessage = Boolean(
                            (message.sender?.id && user?.id && message.sender.id === user.id) ||
                            (user?.fullName && message.sender?.fullName === user.fullName)
                        );
                        const messageIsInternal = message.isInternal;

                        if (messageIsInternal && !canAddInternalNote) return null;

                        const isSticker = STICKERS.includes(message.content?.trim() || '');

                        return (
                            <div key={message.id} className={cn("flex gap-3 group", isOwnMessage && "flex-row-reverse")}>
                                <UserAvatar
                                    user={message.sender}
                                    size="sm"
                                    className={cn("w-9 h-9 rounded-xl shadow-2xs", messageIsInternal && "ring-2 ring-amber-300 dark:ring-amber-800")}
                                />
                                <div className={cn("max-w-[88%] sm:max-w-[80%]", isOwnMessage && "text-right")}>
                                    <div className="relative">
                                        {isSticker ? (
                                            /* Sticker — no bubble */
                                            <div className={cn(
                                                "text-5xl leading-none select-none p-2",
                                                isOwnMessage ? 'text-right' : 'text-left'
                                            )}>
                                                {message.content}
                                            </div>
                                        ) : (
                                            <div className={cn(
                                                "rounded-2xl p-3 sm:p-4 min-w-[120px] shadow-2xs text-left",
                                                isOwnMessage
                                                    ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-tr-xs'
                                                    : 'bg-white dark:bg-slate-800/95 text-slate-800 dark:text-slate-100 rounded-tl-xs border border-slate-200/80 dark:border-slate-700/70',
                                                messageIsInternal && 'bg-amber-50/90 dark:bg-amber-950/40 text-amber-950 dark:text-amber-100 border border-amber-300/80 dark:border-amber-800/80 rounded-tl-xs rounded-tr-xs'
                                            )}>
                                                {messageIsInternal && (
                                                    <div className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400 mb-2 font-bold uppercase tracking-wider">
                                                        <Lock className="w-3.5 h-3.5" />
                                                        Internal Staff Note
                                                    </div>
                                                )}
                                                {message.content && !message.content.match(/^\[?(📷\s*)?\[?Photo\]?\]?$/i) && (
                                                    <QuoteBlock text={message.content} />
                                                )}
                                                <MessageAttachments
                                                    attachments={message.attachments}
                                                    attachmentInfo={message.attachmentInfo}
                                                    onImageClick={onImageClick}
                                                    onPdfClick={(url, filename) => pdfPreview.openPreview(url, filename, 'PDF Attachment')}
                                                    isRequester={isOwnMessage}
                                                />
                                            </div>
                                        )}
                                        <MessageActionMenu
                                            messageId={message.id}
                                            messageContent={message.content || ''}
                                            isOwn={isOwnMessage}
                                            isInternal={messageIsInternal || false}
                                            onReply={(content) => {
                                                setReplyTo({
                                                    id: message.id,
                                                    senderName: message.sender?.fullName || 'Unknown',
                                                    content,
                                                });
                                                messageInputRef.current?.focus();
                                            }}
                                            className={cn("absolute top-1.5", isOwnMessage ? 'left-1.5' : 'right-1.5')}
                                        />
                                    </div>
                                    <div className={cn("flex items-center gap-1.5 mt-1.5 text-xs text-slate-400 dark:text-slate-500", isOwnMessage && "justify-end")}>
                                        <span className="font-semibold text-slate-600 dark:text-slate-300 text-xs">{message.sender?.fullName}</span>
                                        <span>·</span>
                                        <span className="text-[11px]">{formatDateTimeID(message.createdAt)}</span>
                                    </div>
                                    <MessageReactions
                                        reactions={messageReactions[message.id] || []}
                                        onAddReaction={(emoji) => handleAddReaction(message.id, emoji)}
                                        onRemoveReaction={(emoji) => handleRemoveReaction(message.id, emoji)}
                                        align={isOwnMessage ? 'right' : 'left'}
                                        className={isOwnMessage ? 'justify-end' : ''}
                                    />
                                </div>
                            </div>
                        );
                    })}

                {typingUserNames.length > 0 && (
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 italic px-2 py-1 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 w-fit shadow-2xs animate-pulse">
                        <div className="flex gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce delay-0" />
                            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce delay-100" />
                            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce delay-200" />
                        </div>
                        <span>{typingUserNames.join(', ')} is typing...</span>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* ── Input Area ── */}
            {isTicketClosed ? (
                <div
                    role="status"
                    className="sticky bottom-0 p-3 sm:p-4 border-t border-slate-200/90 dark:border-slate-800 bg-slate-50/95 dark:bg-slate-900/95 z-20 safe-area-pb flex items-center justify-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400"
                >
                    <Lock className="w-3.5 h-3.5 shrink-0" />
                    <span>{CLOSED_TICKET_NOTICE}</span>
                </div>
            ) : (
            <div
                ref={dropZoneRef}
                className={cn(
                    "sticky bottom-0 p-2.5 sm:p-4 border-t border-slate-200/90 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-lg z-20 safe-area-pb pb-3 sm:pb-4",
                    isDragging && "ring-2 ring-primary ring-inset bg-primary/5"
                )}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
            >
                {/* Drag Overlay */}
                {isDragging && (
                    <div className="absolute inset-0 flex items-center justify-center bg-primary/20 backdrop-blur-xs z-30 rounded-2xl border-2 border-dashed border-primary">
                        <div className="text-center">
                            <Upload className="w-10 h-10 text-primary mx-auto mb-2 animate-bounce" />
                            <p className="text-primary font-bold text-sm">Drop files here to attach</p>
                            <p className="text-primary/70 text-xs">Gambar, PDF, Office, TXT/CSV, ZIP/RAR/7Z · maks. 25MB/file</p>
                        </div>
                    </div>
                )}

                {/* Internal Note Segmented Bar */}
                {canAddInternalNote && (
                    <div className="flex items-center gap-2 mb-2.5">
                        <div className="inline-flex p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                            <button
                                type="button"
                                onClick={() => setIsInternal(false)}
                                className={cn(
                                    "flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer",
                                    !isInternal
                                        ? "bg-white dark:bg-slate-700 text-primary shadow-2xs"
                                        : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
                                )}
                            >
                                <Globe className="w-3.5 h-3.5" />
                                Public Reply
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsInternal(true)}
                                className={cn(
                                    "flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer",
                                    isInternal
                                        ? "bg-amber-500 text-white shadow-2xs"
                                        : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
                                )}
                            >
                                <Lock className="w-3.5 h-3.5" />
                                Internal Note
                            </button>
                        </div>

                        {isInternal && (
                            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1 animate-in fade-in duration-200">
                                Visible only to Agents & Admins
                            </span>
                        )}
                    </div>
                )}

                {/* Reply Preview */}
                {replyTo && <ReplyPreview replyTo={replyTo} onClose={() => setReplyTo(null)} />}

                {/* Queued attachments */}
                <AttachmentTray files={selectedFiles} onRemove={removeFile} progress={sendProgress} />

                {/* Textarea + Send */}
                <div className="relative flex gap-2 items-end">
                    {showCannedResponses !== false && (
                        <SlashCommandAutocomplete
                            query={slashQuery}
                            isOpen={isSlashOpen}
                            onClose={() => setIsSlashOpen(false)}
                            onSelect={handleSelectSlashReply}
                            variables={ticketVariables}
                        />
                    )}
                    <TextareaAutosize
                        ref={messageInputRef}
                        minRows={1}
                        maxRows={6}
                        placeholder={placeholderText}
                        className={cn(
                            "flex-1 px-4 py-2.5 text-sm text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800/80 border rounded-2xl outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-all resize-none shadow-2xs",
                            isInternal
                                ? "border-amber-300 dark:border-amber-700 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                                : "border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        )}
                        onChange={handleInputChange}
                        onPaste={handlePaste}
                        onKeyDown={async (e) => {
                            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey || !e.shiftKey)) {
                                e.preventDefault();
                                await handleSendMessage();
                            }
                            if (e.key === 'Escape' && replyTo) {
                                setReplyTo(null);
                            }
                        }}
                    />
                    <button
                        type="button"
                        onClick={handleSendMessage}
                        disabled={isSending}
                        aria-label={isSending ? 'Mengirim…' : 'Kirim'}
                        className={cn(
                            "px-4 py-2.5 rounded-2xl transition-all text-primary-foreground text-sm font-bold shadow-xs flex items-center justify-center shrink-0 cursor-pointer h-[42px] disabled:opacity-60 disabled:cursor-not-allowed",
                            isInternal
                                ? "bg-amber-600 hover:bg-amber-700"
                                : "bg-primary hover:bg-primary/90"
                        )}
                    >
                        {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </button>
                </div>

                {/* Toolbar Row */}
                <div className="flex items-center gap-3 mt-2.5 relative">
                    {/* Attach */}
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isSending || selectedFiles.length >= MAX_ATTACHMENTS_PER_TICKET}
                        className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-primary transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        title={`Lampirkan file (maks. ${MAX_ATTACHMENTS_PER_TICKET} file, 25MB/file)`}
                    >
                        <Paperclip className="w-3.5 h-3.5" />
                        Attach Files
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept={ATTACHMENT_ACCEPT}
                        className="hidden"
                        onChange={(e) => handleFileSelect(e.target.files)}
                    />

                    <span className="text-slate-300 dark:text-slate-700">·</span>

                    {/* Sticker Picker */}
                    <div className="relative" data-sticker-area>
                        <button
                            type="button"
                            onClick={() => setShowStickers(prev => !prev)}
                            className={cn(
                                "flex items-center gap-1.5 text-xs font-semibold transition-colors cursor-pointer",
                                showStickers ? "text-primary" : "text-slate-500 hover:text-primary"
                            )}
                            title="Stickers"
                        >
                            <Smile className="w-3.5 h-3.5" />
                            Sticker
                        </button>
                        {showStickers && (
                            <StickerPicker
                                onSelect={handleSendSticker}
                                onClose={() => setShowStickers(false)}
                            />
                        )}
                    </div>

                    {showCannedResponses !== false && (
                        <>
                            <span className="text-slate-300 dark:text-slate-700">·</span>
                            <CannedResponsePicker
                                variables={ticketVariables}
                                onSelect={(content) => {
                                    if (messageInputRef.current) {
                                        messageInputRef.current.value = content;
                                        setMessageLength(content.length);
                                        messageInputRef.current.focus();
                                    }
                                }}
                            />
                        </>
                    )}

                    <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">·</span>
                    <span className="text-xs text-slate-400 hidden sm:inline">Enter to send · Shift+Enter for new line</span>

                    {/* Character counter */}
                    <span className={cn(
                        "text-xs tabular-nums ml-auto transition-colors",
                        messageLength > MAX_MESSAGE_LENGTH * 0.9
                            ? "text-rose-500 font-bold"
                            : messageLength > MAX_MESSAGE_LENGTH * 0.7
                                ? "text-amber-500"
                                : "text-slate-400"
                    )}>
                        {messageLength > 0 && `${messageLength.toLocaleString()}/${MAX_MESSAGE_LENGTH.toLocaleString()}`}
                    </span>
                </div>
            </div>
            )}

            <PDFPreviewModal
                isOpen={pdfPreview.isOpen}
                onClose={pdfPreview.closePreview}
                pdfUrl={pdfPreview.previewConfig?.url || ''}
                filename={pdfPreview.previewConfig?.filename || ''}
                title={pdfPreview.previewConfig?.title || ''}
            />
        </div>
    );
};
