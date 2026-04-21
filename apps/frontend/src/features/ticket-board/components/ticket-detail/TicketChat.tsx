import React, { useRef, useEffect, useState, useCallback } from 'react';
import { MessageSquare, Wifi, Send, Paperclip, Lock, Globe, X, Image, Upload, FileText } from 'lucide-react';
import { toast } from 'sonner';
import TextareaAutosize from 'react-textarea-autosize';
import { TicketDetail } from './types';
import { MessageAttachments } from './MessageAttachments';
import { MessageActionMenu } from './MessageActionMenu';
import { CannedResponsePicker } from '@/components/ui/CannedResponses';
import { MessageReactions } from '@/components/ui/ChatReactions';
import { useAuth } from '@/stores/useAuth';
import { cn } from '@/lib/utils';
import { formatDateTime } from '@/lib/utils/dateFormat';
import { PDFPreviewModal, usePDFPreview } from '@/features/reports/components/PDFPreviewModal';

interface TicketChatProps {
    ticket: TicketDetail;
    isConnected: boolean;
    onSendMessage: (content: string, files?: FileList | null, isInternal?: boolean) => Promise<void>;
    onImageClick: (url: string) => void;
    typingUsers?: { [key: string]: string };
    onTypingStart?: () => void;
    onTypingStop?: () => void;
}

// Supported image and document formats
const ACCEPTED_FILE_TYPES = [
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/svg+xml',
    'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/plain'
];
const ACCEPTED_EXTENSIONS = '.jpg,.jpeg,.png,.gif,.webp,.bmp,.svg,.pdf,.doc,.docx,.xls,.xlsx,.txt';

export const TicketChat: React.FC<TicketChatProps> = ({
    ticket,
    isConnected,
    onSendMessage,
    onImageClick,
    typingUsers = {},
    onTypingStart,
    onTypingStop
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
    const { user } = useAuth();
    const pdfPreview = usePDFPreview();

    // Character limit constant
    const MAX_MESSAGE_LENGTH = 5000;

    // Create and cleanup ObjectURLs for file previews
    useEffect(() => {
        // Create new preview URLs
        const urls = selectedFiles.map(file => URL.createObjectURL(file));
        setFilePreviews(urls);

        // Cleanup function to revoke URLs when files change or component unmounts
        return () => {
            urls.forEach(url => URL.revokeObjectURL(url));
        };
    }, [selectedFiles]);

    // Only show internal note toggle for agents/admins
    const canAddInternalNote = user?.role === 'ADMIN' || user?.role === 'AGENT';

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        if (ticket?.messages) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [ticket?.messages, typingUsers]);

    // Convert File[] to FileList-like object for onSendMessage
    const createFileList = (files: File[]): FileList => {
        const dataTransfer = new DataTransfer();
        files.forEach(file => dataTransfer.items.add(file));
        return dataTransfer.files;
    };

    const handleSendMessage = async () => {
        const content = messageInputRef.current?.value.trim();

        if (content || selectedFiles.length > 0) {
            const fileList = selectedFiles.length > 0 ? createFileList(selectedFiles) : null;
            await onSendMessage(content || '', fileList, isInternal);
            if (messageInputRef.current) messageInputRef.current.value = '';
            setSelectedFiles([]);

            // Stop typing immediately after sending
            if (onTypingStop) onTypingStop();
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

            // Show feedback for internal notes
            if (isInternal) {
                toast.success('Internal note added');
            }
        }
    };

    const handleInputChange = () => {
        if (onTypingStart) onTypingStart();

        // Track message length for character counter
        setMessageLength(messageInputRef.current?.value.length || 0);

        // Debounce stop typing
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
            if (onTypingStop) onTypingStop();
        }, 2000);
    };

    // Handle file selection
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
            toast.error(`Invalid file type: ${invalidFiles.join(', ')}. Only images and documents are allowed.`);
        }

        if (validFiles.length > 0) {
            setSelectedFiles(prev => [...prev, ...validFiles]);
            toast.success(`${validFiles.length} file(s) added`);
        }
    };

    const removeFile = (index: number) => {
        setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    };

    // Drag and drop handlers
    const handleDragEnter = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        // Only set dragging false if leaving the drop zone entirely
        if (!dropZoneRef.current?.contains(e.relatedTarget as Node)) {
            setIsDragging(false);
        }
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        handleFileSelect(e.dataTransfer.files);
    }, []);

    const typingUserNames = Object.values(typingUsers);

    return (
        <div className="flex flex-col h-full">
            {/* Compact header */}
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

            <div className="p-2 space-y-2 flex-1 overflow-y-auto custom-scrollbar">
                {ticket.messages
                    ?.filter(m => !m.isSystemMessage)
                    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
                    .map((message) => {
                        const isRequester = message.sender?.fullName === ticket.user.fullName;
                        const messageIsInternal = message.isInternal;
                        const isOwnMessage = message.sender?.id === user?.id;

                        // Don't show internal notes to regular users
                        if (messageIsInternal && !canAddInternalNote) {
                            return null;
                        }

                        return (
                            <div key={message.id} className={`flex gap-3 group ${isRequester ? 'flex-row-reverse' : ''}`}>
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 ${isRequester
                                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                                    : 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]'
                                    }`}>
                                    {message.sender?.fullName?.charAt(0) || '?'}
                                </div>
                                <div className={`max-w-[75%] ${isRequester ? 'text-right' : ''}`}>
                                    <div className="relative">
                                        <div className={cn(
                                            "rounded-2xl p-4 min-w-[120px] shadow-sm",
                                            isRequester
                                                ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-tr-sm'
                                                : 'bg-white dark:bg-[hsl(var(--card))] text-slate-800 dark:text-slate-200 rounded-tl-sm border border-[hsl(var(--border))]',
                                            // Internal note styling
                                            messageIsInternal && 'bg-amber-50 dark:bg-amber-900/10 text-amber-900 dark:text-amber-100 border border-amber-300 dark:border-amber-800/60 rounded-tl-sm rounded-tr-sm'
                                        )}>
                                            {/* Internal Note Badge */}
                                            {messageIsInternal && (
                                                <div className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 mb-2 font-medium">
                                                    <Lock className="w-3 h-3" />
                                                    Internal Note
                                                </div>
                                            )}
                                            {/* Hide [Photo] placeholder if attachments exist */}
                                            {message.content && !message.content.match(/^\[?(📷\s*)?\[?Photo\]?\]?$/i) && (
                                                <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
                                            )}
                                            {/* Attachment Preview */}
                                            <MessageAttachments
                                                attachments={message.attachments}
                                                onImageClick={onImageClick}
                                                onPdfClick={(url, filename) => pdfPreview.openPreview(url, filename, 'PDF Attachment')}
                                                isRequester={isRequester}
                                            />
                                        </div>
                                        {/* Message Action Menu */}
                                        <MessageActionMenu
                                            messageId={message.id}
                                            messageContent={message.content || ''}
                                            isOwn={isOwnMessage}
                                            isInternal={messageIsInternal || false}
                                            onReply={(content) => {
                                                if (messageInputRef.current) {
                                                    messageInputRef.current.value = `> ${content}\n\n`;
                                                    messageInputRef.current.focus();
                                                }
                                            }}
                                            className={cn("absolute top-2", isRequester ? 'left-2' : 'right-2')}
                                        />
                                    </div>
                                    <div className={`flex items-center gap-2 mt-1.5 text-xs text-slate-500 dark:text-slate-500 ${isRequester ? 'justify-end' : ''}`}>
                                        <span className="font-medium text-slate-700 dark:text-slate-300">{message.sender?.fullName}</span>
                                        <span className="text-slate-300 dark:text-slate-700">•</span>
                                        <span>{formatDateTime(message.createdAt)}</span>
                                    </div>
                                    {/* Message Reactions */}
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

                {/* Typing Indicator */}
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

            {/* Message Input - Sticky Bottom with Drop Zone */}
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

                {/* Internal Note Toggle - Only for agents/admins */}
                {canAddInternalNote && (
                    <div className="flex items-center gap-2 mb-3">
                        <button
                            type="button"
                            onClick={() => setIsInternal(!isInternal)}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-150",
                                isInternal
                                    ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 ring-1 ring-amber-200 dark:ring-amber-800"
                                    : "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600"
                            )}
                        >
                            {isInternal ? (
                                <>
                                    <Lock className="w-3.5 h-3.5" />
                                    Internal Note
                                </>
                            ) : (
                                <>
                                    <Globe className="w-3.5 h-3.5" />
                                    Public Reply
                                </>
                            )}
                        </button>
                        {isInternal && (
                            <span className="text-xs text-amber-600 dark:text-amber-400">
                                Only visible to agents & admins
                            </span>
                        )}
                    </div>
                )}

                {/* Selected Files Preview */}
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
                                            <img
                                                src={filePreviews[index] || ''}
                                                alt={file.name}
                                                className="w-full h-full object-cover rounded-lg"
                                            />
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
                                            <p className="text-[9px] text-slate-500 dark:text-slate-400 truncate w-full group-hover:bg-slate-800 group-hover:text-white transition-colors rounded">
                                                {file.name}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                <div className="flex gap-3">
                    <TextareaAutosize
                        ref={messageInputRef}
                        minRows={1}
                        maxRows={6}
                        placeholder={isInternal ? "Add internal note..." : "Type a message..."}
                        className={cn(
                            "flex-1 px-4 py-3 bg-white dark:bg-[hsl(var(--card))] text-sm text-slate-900 dark:text-slate-200 border rounded-xl outline-none placeholder:text-slate-400 dark:placeholder:text-slate-600 transition-colors resize-none",
                            isInternal
                                ? "border-amber-300 dark:border-amber-800"
                                : "border-[hsl(var(--border))] focus:border-primary dark:focus:border-primary/50"
                        )}
                        onChange={handleInputChange}
                        onKeyDown={async (e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                await handleSendMessage();
                            }
                        }}
                    />
                    <button
                        onClick={handleSendMessage}
                        className={cn(
                            "px-4 py-3 rounded-xl transition-colors text-white text-sm font-semibold self-end shadow-sm flex items-center justify-center",
                            isInternal
                                ? "bg-amber-600 hover:bg-amber-700"
                                : "bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90"
                        )}
                    >
                        <Send className="w-5 h-5" />
                    </button>
                </div>
                <div className="flex items-center gap-3 mt-2 relative">
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="cursor-pointer flex items-center gap-1.5 text-xs text-slate-500 hover:text-primary transition-colors"
                    >
                        <Paperclip className="w-3.5 h-3.5" />
                        Attach files
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept={ACCEPTED_EXTENSIONS}
                        className="hidden"
                        onChange={(e) => handleFileSelect(e.target.files)}
                    />
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                        or drag & drop
                    </span>
                    {/* P4 LOW: Character limit indicator */}
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
                    <CannedResponsePicker
                        onSelect={(content) => {
                            if (messageInputRef.current) {
                                messageInputRef.current.value = content;
                                messageInputRef.current.focus();
                            }
                        }}
                    />
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
