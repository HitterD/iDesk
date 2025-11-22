import React, { useState } from 'react';
import { DndContext, DragEndEvent, useDroppable } from '@dnd-kit/core';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { TicketCard } from './TicketCard';
import { TicketChatRoom } from './TicketChatRoom'; // Will be created next

// Mock API calls (Replace with real Axios calls later)
const fetchTickets = async () => {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 500));
    return [
        {
            id: '1',
            title: 'Payment Gateway Timeout',
            priority: 'CRITICAL',
            status: 'TODO',
            user: { fullName: 'John Doe' },
        },
        {
            id: '2',
            title: 'Feature Request: Dark Mode',
            priority: 'LOW',
            status: 'IN_PROGRESS',
            user: { fullName: 'Jane Smith' },
        },
        {
            id: '3',
            title: 'Bug: Login Page 404',
            priority: 'HIGH',
            status: 'WAITING',
            user: { fullName: 'Mike Ross' },
        },
    ];
};

const COLUMNS = [
    { id: 'TODO', title: 'To Do', color: 'border-slate-500' },
    { id: 'IN_PROGRESS', title: 'In Progress', color: 'border-blue-500' },
    { id: 'WAITING', title: 'Waiting', color: 'border-yellow-500' },
    { id: 'RESOLVED', title: 'Resolved', color: 'border-neon-green' },
];

const KanbanColumn = ({ id, title, color, children }: any) => {
    const { setNodeRef } = useDroppable({ id });
    return (
        <div ref={setNodeRef} className="flex-1 min-w-[280px] bg-navy-main/50 rounded-xl p-4 border border-white/5">
            <div className={`flex items-center justify-between mb-4 pb-2 border-b-2 ${color}`}>
                <h3 className="font-semibold text-slate-200">{title}</h3>
                <span className="bg-white/10 text-xs px-2 py-0.5 rounded-full text-slate-400">
                    {React.Children.count(children)}
                </span>
            </div>
            <div className="space-y-3 min-h-[200px]">{children}</div>
        </div>
    );
};

export const TicketKanban: React.FC = () => {
    const queryClient = useQueryClient();
    const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

    const { data: tickets = [] } = useQuery({
        queryKey: ['tickets'],
        queryFn: fetchTickets,
    });

    const updateStatusMutation = useMutation({
        mutationFn: async ({ id, status }: { id: string; status: string }) => {
            // Mock API call
            console.log(`Updating ticket ${id} to ${status}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tickets'] });
        },
    });

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            // In a real app, we'd optimistically update the UI here
            updateStatusMutation.mutate({
                id: active.id as string,
                status: over.id as string,
            });
        }
    };

    return (
        <div className="flex h-full gap-6">
            <DndContext onDragEnd={handleDragEnd}>
                <div className="flex-1 flex gap-4 overflow-x-auto pb-4">
                    {COLUMNS.map((col) => (
                        <KanbanColumn key={col.id} id={col.id} title={col.title} color={col.color}>
                            {tickets
                                .filter((t: any) => t.status === col.id)
                                .map((ticket: any) => (
                                    <TicketCard
                                        key={ticket.id}
                                        ticket={ticket}
                                        onClick={() => setSelectedTicketId(ticket.id)}
                                    />
                                ))}
                        </KanbanColumn>
                    ))}
                </div>
            </DndContext>

            {/* Chat Room Panel */}
            {selectedTicketId && (
                <div className="w-[400px] border-l border-white/10 bg-navy-main/95 backdrop-blur absolute right-0 top-0 bottom-0 z-20 shadow-2xl">
                    <TicketChatRoom
                        ticketId={selectedTicketId}
                        onClose={() => setSelectedTicketId(null)}
                    />
                </div>
            )}
        </div>
    );
};
