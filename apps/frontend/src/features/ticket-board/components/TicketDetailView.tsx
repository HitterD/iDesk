import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { StatusSelect } from './sidebar/StatusSelect';
import { PrioritySelect } from './sidebar/PrioritySelect';
import { AssigneeSelect } from './sidebar/AssigneeSelect';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Clock, Tag, X, FileText, Download } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { MessageSourceBadge } from '@/components/ui/TelegramBadge';
import { useTicketSocket } from '@/hooks/useTicketSocket';
import { PDFPreviewModal, usePDFPreview } from '@/features/reports/components/PDFPreviewModal';
import { Paperclip } from 'lucide-react';

// Image Lightbox Component
const ImageLightbox: React.FC<{
    src: string;
    alt: string;
    onClose: () => void;
}> = ({ src, alt, onClose }) => {
    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
            onClick={onClose}
        >
            <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
                <X className="w-6 h-6" />
            </button>
            <img
                src={src}
                alt={alt}
                className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            />
            <a
                href={src}
                download
                onClick={(e) => e.stopPropagation()}
                className="absolute bottom-4 right-4 flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm transition-colors"
            >
                <Download className="w-4 h-4" />
                Download
            </a>
        </div>
    );
};

// Attachment Preview Component
const AttachmentPreview: React.FC<{
    attachments: string[];
    onImageClick: (url: string) => void;
    onPdfClick: (url: string, filename: string) => void;
}> = ({ attachments, onImageClick, onPdfClick }) => {
    if (!attachments || attachments.length === 0) return null;

    // Get the full URL for attachments (prepend backend URL if relative path)
    const getFullUrl = (url: string) => {
        if (url.startsWith('http://') || url.startsWith('https://')) {
            return url;
        }
        // Prepend backend URL for relative paths
        const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:5050';
        return `${backendUrl}${url.startsWith('/') ? '' : '/'}${url}`;
    };

    const isImage = (url: string) => {
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
        const lowerUrl = url.toLowerCase();
        return imageExtensions.some(ext => lowerUrl.includes(ext)) || lowerUrl.includes('/uploads/telegram/');
    };

    const getFileName = (url: string) => {
        const parts = url.split('/');
        return parts[parts.length - 1] || 'file';
    };

    return (
        <div className="mt-2 space-y-2">
            {attachments.map((url, index) => {
                const fullUrl = getFullUrl(url);

                if (isImage(url)) {
                    return (
                        <div
                            key={index}
                            className="cursor-pointer group relative inline-block"
                            onClick={() => onImageClick(fullUrl)}
                        >
                            <img
                                src={fullUrl}
                                alt={`Attachment ${index + 1}`}
                                className="max-w-[200px] max-h-[150px] rounded-lg object-cover border border-white/10 group-hover:border-primary/50 transition-colors"
                                onError={(e) => {
                                    // Show placeholder for broken images
                                    const target = e.target as HTMLImageElement;
                                    target.style.display = 'none';
                                    target.parentElement?.classList.add('broken-image');
                                }}
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 rounded-lg transition-colors flex items-center justify-center">
                                <span className="opacity-0 group-hover:opacity-100 text-white text-xs bg-black/60 px-2 py-1 rounded">
                                    🔍 Perbesar
                                </span>
                            </div>
                        </div>
                    );
                } else if (url.toLowerCase().endsWith('.pdf')) {
                    const filename = getFileName(url);
                    return (
                        <button
                            key={index}
                            onClick={() => onPdfClick(fullUrl, filename)}
                            type="button"
                            className="w-full flex items-center justify-between p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
                        >
                            <div className="flex items-center gap-2">
                                <FileText className="w-4 h-4 text-red-400" />
                                <span className="text-xs text-slate-300 truncate max-w-[150px]">
                                    {filename}
                                </span>
                            </div>
                            <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-white">Preview</span>
                        </button>
                    );
                } else {
                    return (
                        <a
                            key={index}
                            href={fullUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
                        >
                            <FileText className="w-4 h-4 text-slate-400" />
                            <span className="text-xs text-slate-300 truncate max-w-[150px]">
                                {getFileName(url)}
                            </span>
                            <Download className="w-3 h-3 text-slate-500" />
                        </a>
                    );
                }
            })}
        </div>
    );
};

interface TicketDetailViewProps {
    ticketId: string;
}

export const TicketDetailView: React.FC<TicketDetailViewProps> = ({ ticketId }) => {
    const [newMessage, setNewMessage] = useState('');
    const [files, setFiles] = useState<File[]>([]);
    const [lightboxImage, setLightboxImage] = useState<string | null>(null);
    const pdfPreview = usePDFPreview();
    const queryClient = useQueryClient();
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Real-time socket connection for live updates
    useTicketSocket({ ticketId });

    // Auto-scroll to bottom when messages change
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    // Fetch Ticket Details
    const { data: ticket, isLoading: ticketLoading } = useQuery({
        queryKey: ['ticket', ticketId],
        queryFn: async () => {
            const res = await api.get(`/tickets`); // Ideally should be /tickets/:id, but using list for now and filtering or assuming context
            // For now, let's assume we need a specific endpoint or filter from list
            // Since we don't have getOne endpoint in controller shown, we might need to add it or use list.
            // Let's assume we add getOne or just mock for now to proceed with UI structure.
            // Actually, let's use the list and find.
            return res.data.find((t: any) => t.id === ticketId);
        },
        enabled: !!ticketId,
    });

    // Fetch Messages
    const { data: messages = [] } = useQuery({
        queryKey: ['ticket-messages', ticketId],
        queryFn: async () => {
            const res = await api.get(`/tickets/${ticketId}/messages`);
            return res.data;
        },
        enabled: !!ticketId,
        refetchInterval: 5000, // Fallback polling every 5 seconds
    });

    // Scroll to bottom when messages update
    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Mutations
    const updateStatusMutation = useMutation({
        mutationFn: async (status: string) => {
            await api.patch(`/tickets/${ticketId}/status`, { status });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] });
            queryClient.invalidateQueries({ queryKey: ['ticket-messages', ticketId] });
            queryClient.invalidateQueries({ queryKey: ['tickets'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
        },
    });

    const updatePriorityMutation = useMutation({
        mutationFn: async (priority: string) => {
            await api.patch(`/tickets/${ticketId}/priority`, { priority });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] });
            queryClient.invalidateQueries({ queryKey: ['ticket-messages', ticketId] });
            queryClient.invalidateQueries({ queryKey: ['tickets'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
        },
    });

    const assignTicketMutation = useMutation({
        mutationFn: async (assigneeId: string) => {
            await api.patch(`/tickets/${ticketId}/assign`, { assigneeId });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] });
            queryClient.invalidateQueries({ queryKey: ['ticket-messages', ticketId] });
            queryClient.invalidateQueries({ queryKey: ['tickets'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
        },
    });

    const sendMessageMutation = useMutation({
        mutationFn: async (formData: FormData) => {
            await api.post(`/tickets/${ticketId}/reply`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['ticket-messages', ticketId] });
            setNewMessage('');
            setFiles([]);
            scrollToBottom();
        },
        onError: (error) => {
            console.error('Failed to send message:', error);
        },
    });

    const handleSend = () => {
        if (!newMessage.trim() && files.length === 0) return;

        const formData = new FormData();
        formData.append('content', newMessage);
        formData.append('isInternal', 'false'); // Set true if you add an internal note toggle
        files.forEach(file => formData.append('files', file));

        sendMessageMutation.mutate(formData);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setFiles(Array.from(e.target.files));
        }
    };

    if (ticketLoading) return <div className="p-4 text-slate-400">Loading ticket...</div>;
    if (!ticket) return <div className="p-4 text-slate-400">Select a ticket to view details</div>;

    return (
        <div className="flex h-full bg-navy-main border border-white/10 rounded-xl overflow-hidden">
            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col border-r border-white/10">
                {/* Header */}
                <div className="p-4 border-b border-white/10 bg-white/5 flex justify-between items-center">
                    <div>
                        <h3 className="font-bold text-white flex items-center gap-2">
                            Ticket #{ticketId.split('-')[0]}
                            <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-white/10 text-slate-300">
                                {ticket.source}
                            </span>
                        </h3>
                        <p className="text-sm text-slate-400">{ticket.title}</p>
                    </div>
                </div>

                {/* Chat Body */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-navy-dark/50">
                    {messages.map((msg: any) => (
                        <div
                            key={msg.id}
                            className={`flex ${msg.senderId === ticket.userId ? 'justify-start' : 'justify-end'}`}
                        >
                            <div
                                className={`max-w-[80%] p-3 rounded-xl text-sm ${msg.isSystemMessage
                                    ? 'bg-transparent text-slate-500 text-xs w-full text-center italic border-none'
                                    : msg.senderId === ticket.userId
                                        ? 'bg-white/10 text-slate-200 rounded-bl-none'
                                        : 'bg-primary/10 text-primary border border-primary/20 rounded-br-none'
                                    }`}
                            >
                                {/* Message Content - hide if only [Photo] placeholder */}
                                {msg.content && !msg.content.match(/^\[?(📷\s*)?\[?Photo\]?\]?$/i) && (
                                    <p>{msg.content}</p>
                                )}

                                {/* Attachment Preview */}
                                {msg.attachments && msg.attachments.length > 0 && (
                                    <AttachmentPreview
                                        attachments={msg.attachments}
                                        onImageClick={(url) => setLightboxImage(url)}
                                        onPdfClick={(url, filename) => pdfPreview.openPreview(url, filename, 'PDF Attachment')}
                                    />
                                )}

                                {!msg.isSystemMessage && (
                                    <div className="flex items-center justify-between mt-2 gap-2">
                                        <MessageSourceBadge source={msg.source} />
                                        <span className="text-[10px] opacity-50">
                                            {formatDate(msg.createdAt)}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>

                {/* Image Lightbox */}
                {lightboxImage && (
                    <ImageLightbox
                        src={lightboxImage}
                        alt="Attachment"
                        onClose={() => setLightboxImage(null)}
                    />
                )}

                {/* Input Area */}
                <div className="p-4 border-t border-white/10 bg-white/5 flex flex-col gap-2">
                    {files.length > 0 && (
                        <div className="flex gap-2 flex-wrap mb-1">
                            {files.map((file, idx) => (
                                <span key={idx} className="text-xs bg-white/10 text-slate-300 px-2 py-1 rounded-md flex items-center gap-1">
                                    <FileText className="w-3 h-3" />
                                    {file.name}
                                    <button onClick={() => setFiles(files.filter((_, i) => i !== idx))} className="ml-1 hover:text-white">
                                        <X className="w-3 h-3" />
                                    </button>
                                </span>
                            ))}
                        </div>
                    )}
                    <div className="flex space-x-2">
                        <input
                            type="file"
                            multiple
                            accept=".pdf,image/*,.doc,.docx,.xls,.xlsx"
                            ref={fileInputRef}
                            className="hidden"
                            onChange={handleFileChange}
                        />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="p-2.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
                        >
                            <Paperclip className="w-5 h-5" />
                        </button>
                        <input
                            type="text"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                            placeholder="Type a reply and attach files..."
                            className="flex-1 bg-navy-dark border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-slate-600"
                        />
                        <button
                            onClick={handleSend}
                            disabled={sendMessageMutation.isPending || (!newMessage.trim() && files.length === 0)}
                            className="bg-primary text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50"
                        >
                            Send
                        </button>
                    </div>
                </div>
            </div>

            {/* Right Sidebar */}
            <div className="w-80 bg-navy-light p-4 space-y-6 overflow-y-auto">
                <div>
                    <h4 className="text-sm font-medium text-slate-400 mb-4 uppercase tracking-wider">Ticket Info</h4>
                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-xs text-slate-500">Status</label>
                            <StatusSelect
                                value={ticket.status}
                                onChange={(val) => updateStatusMutation.mutate(val)}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs text-slate-500">Priority</label>
                            <PrioritySelect
                                value={ticket.priority}
                                onChange={(val) => updatePriorityMutation.mutate(val)}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs text-slate-500">Assignee</label>
                            <AssigneeSelect
                                value={ticket.assignedToId}
                                onChange={(val) => assignTicketMutation.mutate(val)}
                            />
                        </div>
                    </div>
                </div>

                <Separator className="bg-white/10" />

                <div>
                    <h4 className="text-sm font-medium text-slate-400 mb-4 uppercase tracking-wider">Customer</h4>
                    <Card className="bg-white/5 border-white/10">
                        <CardContent className="p-4 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-white font-bold">
                                {ticket.user?.fullName?.charAt(0) || 'U'}
                            </div>
                            <div>
                                <p className="text-sm font-medium text-white">{ticket.user?.fullName}</p>
                                <p className="text-xs text-slate-400">{ticket.user?.email}</p>
                                <p className="text-xs text-slate-500 mt-1">{ticket.user?.jobTitle} • {ticket.user?.department?.name}</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <Separator className="bg-white/10" />

                <div>
                    <h4 className="text-sm font-medium text-slate-400 mb-4 uppercase tracking-wider">Details</h4>
                    <div className="space-y-3 text-sm">
                        <div className="flex justify-between">
                            <span className="text-slate-500 flex items-center gap-2"><Clock className="w-3 h-3" /> Created</span>
                            <span className="text-slate-300">{formatDate(ticket.createdAt)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-500 flex items-center gap-2"><Tag className="w-3 h-3" /> ID</span>
                            <span className="text-slate-300 font-mono">{ticket.id.split('-')[0]}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Render PDF Preview Modal */}
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
