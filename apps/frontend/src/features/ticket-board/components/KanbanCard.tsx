import React from 'react';
import { useDraggable } from '@dnd-kit/core';

interface Ticket {
    id: string;
    title: string;
    priority: 'LOW' | 'MEDIUM' | 'HIGH';
    assignee?: string;
}

interface KanbanCardProps {
    ticket: Ticket;
}

export const KanbanCard: React.FC<KanbanCardProps> = ({ ticket }) => {
    const { attributes, listeners, setNodeRef, transform } = useDraggable({
        id: ticket.id,
    });

    const style = transform
        ? {
            transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        }
        : undefined;

    const priorityColor =
        ticket.priority === 'HIGH'
            ? 'bg-red-500/20 border-red-500 text-red-500'
            : ticket.priority === 'MEDIUM'
                ? 'bg-warning/20 border-warning text-warning'
                : 'bg-primary/20 border-primary text-primary';

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            className={`p-4 mb-3 rounded-md border ${priorityColor} cursor-grab active:cursor-grabbing backdrop-blur-md`}
        >
            <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-mono opacity-70">{ticket.id}</span>
                <div className="w-2 h-2 rounded-full bg-current animate-pulse" />
            </div>
            <h4 className="font-bold text-sm mb-3 text-foreground">{ticket.title}</h4>
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-xs">
                        {ticket.assignee ? ticket.assignee[0] : '?'}
                    </div>
                </div>
                <span className="text-xs font-bold">{ticket.priority}</span>
            </div>
        </div>
    );
};
