import React, { useRef, useEffect } from 'react';
import { MessageSquare, Wifi, Send, Paperclip } from 'lucide-react';
import { toast } from 'sonner';
import { TicketDetail } from './types';
import { MessageAttachments } from './MessageAttachments';

interface TicketChatProps {
    ticket: TicketDetail;
    isConnected: boolean;
    onSendMessage: (content: string, files?: FileList | null) => Promise<void>;
    onImageClick: (url: string) => void;
    typingUsers?: { [key: string]: string };
    onTypingStart?: () => void;
    onTypingStop?: () => void;
}

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

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        if (ticket?.messages) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [ticket?.messages, typingUsers]);

    const handleSendMessage = async () => {
        const input = document.getElementById('note-input') as HTMLInputElement;
        const fileInput = document.getElementById('note-attachment') as HTMLInputElement;
        const content = input?.value.trim();
        const files = fileInput?.files;

        if (content || (files && files.length > 0)) {
            await onSendMessage(content || '', files);
            if (input) input.value = '';
            if (fileInput) fileInput.value = '';

            // Stop typing immediately after sending
            if (onTypingStop) onTypingStop();
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
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
        <div className="bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-800/90 rounded-2xl border border-slate-200/70 dark:border-slate-700/70 overflow-hidden shadow-lg shadow-slate-200/40 dark:shadow-slate-900/40">
            <div className="px-6 py-4 border-b border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between bg-gradient-to-r from-slate-50/80 to-white/80 dark:from-slate-900/60 dark:to-slate-800/60">
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

            <div className="p-4 space-y-4 max-h-[400px] overflow-y-auto bg-gradient-to-b from-transparent to-slate-50/30 dark:to-slate-900/20">
                {ticket.messages
                    ?.filter(m => !m.isSystemMessage)
                    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
                    .map((message) => {
                        const isRequester = message.sender?.fullName === ticket.user.fullName;
                        return (
                            <div key={message.id} className={`flex gap-3 ${isRequester ? 'flex-row-reverse' : ''}`}>
                                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 shadow-md ${isRequester
                                    ? 'bg-gradient-to-br from-primary to-primary/80 text-slate-900'
                                    : 'bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 text-white'
                                    }`}>
                                    {message.sender?.fullName?.charAt(0) || '?'}
                                </div>
                                <div className={`max-w-[75%] ${isRequester ? 'text-right' : ''}`}>
                                    <div className={`rounded-2xl p-4 shadow-md ${isRequester
                                        ? 'bg-gradient-to-br from-primary to-primary/90 text-slate-900 rounded-tr-sm'
                                        : 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white rounded-tl-sm border border-slate-200 dark:border-slate-600'
                                        }`}>
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

            {/* Message Input */}
            <div className="p-4 border-t border-slate-200/60 dark:border-slate-700/60 bg-gradient-to-r from-slate-50 to-white dark:from-slate-900/70 dark:to-slate-800/70">
                <div className="flex gap-3">
                    <input
                        type="text"
                        id="note-input"
                        placeholder="Type a message..."
                        className="flex-1 px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none text-slate-800 dark:text-white text-sm shadow-sm placeholder:text-slate-400 dark:placeholder:text-slate-500"
                        onChange={handleInputChange}
                        onKeyDown={async (e) => {
                            if (e.key === 'Enter') {
                                await handleSendMessage();
                            }
                        }}
                    />
                    <button
                        onClick={handleSendMessage}
                        className="px-4 py-3 bg-gradient-to-r from-primary to-primary/90 text-slate-900 rounded-xl hover:from-primary/90 hover:to-primary/80 transition-all shadow-md hover:shadow-lg hover:scale-105 active:scale-95"
                    >
                        <Send className="w-5 h-5" />
                    </button>
                </div>
                <div className="flex items-center gap-3 mt-2">
                    <label htmlFor="note-attachment" className="cursor-pointer flex items-center gap-1.5 text-xs text-slate-500 hover:text-primary transition-colors">
                        <Paperclip className="w-3.5 h-3.5" />
                        Attach files
                    </label>
                    <input
                        id="note-attachment"
                        type="file"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                            const count = e.target.files?.length || 0;
                            if (count > 0) toast.info(`${count} file(s) selected`);
                        }}
                    />
                </div>
            </div>
        </div>
    );
};
