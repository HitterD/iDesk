import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { KanbanCard } from './KanbanCard';

interface Ticket {
    id: string;
    title: string;
    priority: 'LOW' | 'MEDIUM' | 'HIGH';
    assignee?: string;
}

interface KanbanColumnProps {
    id: string;
    title: string;
    tickets: Ticket[];
}

export const KanbanColumn: React.FC<KanbanColumnProps> = ({ id, title, tickets }) => {
    const { setNodeRef } = useDroppable({
        id: id,
    });

    return (
        <div className="flex-1 min-w-[300px] bg-secondary/10 rounded-lg p-4 border border-border">
            <h3 className="font-bold text-lg mb-4 text-primary uppercase tracking-wider">
                {title} <span className="text-xs opacity-50 ml-2">({tickets.length})</span>
            </h3>
            <div ref={setNodeRef} className="min-h-[500px]">
                {tickets.map((ticket) => (
                    <KanbanCard key={ticket.id} ticket={ticket} />
                ))}
            </div>
        </div>
    );
};
