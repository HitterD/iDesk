import React, { useEffect, useState, useRef } from 'react';
import { X, Send, Paperclip, Zap } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ImageUploadPreview } from './ImageUploadPreview';
import { ChatBubbleAttachment } from './ChatBubbleAttachment';
import { ImageViewerModal } from '../../../components/ui/ImageViewerModal';
import { useSavedReplies } from '../hooks/useSavedReplies';
import { Popover, PopoverContent, PopoverTrigger } from '../../../components/ui/popover';
import { Command, CommandInput, CommandList, CommandItem, CommandEmpty, CommandGroup } from '../../../components/ui/command';
import { RichTextEditor } from '../../../components/ui/RichTextEditor';
import api from '../../../lib/api';
import { formatDate } from '../../../lib/utils';

interface Message {
    id: string;
    content: string;
    sender: { fullName: string; role: string };
    createdAt: string;
    attachments?: string[];
    isSystemMessage?: boolean;
}

interface TicketChatRoomProps {
    ticketId: string;
    onClose: () => void;
}

// Mock API
const fetchMessages = async (_ticketId: string) => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return [
        {
            id: '1',
            content: 'Help! My payment failed.',
            sender: { fullName: 'John Doe', role: 'USER' },
            createdAt: new Date().toISOString(),
        },
        {
            id: '2',
            content: 'Checking it now...',
            sender: { fullName: 'Agent Smith', role: 'AGENT' },
            createdAt: new Date().toISOString(),
            attachments: ['https://placehold.co/600x400'],
        },
    ];
};

export const TicketChatRoom: React.FC<TicketChatRoomProps> = ({ ticketId, onClose }) => {
    const queryClient = useQueryClient();
    const [newMessage, setNewMessage] = useState('');
    const [mentionedUserIds, setMentionedUserIds] = useState<string[]>([]);
    const [files, setFiles] = useState<File[]>([]);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [isPopoverOpen, setIsPopoverOpen] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const socketRef = useRef<Socket | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const { data: messages = [] } = useQuery({
        queryKey: ['messages', ticketId],
        queryFn: () => fetchMessages(ticketId),
    });

    const { data: savedReplies = [] } = useSavedReplies();

    useEffect(() => {
        // Connect to Socket.io
        socketRef.current = io('http://localhost:5050'); // Updated port

        socketRef.current.on('connect', () => {
            console.log('Connected to socket server');
        });

        socketRef.current.on('ticket:updated', (data: any) => {
            if (data.ticketId === ticketId) {
                queryClient.invalidateQueries({ queryKey: ['messages', ticketId] });
            }
        });

        return () => {
            socketRef.current?.disconnect();
        };
    }, [ticketId, queryClient]);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
        }
    };

    const handleRemoveFile = (index: number) => {
        setFiles((prev) => prev.filter((_, i) => i !== index));
    };

    const handleSend = async () => {
        // Strip HTML tags to check if empty (basic check)
        const stripped = newMessage.replace(/<[^>]*>?/gm, '').trim();
        if ((!stripped && files.length === 0) || isSending) return;

        setIsSending(true);
        let attachmentUrls: string[] = [];

        // Upload files if any
        if (files.length > 0) {
            const formData = new FormData();
            files.forEach((file) => formData.append('files', file));

            try {
                const response = await fetch('http://localhost:5050/uploads', {
                    method: 'POST',
                    body: formData,
                });
                const data = await response.json();
                attachmentUrls = data.urls;
            } catch (error) {
                console.error('Upload failed:', error);
                setIsSending(false);
                return; // Stop if upload fails
            }
        }

        try {
            await api.post(`/tickets/${ticketId}/reply`, {
                content: newMessage,
                files: attachmentUrls,
                mentionedUserIds: JSON.stringify(mentionedUserIds),
            });
            setNewMessage('');
            setMentionedUserIds([]);
            setFiles([]);
        } catch (e) {
            console.error('Failed to send message', e);
        } finally {
            setIsSending(false);
        }
    };

    const handleSelectReply = (content: string) => {
        setNewMessage((prev) => prev + content);
        setIsPopoverOpen(false);
    };

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-navy-main">
                <h3 className="font-semibold text-white">Ticket #{ticketId.slice(0, 4)}</h3>
                <button onClick={onClose} className="text-slate-400 hover:text-white">
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-navy-main/50">
                {messages.map((msg: Message) => {
                    if (msg.isSystemMessage) {
                        return (
                            <div key={msg.id} className="flex justify-center my-4">
                                <span className="text-xs font-medium text-slate-500 bg-white/5 px-3 py-1 rounded-full border border-white/5">
                                    {msg.content}
                                </span>
                            </div>
                        );
                    }

                    const isAgent = msg.sender.role === 'AGENT';
                    return (
                        <div
                            key={msg.id}
                            className={`flex ${isAgent ? 'justify-end' : 'justify-start'}`}
                        >
                            <div
                                className={`max-w-[80%] rounded-lg p-3 text-sm ${isAgent
                                    ? 'bg-neon-green/20 text-neon-green border border-neon-green/30 rounded-br-none'
                                    : 'bg-slate-800 text-slate-200 border border-white/5 rounded-bl-none'
                                    }`}
                            >
                                <div dangerouslySetInnerHTML={{ __html: msg.content }} className="prose prose-invert prose-sm max-w-none" />
                                <ChatBubbleAttachment
                                    attachments={msg.attachments || []}
                                    onImageClick={setSelectedImage}
                                />
                                <span className="text-[10px] opacity-50 mt-1 block">
                                    {formatDate(msg.createdAt)}
                                </span>
                            </div>
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>

            {/* Image Preview */}
            <ImageUploadPreview files={files} onRemove={handleRemoveFile} />

            {/* Input */}
            <div className="p-4 border-t border-white/10 bg-navy-main">
                <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                        <div className="flex gap-2">
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="p-2 text-slate-400 hover:text-white transition-colors"
                            >
                                <Paperclip className="w-5 h-5" />
                            </button>
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                multiple
                                accept="image/*"
                                onChange={handleFileSelect}
                            />

                            <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
                                <PopoverTrigger asChild>
                                    <button
                                        className="p-2 text-slate-400 hover:text-neon-green transition-colors"
                                        title="Saved Replies"
                                    >
                                        <Zap className="w-5 h-5" />
                                    </button>
                                </PopoverTrigger>
                                <PopoverContent className="w-80 p-0 bg-navy-light border-white/10" align="start">
                                    <Command className="bg-transparent">
                                        <CommandInput placeholder="Search saved replies..." className="text-white" />
                                        <CommandList>
                                            <CommandEmpty>No results found.</CommandEmpty>
                                            <CommandGroup heading="Saved Replies">
                                                {savedReplies.map((reply) => (
                                                    <CommandItem
                                                        key={reply.id}
                                                        onSelect={() => handleSelectReply(reply.content)}
                                                        className="text-slate-300 hover:bg-white/5 cursor-pointer"
                                                    >
                                                        <div className="flex flex-col">
                                                            <span className="font-medium text-white">{reply.title}</span>
                                                            <span className="text-xs text-slate-500 truncate max-w-[250px]">{reply.content}</span>
                                                        </div>
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>
                        <button
                            onClick={handleSend}
                            disabled={isSending}
                            className="bg-neon-green text-navy-main px-4 py-2 rounded-lg hover:bg-neon-green/90 transition-colors font-medium flex items-center gap-2 disabled:opacity-50"
                        >
                            <Send className="w-4 h-4" /> Send
                        </button>
                    </div>

                    <RichTextEditor
                        value={newMessage}
                        onChange={(content, mentions) => {
                            setNewMessage(content);
                            setMentionedUserIds(mentions);
                        }}
                        onEnter={handleSend}
                        placeholder="Type a reply... (@ to mention)"
                    />
                </div>
            </div>

            <ImageViewerModal
                isOpen={!!selectedImage}
                imageUrl={selectedImage}
                onClose={() => setSelectedImage(null)}
            />
        </div>
    );
};
