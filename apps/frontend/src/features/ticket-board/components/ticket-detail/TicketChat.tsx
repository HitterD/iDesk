import React, { useRef, useEffect, useState, useCallback } from 'react';
import { MessageSquare, Wifi, Send, Paperclip, Lock, Globe, X, Upload, FileText, Reply, Smile } from 'lucide-react';
import { toast } from 'sonner';
import TextareaAutosize from 'react-textarea-autosize';
import { TicketDetail } from './types';
import { MessageAttachments } from './MessageAttachments';
import { MessageActionMenu } from './MessageActionMenu';
import { CannedResponsePicker } from '@/components/ui/CannedResponses';
import { MessageReactions } from '@/components/ui/ChatReactions';
import { useAuth } from '@/stores/useAuth';
import { cn } from '@/lib/utils';
import { formatDateTimeID } from '@/lib/utils/dateFormat';
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
    <div className="mb-2 flex items-start gap-2 p-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl border-l-4 border-primary animate-in slide-in-from-bottom-2 duration-200">
        <Reply className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold text-primary">{replyTo.senderName}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{replyTo.content}</p>
        </div>
        <button
            onClick={onClose}
            className="p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors shrink-0"
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
                    className="w-8 h-8 flex items-center justify-center text-xl hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-all duration-200 hover:scale-125 hover:-translate-y-1 active:scale-95 mx-auto"
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
                <p className="text-[11px] font-bold opacity-70">{sender}</p>
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
    const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const dropZoneRef = useRef<HTMLDivElement>(null);
    const messageInputRef = useRef<HTMLTextAreaElement>(null);
    const [isInternal, setIsInternal] = useState(false);
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

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800/60 flex items-center justify-between shrink-0 bg-transparent">
                <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-primary" />
                    <span className="text-xs font-medium text-gray-700 dark:text-slate-400">Chat</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded ${isConnected ? 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30' : 'text-slate-500 bg-slate-200 dark:bg-slate-800'}`}>
                        <Wifi className={`w-3 h-3 ${isConnected ? 'animate-pulse' : ''}`} />
                        {isConnected ? 'Live' : '...'}
                    </div>
                    <span className="text-[10px] text-gray-600 dark:text-slate-500 bg-gray-200 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                        {ticket.messages?.filter(m => !m.isSystemMessage).length || 0}
                    </span>
                </div>
            </div>

            {/* Messages */}
            <div className="p-2 space-y-2 flex-1 overflow-y-auto custom-scrollbar">
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
                            <div key={message.id} className={`flex gap-3 group ${isRequester ? 'flex-row-reverse' : ''}`}>
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${isRequester
                                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                                    : 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]'
                                    }`}>
                                    {message.sender?.fullName?.charAt(0) || '?'}
                                </div>
                                <div className={`max-w-[75%] ${isRequester ? 'text-right' : ''}`}>
                                    <div className="relative">
                                        {isSticker ? (
                                            /* Sticker — no bubble */
                                            <div className={cn(
                                                "text-4xl leading-none select-none p-1",
                                                isRequester ? 'text-right' : 'text-left'
                                            )}>
                                                {message.content}
                                            </div>
                                        ) : (
                                            <div className={cn(
                                                "rounded-2xl p-3 min-w-[120px] shadow-sm",
                                                isRequester
                                                    ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-tr-sm'
                                                    : 'bg-white dark:bg-[hsl(var(--card))] text-slate-800 dark:text-slate-200 rounded-tl-sm border border-[hsl(var(--border))]',
                                                messageIsInternal && 'bg-amber-50 dark:bg-amber-900/10 text-amber-900 dark:text-amber-100 border border-amber-300 dark:border-amber-800/60 rounded-tl-sm rounded-tr-sm'
                                            )}>
                                                {messageIsInternal && (
                                                    <div className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 mb-2 font-medium">
                                                        <Lock className="w-3 h-3" />
                                                        Internal Note
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
                                            className={cn("absolute top-1", isRequester ? 'left-1' : 'right-1')}
                                        />
                                    </div>
                                    <div className={`flex items-center gap-1.5 mt-1 text-xs text-slate-500 dark:text-slate-500 ${isRequester ? 'justify-end' : ''}`}>
                                        <span className="font-medium text-slate-700 dark:text-slate-300 text-[11px]">{message.sender?.fullName}</span>
                                        <span className="text-slate-300 dark:text-slate-700">·</span>
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

                {(!ticket.messages?.some(m => !m.isSystemMessage)) && (
                    <div className="text-center py-16">
                        <div className="w-16 h-16 rounded-full border-2 border-dashed border-slate-200 dark:border-[hsl(var(--border))] bg-slate-50 dark:bg-[hsl(var(--card))] mx-auto mb-4 flex items-center justify-center">
                            <MessageSquare className="w-8 h-8 text-slate-400 dark:text-slate-500" />
                        </div>
                        <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">No messages yet</p>
                        <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">Start the conversation</p>
                    </div>
                )}

                {typingUserNames.length > 0 && (
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 italic px-2">
                        <div className="flex gap-1">
                            <span className="animate-bounce delay-0">.</span>
                            <span className="animate-bounce delay-100">.</span>
                            <span className="animate-bounce delay-200">.</span>
                        </div>
                        {typingUserNames.join(', ')} is typing...
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div
                ref={dropZoneRef}
                className={cn(
                    "sticky bottom-0 p-4 border-t border-[hsl(var(--border))] bg-white dark:bg-transparent z-20",
                    isDragging && "ring-2 ring-primary ring-inset bg-primary/5"
                )}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
            >
                {/* Drag Overlay */}
                {isDragging && (
                    <div className="absolute inset-0 flex items-center justify-center bg-primary/20 backdrop-blur-sm z-30 rounded-lg">
                        <div className="text-center">
                            <Upload className="w-12 h-12 text-primary mx-auto mb-2 animate-bounce" />
                            <p className="text-primary font-bold">Drop files here</p>
                            <p className="text-primary/70 text-sm">Images and Documents supported</p>
                        </div>
                    </div>
                )}

                {/* Internal Note Toggle */}
                {canAddInternalNote && (
                    <div className="flex items-center gap-2 mb-2">
                        <button
                            type="button"
                            onClick={() => setIsInternal(!isInternal)}
                            className={cn(
                                "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors duration-150",
                                isInternal
                                    ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 ring-1 ring-amber-200 dark:ring-amber-800"
                                    : "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600"
                            )}
                        >
                            {isInternal ? <><Lock className="w-3.5 h-3.5" /> Internal Note</> : <><Globe className="w-3.5 h-3.5" /> Public Reply</>}
                        </button>
                        {isInternal && (
                            <span className="text-xs text-amber-600 dark:text-amber-400">Only visible to agents & admins</span>
                        )}
                    </div>
                )}

                {/* Reply Preview */}
                {replyTo && <ReplyPreview replyTo={replyTo} onClose={() => setReplyTo(null)} />}

                {/* File Previews */}
                {selectedFiles.length > 0 && (
                    <div className="mb-3 p-3 bg-slate-100 dark:bg-slate-800 rounded-xl">
                        <div className="flex items-center gap-2 mb-2">
                            <Paperclip className="w-4 h-4 text-primary" />
                            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                                {selectedFiles.length} file(s) attached
                            </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {selectedFiles.map((file, index) => {
                                const isImage = file.type.startsWith('image/');
                                return (
                                    <div key={index} className="relative group bg-white dark:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600 w-16 h-16 flex items-center justify-center">
                                        {isImage ? (
                                            <img src={filePreviews[index] || ''} alt={file.name} className="w-full h-full object-cover rounded-lg" />
                                        ) : (
                                            <FileText className="w-8 h-8 text-slate-400" />
                                        )}
                                        <button
                                            onClick={() => removeFile(index)}
                                            className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                        <div className="absolute -bottom-5 left-0 w-16 text-center">
                                            <p className="text-[9px] text-slate-500 dark:text-slate-400 truncate w-full">{file.name}</p>
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
                        placeholder={isInternal ? "Add internal note… (Ctrl+V to paste screenshot)" : "Type a message… (Ctrl+V to paste screenshot)"}
                        className={cn(
                            "flex-1 px-3 py-2.5 bg-white dark:bg-[hsl(var(--card))] text-sm text-slate-900 dark:text-slate-200 border rounded-xl outline-none placeholder:text-slate-400 dark:placeholder:text-slate-600 transition-colors resize-none",
                            isInternal
                                ? "border-amber-300 dark:border-amber-800"
                                : "border-[hsl(var(--border))] focus:border-primary dark:focus:border-primary/50"
                        )}
                        onChange={handleInputChange}
                        onPaste={handlePaste}
                        onKeyDown={async (e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                await handleSendMessage();
                            }
                            if (e.key === 'Escape' && replyTo) {
                                setReplyTo(null);
                            }
                        }}
                    />
                    <button
                        onClick={handleSendMessage}
                        className={cn(
                            "px-3 py-2.5 rounded-xl transition-colors text-white text-sm font-semibold shadow-sm flex items-center justify-center shrink-0",
                            isInternal
                                ? "bg-amber-600 hover:bg-amber-700"
                                : "bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90"
                        )}
                    >
                        <Send className="w-4 h-4" />
                    </button>
                </div>

                {/* Toolbar Row */}
                <div className="flex items-center gap-2 mt-2 relative">
                    {/* Attach */}
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-1 text-xs text-slate-500 hover:text-primary transition-colors"
                        title="Attach files"
                    >
                        <Paperclip className="w-3.5 h-3.5" />
                        Attach
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept={ACCEPTED_EXTENSIONS}
                        className="hidden"
                        onChange={(e) => handleFileSelect(e.target.files)}
                    />

                    <span className="text-slate-300 dark:text-slate-700 text-xs">·</span>

                    {/* Sticker Picker */}
                    <div className="relative" data-sticker-area>
                        <button
                            onClick={() => setShowStickers(prev => !prev)}
                            className={cn(
                                "flex items-center gap-1 text-xs transition-colors",
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

                    <span className="text-slate-300 dark:text-slate-700 text-xs">·</span>
                    <span className="text-xs text-slate-400">drag & drop or Ctrl+V</span>

                    {/* Character counter */}
                    <span className={cn(
                        "text-xs tabular-nums transition-colors",
                        messageLength > MAX_MESSAGE_LENGTH * 0.9
                            ? "text-red-500 dark:text-red-400 font-medium"
                            : messageLength > MAX_MESSAGE_LENGTH * 0.7
                                ? "text-amber-500 dark:text-amber-400"
                                : "text-slate-400 dark:text-slate-500"
                    )}>
                        {messageLength > 0 && `${messageLength.toLocaleString()}/${MAX_MESSAGE_LENGTH.toLocaleString()}`}
                    </span>

                    <div className="flex-1" />
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
