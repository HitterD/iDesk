import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { StatusSelect } from './sidebar/StatusSelect';
import { PrioritySelect } from './sidebar/PrioritySelect';
import { AssigneeSelect } from './sidebar/AssigneeSelect';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Clock, Tag } from 'lucide-react';

interface TicketDetailViewProps {
    ticketId: string;
}

export const TicketDetailView: React.FC<TicketDetailViewProps> = ({ ticketId }) => {
    const [newMessage, setNewMessage] = useState('');
    const queryClient = useQueryClient();

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
        queryKey: ['messages', ticketId],
        queryFn: async () => {
            const res = await api.get(`/tickets/${ticketId}/messages`);
            return res.data;
        },
        enabled: !!ticketId,
    });

    // Mutations
    const updateStatusMutation = useMutation({
        mutationFn: async (status: string) => {
            await api.patch(`/tickets/${ticketId}/status`, { status });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] });
            queryClient.invalidateQueries({ queryKey: ['messages', ticketId] }); // System message added
        },
    });

    const updatePriorityMutation = useMutation({
        mutationFn: async (priority: string) => {
            await api.patch(`/tickets/${ticketId}/priority`, { priority });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] });
            queryClient.invalidateQueries({ queryKey: ['messages', ticketId] });
        },
    });

    const assignTicketMutation = useMutation({
        mutationFn: async (assigneeId: string) => {
            await api.patch(`/tickets/${ticketId}/assign`, { assigneeId });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] });
            queryClient.invalidateQueries({ queryKey: ['messages', ticketId] });
        },
    });

    const sendMessageMutation = useMutation({
        mutationFn: async (content: string) => {
            await api.post(`/tickets/${ticketId}/messages`, { content });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['messages', ticketId] });
            setNewMessage('');
        },
    });

    const handleSend = () => {
        if (newMessage.trim()) {
            sendMessageMutation.mutate(newMessage);
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
                                        : 'bg-neon-green/10 text-neon-green border border-neon-green/20 rounded-br-none'
                                    }`}
                            >
                                <p>{msg.content}</p>
                                {!msg.isSystemMessage && (
                                    <span className="text-[10px] opacity-50 block mt-1 text-right">
                                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Input Area */}
                <div className="p-4 border-t border-white/10 bg-white/5">
                    <div className="flex space-x-2">
                        <input
                            type="text"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                            placeholder="Type a reply..."
                            className="flex-1 bg-navy-dark border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-neon-green/50 placeholder:text-slate-600"
                        />
                        <button
                            onClick={handleSend}
                            className="bg-neon-green text-navy-dark px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-neon-green/90 transition-colors"
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
                            <span className="text-slate-300">{new Date(ticket.createdAt).toLocaleDateString()}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-500 flex items-center gap-2"><Tag className="w-3 h-3" /> ID</span>
                            <span className="text-slate-300 font-mono">{ticket.id.split('-')[0]}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
