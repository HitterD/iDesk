import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
    ArrowLeft, 
    Clock, 
    Send, 
    Paperclip, 
    CheckCircle, 
    User,
    Calendar,
    Tag,
    AlertCircle,
    MessageSquare,
    FileText,
    Wifi,
    XCircle,
    Ban
} from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { useAuth } from '@/stores/useAuth';
import { useTicketSocket } from '@/hooks/useTicketSocket';

interface Message {
    id: string;
    content: string;
    senderId: string;
    sender?: { fullName: string; role: string };
    createdAt: string;
    isSystemMessage?: boolean;
    attachments?: string[];
}

interface Ticket {
    id: string;
    ticketNumber?: string;
    title: string;
    description?: string;
    status: string;
    priority: string;
    category?: string;
    device?: string;
    createdAt: string;
    updatedAt: string;
    slaTarget?: string;
    user?: { fullName: string; email: string };
    assignedTo?: { fullName: string };
    messages?: Message[];
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    TODO: { label: 'Open', color: 'text-slate-600', bg: 'bg-slate-100 dark:bg-slate-700' },
    IN_PROGRESS: { label: 'In Progress', color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-900/30' },
    WAITING_VENDOR: { label: 'Waiting', color: 'text-orange-600', bg: 'bg-orange-100 dark:bg-orange-900/30' },
    RESOLVED: { label: 'Resolved', color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/30' },
    CANCELLED: { label: 'Cancelled', color: 'text-red-600', bg: 'bg-red-100 dark:bg-red-900/30' },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
    CRITICAL: { label: 'Critical', color: 'text-red-600' },
    HIGH: { label: 'High', color: 'text-orange-600' },
    MEDIUM: { label: 'Medium', color: 'text-yellow-600' },
    LOW: { label: 'Low', color: 'text-slate-500' },
};

const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDate(dateString);
};

export const ClientTicketDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const [newMessage, setNewMessage] = useState('');
    const [files, setFiles] = useState<File[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Real-time socket connection
    const { isConnected } = useTicketSocket({
        ticketId: id,
        onNewMessage: () => {
            // Auto-scroll to bottom when new message arrives
            setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }, 100);
        },
    });

    const { data: ticket, isLoading } = useQuery<Ticket>({
        queryKey: ['ticket', id],
        queryFn: async () => {
            const res = await api.get(`/tickets/${id}`);
            return res.data;
        },
        enabled: !!id,
    });

    const { data: messages = [] } = useQuery<Message[]>({
        queryKey: ['ticket-messages', id],
        queryFn: async () => {
            const res = await api.get(`/tickets/${id}/messages`);
            return res.data;
        },
        enabled: !!id,
        staleTime: 5000,
    });

    // Scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const replyMutation = useMutation({
        mutationFn: async (formData: FormData) => {
            const res = await api.post(`/tickets/${id}/reply`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            return res.data;
        },
        onSuccess: () => {
            setNewMessage('');
            setFiles([]);
            queryClient.invalidateQueries({ queryKey: ['ticket-messages', id] });
            toast.success('Reply sent');
        },
        onError: () => {
            toast.error('Failed to send reply');
        },
    });

    const cancelMutation = useMutation({
        mutationFn: async (reason?: string) => {
            const res = await api.patch(`/tickets/${id}/cancel`, { reason });
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['ticket', id] });
            queryClient.invalidateQueries({ queryKey: ['tickets'] });
            toast.success('Ticket cancelled');
        },
        onError: () => {
            toast.error('Failed to cancel ticket');
        },
    });

    const handleCancelTicket = () => {
        if (window.confirm('Are you sure you want to cancel this ticket? This action cannot be undone.')) {
            cancelMutation.mutate(undefined);
        }
    };

    const handleSendReply = () => {
        if (!newMessage.trim() && files.length === 0) return;

        const formData = new FormData();
        formData.append('content', newMessage);
        files.forEach(file => formData.append('files', file));

        replyMutation.mutate(formData);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setFiles(Array.from(e.target.files));
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
            </div>
        );
    }

    if (!ticket) {
        return (
            <div className="text-center py-12">
                <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Ticket not found</h2>
                <Link to="/client/my-tickets" className="text-primary hover:underline">Back to My Tickets</Link>
            </div>
        );
    }

    const statusConfig = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.TODO;
    const priorityConfig = PRIORITY_CONFIG[ticket.priority] || PRIORITY_CONFIG.LOW;
    const isResolved = ticket.status === 'RESOLVED';
    const isCancelled = ticket.status === 'CANCELLED';
    const isClosed = isResolved || isCancelled;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <button
                    onClick={() => navigate('/client/my-tickets')}
                    className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                        <span className="font-mono text-sm text-slate-400">
                            #{ticket.ticketNumber || ticket.id.split('-')[0]}
                        </span>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${statusConfig.bg} ${statusConfig.color}`}>
                            {statusConfig.label}
                        </span>
                    </div>
                    <h1 className="text-xl font-bold text-slate-800 dark:text-white">{ticket.title}</h1>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Content */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Messages */}
                    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                            <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                <MessageSquare className="w-5 h-5 text-primary" />
                                Conversation
                            </h3>
                            <div className={`flex items-center gap-1.5 text-xs ${isConnected ? 'text-green-500' : 'text-slate-400'}`}>
                                <Wifi className="w-3.5 h-3.5" />
                                {isConnected ? 'Live' : 'Connecting...'}
                            </div>
                        </div>

                        <div className="max-h-[500px] overflow-y-auto p-6 space-y-4">
                            {messages.map((message) => {
                                const isOwn = message.senderId === user?.id;
                                const isSystem = message.isSystemMessage;

                                if (isSystem) {
                                    return (
                                        <div key={message.id} className="text-center py-2">
                                            <p className="text-xs text-slate-400 italic">{message.content}</p>
                                            <p className="text-[10px] text-slate-300 mt-1">{formatTimeAgo(message.createdAt)}</p>
                                        </div>
                                    );
                                }

                                return (
                                    <div key={message.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[80%] ${isOwn ? 'order-2' : 'order-1'}`}>
                                            <div className="flex items-center gap-2 mb-1">
                                                {!isOwn && (
                                                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                                                        {message.sender?.fullName?.charAt(0) || 'A'}
                                                    </div>
                                                )}
                                                <span className="text-xs text-slate-500">
                                                    {isOwn ? 'You' : message.sender?.fullName || 'Support'}
                                                </span>
                                                <span className="text-xs text-slate-400">
                                                    {formatTimeAgo(message.createdAt)}
                                                </span>
                                            </div>
                                            <div className={`p-4 rounded-2xl ${
                                                isOwn 
                                                    ? 'bg-primary text-slate-900 rounded-br-md' 
                                                    : 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-white rounded-bl-md'
                                            }`}>
                                                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                                                {message.attachments && message.attachments.length > 0 && (
                                                    <div className="mt-2 space-y-1">
                                                        {message.attachments.map((file, i) => (
                                                            <a 
                                                                key={i} 
                                                                href={file} 
                                                                target="_blank" 
                                                                rel="noopener noreferrer"
                                                                className="flex items-center gap-1 text-xs underline"
                                                            >
                                                                <FileText className="w-3 h-3" />
                                                                Attachment {i + 1}
                                                            </a>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Reply Box */}
                        {!isClosed && (
                            <div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                                <div className="flex gap-3">
                                    <input
                                        type="file"
                                        multiple
                                        ref={fileInputRef}
                                        className="hidden"
                                        onChange={handleFileChange}
                                    />
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        className="p-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                                    >
                                        <Paperclip className="w-5 h-5" />
                                    </button>
                                    <input
                                        type="text"
                                        placeholder="Type your reply..."
                                        value={newMessage}
                                        onChange={(e) => setNewMessage(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendReply()}
                                        className="flex-1 px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary/50 outline-none text-slate-800 dark:text-white"
                                    />
                                    <button
                                        onClick={handleSendReply}
                                        disabled={replyMutation.isPending || (!newMessage.trim() && files.length === 0)}
                                        className="px-6 py-3 bg-primary text-slate-900 font-bold rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50"
                                    >
                                        <Send className="w-5 h-5" />
                                    </button>
                                </div>
                                <div className="flex items-center justify-between mt-3">
                                    {files.length > 0 && (
                                        <p className="text-xs text-slate-500">
                                            {files.length} file(s) attached: {files.map(f => f.name).join(', ')}
                                        </p>
                                    )}
                                    <button
                                        onClick={handleCancelTicket}
                                        disabled={cancelMutation.isPending}
                                        className="ml-auto flex items-center gap-1.5 px-4 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl text-sm font-medium transition-colors"
                                    >
                                        <XCircle className="w-4 h-4" />
                                        Cancel Ticket
                                    </button>
                                </div>
                            </div>
                        )}

                        {isResolved && (
                            <div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-green-50 dark:bg-green-900/20 text-center">
                                <p className="text-sm text-green-600 dark:text-green-400 flex items-center justify-center gap-2">
                                    <CheckCircle className="w-4 h-4" />
                                    This ticket has been resolved
                                </p>
                            </div>
                        )}

                        {isCancelled && (
                            <div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-red-50 dark:bg-red-900/20 text-center">
                                <p className="text-sm text-red-600 dark:text-red-400 flex items-center justify-center gap-2">
                                    <Ban className="w-4 h-4" />
                                    This ticket has been cancelled
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    {/* Ticket Info */}
                    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-6">
                        <h3 className="font-bold text-slate-800 dark:text-white mb-4">Ticket Details</h3>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-slate-500 flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4" />
                                    Status
                                </span>
                                <span className={`px-3 py-1 rounded-full text-xs font-bold ${statusConfig.bg} ${statusConfig.color}`}>
                                    {statusConfig.label}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-slate-500 flex items-center gap-2">
                                    <Tag className="w-4 h-4" />
                                    Priority
                                </span>
                                <span className={`text-sm font-bold ${priorityConfig.color}`}>
                                    {priorityConfig.label}
                                </span>
                            </div>
                            {ticket.category && (
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-slate-500 flex items-center gap-2">
                                        <Tag className="w-4 h-4" />
                                        Category
                                    </span>
                                    <span className="text-sm font-medium text-slate-800 dark:text-white">
                                        {ticket.category}
                                    </span>
                                </div>
                            )}
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-slate-500 flex items-center gap-2">
                                    <Calendar className="w-4 h-4" />
                                    Created
                                </span>
                                <span className="text-sm text-slate-800 dark:text-white">
                                    {formatDate(ticket.createdAt)}
                                </span>
                            </div>
                            {ticket.assignedTo && (
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-slate-500 flex items-center gap-2">
                                        <User className="w-4 h-4" />
                                        Assigned To
                                    </span>
                                    <span className="text-sm font-medium text-slate-800 dark:text-white">
                                        {ticket.assignedTo.fullName}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* SLA Info */}
                    {ticket.slaTarget && !isResolved && (
                        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-6">
                            <h3 className="font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                                <Clock className="w-5 h-5 text-primary" />
                                Expected Resolution
                            </h3>
                            <p className="text-sm text-slate-600 dark:text-slate-300">
                                {formatDate(ticket.slaTarget)}
                            </p>
                        </div>
                    )}

                    {/* Help */}
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-200 dark:border-blue-800 p-6">
                        <h3 className="font-bold text-blue-800 dark:text-blue-300 mb-2">Need more help?</h3>
                        <p className="text-sm text-blue-700 dark:text-blue-400 mb-4">
                            Check our knowledge base for solutions to common problems.
                        </p>
                        <Link 
                            to="/client/kb"
                            className="text-sm text-primary font-medium hover:underline"
                        >
                            Browse Help Center →
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
};
