import React, { useRef, useEffect, useState, useCallback } from 'react';
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
    Reply,
    Smile,
    Pin,
    ChevronDown,
    Calendar,
    Building,
    Monitor,
    Clock,
    User,
    Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import TextareaAutosize from 'react-textarea-autosize';
import { TicketDetail } from './types';
import { MessageAttachments } from './MessageAttachments';
import { MessageActionMenu } from './MessageActionMenu';
import { CannedResponsePicker } from '@/components/ui/CannedResponses';
import { MessageReactions } from '@/components/ui/ChatReactions';
import { useAuth } from '@/stores/useAuth';
import { cn } from '@/lib/utils';
import { formatDateTimeID, formatRelativeTime } from '@/lib/utils/dateFormat';
import { PDFPreviewModal, usePDFPreview } from '@/features/reports/components/PDFPreviewModal';

interface TicketChatProps {
    ticket: TicketDetail;
    isConnected: boolean;
    onSendMessage: (content: string, files?: FileList | null, isInternal?: boolean) => Promise<void>;
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

const ACCEPTED_FILE_TYPES = [
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/svg+xml',
    'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/plain'
];
const ACCEPTED_EXTENSIONS = '.jpg,.jpeg,.png,.gif,.webp,.bmp,.svg,.pdf,.doc,.docx,.xls,.xlsx,.txt';

const STICKERS = [
    '👍', '👎', '✅', '❌', '🔄', '⚠️', '🎉', '🙏',
    '🤔', '💡', '🔧', '💻', '📋', '🚀', '⏳', '🛑',
    '✔️', '📞', '🔍', '📌', '🔒', '🔓', '💬', '🏷️',
    '👆', '👇', '👈', '👉',
];

const ReplyPreview: React.FC<{ replyTo: ReplyTo; onClose: () => void }> = ({ replyTo, onClose }) => (
    <div className="mb-2 flex items-start gap-2 p-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl border-l-4 border-blue-600 animate-in slide-in-from-bottom-2 duration-200">
        <Reply className="w-3.5 h-3.5 text-blue-600 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-blue-600 dark:text-blue-400">{replyTo.senderName}</p>
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
    <div className="absolute bottom-full mb-2 left-0 w-[280px] sm:w-[320px] bg-white/95 dark:bg-slate-800/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200/60 dark:border-slate-700/60 p-3 z-50 animate-in fade-in slide-in-from-bottom-3 duration-200 origin-bottom-left">
        <div className="grid grid-cols-6 sm:grid-cols-8 gap-2">
            {STICKERS.map((sticker) => (
                <button
                    key={sticker}
                    onClick={() => { onSelect(sticker); onClose(); }}
                    className="w-8 h-8 flex items-center justify-center text-xl hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-all duration-200 hover:scale-125 hover:-translate-y-1 active:scale-95 mx-auto cursor-pointer"
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
    const [filePreviews, setFilePreviews] = useState<string[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [messageLength, setMessageLength] = useState(0);
    const [replyTo, setReplyTo] = useState<ReplyTo | null>(null);
    const [showStickers, setShowStickers] = useState(false);
    const { user } = useAuth();
    const pdfPreview = usePDFPreview();

    const MAX_MESSAGE_LENGTH = 5000;
    const canAddInternalNote = user?.role === 'ADMIN' || user?.role === 'AGENT';

    // Initial Attachments from the report
    const initialAttachments = ticket.messages?.find(
        m => !m.isSystemMessage && m.attachments?.length > 0
    )?.attachments ?? [];

    // ObjectURL cleanup for file previews
    useEffect(() => {
        const urls = selectedFiles.map(file => URL.createObjectURL(file));
        setFilePreviews(urls);
        return () => { urls.forEach(url => URL.revokeObjectURL(url)); };
    }, [selectedFiles]);

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

    const handleSendMessage = async () => {
        const rawContent = messageInputRef.current?.value.trim();
        if (!rawContent && selectedFiles.length === 0) return;

        let content = rawContent || '';
        if (replyTo && content) {
            content = `↩ ${replyTo.senderName}: ${replyTo.content.slice(0, 80)}${replyTo.content.length > 80 ? '…' : ''}\n\n${content}`;
        }

        const fileList = selectedFiles.length > 0 ? createFileList(selectedFiles) : null;
        await onSendMessage(content, fileList, isInternal);

        if (messageInputRef.current) messageInputRef.current.value = '';
        setMessageLength(0);
        setSelectedFiles([]);
        setReplyTo(null);

        if (onTypingStop) onTypingStop();
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

        if (isInternal) toast.success('Internal note added');
    };

    const handleSendSticker = async (sticker: string) => {
        await onSendMessage(sticker, null, false);
    };

    const handleInputChange = () => {
        if (onTypingStart) onTypingStart();
        setMessageLength(messageInputRef.current?.value.length || 0);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
            if (onTypingStop) onTypingStop();
        }, 2000);
    };

    // Paste handler — captures screenshots from clipboard
    const handlePaste = useCallback((e: React.ClipboardEvent) => {
        const items = Array.from(e.clipboardData.items);
        const imageItems = items.filter(item => item.type.startsWith('image/'));
        if (imageItems.length === 0) return;
        e.preventDefault();
        const files = imageItems
            .map(item => item.getAsFile())
            .filter((f): f is File => f !== null);
        if (files.length > 0) {
            setSelectedFiles(prev => [...prev, ...files]);
            toast.success(`${files.length} screenshot${files.length > 1 ? 's' : ''} pasted`);
        }
    }, []);

    const handleFileSelect = (files: FileList | null) => {
        if (!files) return;
        const validFiles: File[] = [];
        const invalidFiles: string[] = [];
        Array.from(files).forEach(file => {
            if (ACCEPTED_FILE_TYPES.includes(file.type) || file.name.match(/\.(pdf|doc|docx|xls|xlsx|txt)$/i)) {
                validFiles.push(file);
            } else {
                invalidFiles.push(file.name);
            }
        });
        if (invalidFiles.length > 0) {
            toast.error(`Invalid file type: ${invalidFiles.join(', ')}`);
        }
        if (validFiles.length > 0) {
            setSelectedFiles(prev => [...prev, ...validFiles]);
        }
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
    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault(); e.stopPropagation(); setIsDragging(false);
        handleFileSelect(e.dataTransfer.files);
    }, []);

    const typingUserNames = Object.values(typingUsers);

    const scrollToRootIssue = () => {
        rootIssueRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    return (
        <div className="flex flex-col h-full overflow-hidden relative">

            {/* ── WhatsApp/Telegram Style Pinned Issue Header Banner ── */}
            <div className="shrink-0 bg-blue-50/90 dark:bg-blue-950/40 border-b border-blue-200/80 dark:border-blue-800/60 px-5 py-2.5 flex items-center justify-between gap-3 shadow-2xs backdrop-blur-md z-10">
                <div
                    onClick={scrollToRootIssue}
                    className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer select-none group"
                    title="Click to jump to initial issue description"
                >
                    <div className="w-8 h-8 rounded-xl bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/20 shadow-2xs">
                        <Pin className="w-4 h-4 fill-blue-600/20" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-blue-950 dark:text-blue-200 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                Pinned: {ticket.title}
                            </span>
                            {initialAttachments.length > 0 && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-md text-[10px] font-bold bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
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
                        className="p-1.5 rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors cursor-pointer"
                        title={isPinnedExpanded ? "Collapse pinned details" : "Expand pinned details"}
                    >
                        <ChevronDown className={cn("w-4 h-4 transition-transform duration-200", isPinnedExpanded && "rotate-180")} />
                    </button>
                </div>
            </div>

            {/* Expanded Pinned Drawer */}
            {isPinnedExpanded && (
                <div className="shrink-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-5 space-y-3 animate-in slide-in-from-top-2 duration-200 shadow-md z-10 max-h-60 overflow-y-auto custom-scrollbar">
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
                                onImageClick={onImageClick}
                                onPdfClick={(url, filename) => pdfPreview.openPreview(url, filename, 'PDF Attachment')}
                                isRequester={false}
                            />
                        </div>
                    )}
                </div>
            )}

            {/* ── Main Messages Stream ── */}
            <div className="p-6 space-y-5 flex-1 overflow-y-auto custom-scrollbar bg-slate-50/30 dark:bg-slate-950/20">

                {/* 🌟 1. ROOT ISSUE CARD (Genesis Message in Conversation) 🌟 */}
                <div ref={rootIssueRef} className="p-5 rounded-2xl bg-white dark:bg-slate-900 border-2 border-blue-200/80 dark:border-blue-900/60 shadow-2xs space-y-3.5">
                    {/* Header */}
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white font-bold flex items-center justify-center text-sm shadow-xs shrink-0">
                                {ticket.user.fullName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                                        {ticket.user.fullName}
                                    </h3>
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                        Ticket Creator
                                    </span>
                                </div>
                                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                                    Submitted {formatDateTimeID(ticket.createdAt)} ({formatRelativeTime(ticket.createdAt)})
                                </p>
                            </div>
                        </div>

                        <span className="text-xs font-bold text-slate-400 dark:text-slate-500 flex items-center gap-1">
                            <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                            Original Issue Report
                        </span>
                    </div>

                    {/* Title & Description */}
                    <div className="space-y-2">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                            {ticket.title}
                        </h4>
                        <div className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800">
                            <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap break-words">
                                {ticket.description || <span className="italic text-slate-400">No additional description provided.</span>}
                            </p>
                        </div>
                    </div>

                    {/* Initial Attachments */}
                    {initialAttachments.length > 0 && (
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80">
                            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
                                Attachments ({initialAttachments.length})
                            </p>
                            <MessageAttachments
                                attachments={initialAttachments}
                                onImageClick={onImageClick}
                                onPdfClick={(url, filename) => pdfPreview.openPreview(url, filename, 'PDF Attachment')}
                                isRequester={false}
                            />
                        </div>
                    )}
                </div>

                {/* 🌟 2. CHAT MESSAGES STREAM 🌟 */}
                {ticket.messages
                    ?.filter(m => !m.isSystemMessage)
                    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
                    .map((message) => {
                        const isRequester = message.sender?.fullName === ticket.user.fullName;
                        const messageIsInternal = message.isInternal;
                        const isOwnMessage = message.sender?.id === user?.id;

                        if (messageIsInternal && !canAddInternalNote) return null;

                        const isSticker = STICKERS.includes(message.content?.trim() || '');

                        return (
                            <div key={message.id} className={cn("flex gap-3 group", isRequester && "flex-row-reverse")}>
                                <div className={cn(
                                    "w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 shadow-2xs",
                                    isRequester
                                        ? "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                                        : messageIsInternal
                                            ? "bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800"
                                            : "bg-blue-600 text-white"
                                )}>
                                    {message.sender?.fullName?.charAt(0)?.toUpperCase() || '?'}
                                </div>
                                <div className={cn("max-w-[80%]", isRequester && "text-right")}>
                                    <div className="relative">
                                        {isSticker ? (
                                            /* Sticker — no bubble */
                                            <div className={cn(
                                                "text-5xl leading-none select-none p-2",
                                                isRequester ? 'text-right' : 'text-left'
                                            )}>
                                                {message.content}
                                            </div>
                                        ) : (
                                            <div className={cn(
                                                "rounded-2xl p-4 min-w-[140px] shadow-2xs text-left",
                                                isRequester
                                                    ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-tr-xs'
                                                    : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-xs border border-slate-200/80 dark:border-slate-700',
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
                                                    onImageClick={onImageClick}
                                                    onPdfClick={(url, filename) => pdfPreview.openPreview(url, filename, 'PDF Attachment')}
                                                    isRequester={isRequester}
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
                                            className={cn("absolute top-1.5", isRequester ? 'left-1.5' : 'right-1.5')}
                                        />
                                    </div>
                                    <div className={cn("flex items-center gap-1.5 mt-1.5 text-xs text-slate-400 dark:text-slate-500", isRequester && "justify-end")}>
                                        <span className="font-semibold text-slate-600 dark:text-slate-300 text-xs">{message.sender?.fullName}</span>
                                        <span>·</span>
                                        <span className="text-[11px]">{formatDateTimeID(message.createdAt)}</span>
                                    </div>
                                    <MessageReactions
                                        reactions={[]}
                                        onAddReaction={(emoji) => toast.info(`Reaction ${emoji} added`)}
                                        onRemoveReaction={(emoji) => toast.info(`Reaction ${emoji} removed`)}
                                        className={isRequester ? 'justify-end' : ''}
                                    />
                                </div>
                            </div>
                        );
                    })}

                {typingUserNames.length > 0 && (
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 italic px-2 py-1 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 w-fit shadow-2xs animate-pulse">
                        <div className="flex gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce delay-0" />
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce delay-100" />
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce delay-200" />
                        </div>
                        <span>{typingUserNames.join(', ')} is typing...</span>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* ── Input Area ── */}
            <div
                ref={dropZoneRef}
                className={cn(
                    "sticky bottom-0 p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-lg z-20",
                    isDragging && "ring-2 ring-blue-500 ring-inset bg-blue-50/20"
                )}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
            >
                {/* Drag Overlay */}
                {isDragging && (
                    <div className="absolute inset-0 flex items-center justify-center bg-blue-600/20 backdrop-blur-xs z-30 rounded-2xl border-2 border-dashed border-blue-500">
                        <div className="text-center">
                            <Upload className="w-10 h-10 text-blue-600 mx-auto mb-2 animate-bounce" />
                            <p className="text-blue-700 font-bold text-sm">Drop files here to attach</p>
                            <p className="text-blue-600/70 text-xs">Images and Documents supported</p>
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
                                        ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-2xs"
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

                {/* File Previews */}
                {selectedFiles.length > 0 && (
                    <div className="mb-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center gap-2 mb-2">
                            <Paperclip className="w-4 h-4 text-blue-600" />
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                {selectedFiles.length} file(s) attached
                            </span>
                        </div>
                        <div className="flex flex-wrap gap-2.5">
                            {selectedFiles.map((file, index) => {
                                const isImage = file.type.startsWith('image/');
                                return (
                                    <div key={index} className="relative group bg-white dark:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-600 w-16 h-16 flex items-center justify-center shadow-2xs">
                                        {isImage ? (
                                            <img src={filePreviews[index] || ''} alt={file.name} className="w-full h-full object-cover rounded-xl" />
                                        ) : (
                                            <FileText className="w-7 h-7 text-slate-400" />
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => removeFile(index)}
                                            className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-rose-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md cursor-pointer"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                        <div className="absolute -bottom-5 left-0 w-16 text-center">
                                            <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate w-full">{file.name}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Textarea + Send */}
                <div className="flex gap-2 items-end">
                    <TextareaAutosize
                        ref={messageInputRef}
                        minRows={1}
                        maxRows={6}
                        placeholder={isInternal ? "Write an internal note for staff… (Ctrl+V to paste screenshot)" : "Type your reply to user… (Ctrl+V to paste screenshot)"}
                        className={cn(
                            "flex-1 px-4 py-2.5 text-sm text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800/80 border rounded-2xl outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-all resize-none shadow-2xs",
                            isInternal
                                ? "border-amber-300 dark:border-amber-700 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                                : "border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
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
                        className={cn(
                            "px-4 py-2.5 rounded-2xl transition-all text-white text-sm font-bold shadow-xs flex items-center justify-center shrink-0 cursor-pointer h-[42px]",
                            isInternal
                                ? "bg-amber-600 hover:bg-amber-700"
                                : "bg-blue-600 hover:bg-blue-700"
                        )}
                    >
                        <Send className="w-4 h-4" />
                    </button>
                </div>

                {/* Toolbar Row */}
                <div className="flex items-center gap-3 mt-2.5 relative">
                    {/* Attach */}
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
                        title="Attach files"
                    >
                        <Paperclip className="w-3.5 h-3.5" />
                        Attach Files
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept={ACCEPTED_EXTENSIONS}
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
                                showStickers ? "text-blue-600" : "text-slate-500 hover:text-blue-600 dark:hover:text-blue-400"
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

                    <span className="text-slate-300 dark:text-slate-700">·</span>
                    <span className="text-xs text-slate-400 hidden sm:inline">Ctrl+Enter to send · Ctrl+V to paste</span>

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

                    {showCannedResponses !== false && (
                        <CannedResponsePicker
                            onSelect={(content) => {
                                if (messageInputRef.current) {
                                    messageInputRef.current.value = content;
                                    setMessageLength(content.length);
                                    messageInputRef.current.focus();
                                }
                            }}
                        />
                    )}
                </div>
            </div>

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
