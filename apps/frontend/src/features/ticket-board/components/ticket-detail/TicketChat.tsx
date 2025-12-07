import React, { useRef, useEffect, useState, useCallback } from 'react';
import { MessageSquare, Wifi, Send, Paperclip, Lock, Globe, X, Image, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { TicketDetail } from './types';
import { MessageAttachments } from './MessageAttachments';
import { CannedResponsePicker } from '@/components/ui/CannedResponses';
import { MessageReactions } from '@/components/ui/ChatReactions';
import { useAuth } from '@/stores/useAuth';
import { cn } from '@/lib/utils';

interface TicketChatProps {
    ticket: TicketDetail;
    isConnected: boolean;
    onSendMessage: (content: string, files?: FileList | null, isInternal?: boolean) => Promise<void>;
    onImageClick: (url: string) => void;
    typingUsers?: { [key: string]: string };
    onTypingStart?: () => void;
    onTypingStop?: () => void;
}

// Supported image formats
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/svg+xml'];
const ACCEPTED_EXTENSIONS = '.jpg,.jpeg,.png,.gif,.webp,.bmp,.svg';

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
    const [isInternal, setIsInternal] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const { user } = useAuth();

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
        const input = document.getElementById('note-input') as HTMLInputElement;
        const content = input?.value.trim();

        if (content || selectedFiles.length > 0) {
            const fileList = selectedFiles.length > 0 ? createFileList(selectedFiles) : null;
            await onSendMessage(content || '', fileList, isInternal);
            if (input) input.value = '';
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
            if (ACCEPTED_IMAGE_TYPES.includes(file.type)) {
                validFiles.push(file);
            } else {
                invalidFiles.push(file.name);
            }
        });

        if (invalidFiles.length > 0) {
            toast.error(`Invalid file type: ${invalidFiles.join(', ')}. Only images are allowed.`);
        }

        if (validFiles.length > 0) {
            setSelectedFiles(prev => [...prev, ...validFiles]);
            toast.success(`${validFiles.length} image(s) added`);
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

    const formatDate = (dateString: string) => {
        if (!dateString) return 'N/A';
        return new Intl.DateTimeFormat('en-US', {
            dateStyle: 'medium',
            timeStyle: 'short',
            timeZone: 'Asia/Jakarta'
        }).format(new Date(dateString));
    };

    const typingUserNames = Object.values(typingUsers);

    return (
        <div className="flex flex-col h-full animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
            <div className="px-6 py-4 border-b border-white/20 dark:border-white/10 flex items-center justify-between sticky top-0 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md z-10">
                <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 dark:from-primary/30 dark:to-primary/20 flex items-center justify-center">
                        <MessageSquare className="w-4 h-4 text-primary" />
                    </div>
                    Notes & Discussion
                </h3>
                <div className="flex items-center gap-4">
                    <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full ${isConnected ? 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30' : 'text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700'}`}>
                        <Wifi className={`w-3.5 h-3.5 ${isConnected ? 'animate-pulse' : ''}`} />
                        {isConnected ? 'Live' : 'Connecting...'}
                    </div>
                    <span className="text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-2.5 py-1 rounded-full">
                        {ticket.messages?.filter(m => !m.isSystemMessage).length || 0} messages
                    </span>
                </div>
            </div>

            <div className="p-4 space-y-4 flex-1">
                {ticket.messages
                    ?.filter(m => !m.isSystemMessage)
                    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
                    .map((message) => {
                        const isRequester = message.sender?.fullName === ticket.user.fullName;
                        const messageIsInternal = (message as any).isInternal;

                        return (
                            <div key={message.id} className={`flex gap-3 ${isRequester ? 'flex-row-reverse' : ''}`}>
                                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 shadow-md ${isRequester
                                    ? 'bg-gradient-to-br from-primary to-primary/80 text-slate-900'
                                    : 'bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 text-white'
                                    }`}>
                                    {message.sender?.fullName?.charAt(0) || '?'}
                                </div>
                                <div className={`max-w-[75%] ${isRequester ? 'text-right' : ''}`}>
                                    <div className={cn(
                                        "rounded-2xl p-4 shadow-md",
                                        isRequester
                                            ? 'bg-gradient-to-br from-primary to-primary/90 text-slate-900 rounded-tr-sm'
                                            : 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white rounded-tl-sm border border-slate-200 dark:border-slate-600',
                                        // Internal note styling
                                        messageIsInternal && !isRequester && 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
                                        messageIsInternal && isRequester && 'from-amber-400 to-amber-500'
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
                                            isRequester={isRequester}
                                        />
                                    </div>
                                    <div className={`flex items-center gap-2 mt-1.5 text-[10px] text-slate-500 dark:text-slate-400 ${isRequester ? 'justify-end' : ''}`}>
                                        <span className="font-semibold">{message.sender?.fullName}</span>
                                        <span className="text-slate-300 dark:text-slate-600">•</span>
                                        <span className="text-slate-400 dark:text-slate-500">{formatDate(message.createdAt)}</span>
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
                    <div className="text-center py-12">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 mx-auto mb-3 flex items-center justify-center shadow-inner">
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
                    "sticky bottom-0 p-4 border-t border-white/20 dark:border-white/10 bg-white/60 dark:bg-slate-900/60 backdrop-blur-md z-20 transition-all",
                    isDragging && "ring-2 ring-primary ring-inset bg-primary/10"
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
                            <p className="text-primary font-bold">Drop images here</p>
                            <p className="text-primary/70 text-sm">JPG, PNG, GIF, WebP supported</p>
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
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
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
                            <Image className="w-4 h-4 text-primary" />
                            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                                {selectedFiles.length} image(s) attached
                            </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {selectedFiles.map((file, index) => (
                                <div key={index} className="relative group">
                                    <img
                                        src={URL.createObjectURL(file)}
                                        alt={file.name}
                                        className="w-16 h-16 object-cover rounded-lg border border-slate-200 dark:border-slate-700"
                                    />
                                    <button
                                        onClick={() => removeFile(index)}
                                        className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate w-16 mt-1">
                                        {file.name}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="flex gap-3">
                    <input
                        type="text"
                        id="note-input"
                        placeholder={isInternal ? "Add internal note..." : "Type a message..."}
                        className={cn(
                            "flex-1 px-4 py-3 bg-white/80 dark:bg-slate-800/80 border rounded-xl focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none text-slate-800 dark:text-white text-sm shadow-sm placeholder:text-slate-400 dark:placeholder:text-slate-500 backdrop-blur-sm",
                            isInternal
                                ? "border-amber-200 dark:border-amber-800/50"
                                : "border-white/20 dark:border-white/10"
                        )}
                        onChange={handleInputChange}
                        onKeyDown={async (e) => {
                            if (e.key === 'Enter') {
                                await handleSendMessage();
                            }
                        }}
                    />
                    <button
                        onClick={handleSendMessage}
                        className={cn(
                            "px-4 py-3 rounded-xl transition-all shadow-md hover:shadow-lg hover:scale-105 active:scale-95",
                            isInternal
                                ? "bg-gradient-to-r from-amber-400 to-amber-500 text-slate-900 hover:from-amber-500 hover:to-amber-600"
                                : "bg-gradient-to-r from-primary to-primary/90 text-slate-900 hover:from-primary/90 hover:to-primary/80"
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
                        Attach images
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
                    <div className="flex-1" />
                    <CannedResponsePicker
                        onSelect={(content) => {
                            const input = document.getElementById('note-input') as HTMLInputElement;
                            if (input) {
                                input.value = content;
                                input.focus();
                            }
                        }}
                    />
                </div>
            </div>
        </div>
    );
};
