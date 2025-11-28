import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { MessageSquare, Flame } from 'lucide-react';

interface Ticket {
    id: string;
    title: string;
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    status: string;
    isOverdue?: boolean;
    user: {
        fullName: string;
        jobTitle?: string;
        department?: {
            name: string;
            code: string;
        };
    };
}

interface TicketCardProps {
    ticket: Ticket;
    onClick: () => void;
}

const priorityColors = {
    LOW: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
    MEDIUM: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
    HIGH: 'bg-orange-500/20 text-orange-400 border-orange-500/50',
    CRITICAL: 'bg-red-500/20 text-red-400 border-red-500/50',
};

const TicketCardComponent: React.FC<TicketCardProps> = ({ ticket, onClick }) => {
    const { attributes, listeners, setNodeRef, transform } = useDraggable({
        id: ticket.id,
        data: { ticket },
    });

    const style = {
        transform: CSS.Translate.toString(transform),
    };

    const isOverdue = ticket.isOverdue;

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            onClick={onClick}
            className={`p-4 rounded-lg mb-3 cursor-grab active:cursor-grabbing transition-all shadow-lg group relative overflow-hidden
                ${isOverdue ? 'bg-red-900/20 border-2 border-red-500 animate-pulse' : 'bg-navy-main border border-white/10 hover:border-neon-green/50'}
            `}
        >
            {/* Neon Glow Effect on Hover */}
            <div className="absolute inset-0 bg-neon-green/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

            <div className="flex justify-between items-start mb-2 relative z-10">
                <div className="flex gap-2">
                    <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded border ${priorityColors[ticket.priority]
                            }`}
                    >
                        {ticket.priority}
                    </span>
                    {isOverdue && (
                        <span className="flex items-center text-[10px] font-bold px-2 py-0.5 rounded border bg-red-600 text-white border-red-500 animate-bounce">
                            <Flame className="w-3 h-3 mr-1" /> OVERDUE
                        </span>
                    )}
                </div>
                <span className="text-xs text-slate-500 font-mono">#{ticket.id.slice(0, 4)}</span>
            </div>

            <h4 className="text-sm font-medium text-white mb-3 line-clamp-2 relative z-10">
                {ticket.title}
            </h4>

            <div className="flex items-center justify-between text-xs text-slate-400 relative z-10">
                <div className="flex flex-col">
                    <div className="flex items-center mb-1">
                        <div className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center text-[10px] text-white mr-2">
                            {ticket.user.fullName.charAt(0)}
                        </div>
                        <span className="font-medium text-white">{ticket.user.fullName.split(' ')[0]}</span>
                    </div>
                    {(ticket.user.jobTitle || ticket.user.department) && (
                        <div className="text-[10px] text-slate-500 ml-7">
                            {ticket.user.jobTitle}
                            {ticket.user.jobTitle && ticket.user.department && ' • '}
                            {ticket.user.department?.code}
                        </div>
                    )}
                </div>
                <div className="flex items-center space-x-3">
                    <div className="flex items-center">
                        <MessageSquare className="w-3 h-3 mr-1" />
                        <span>2</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Memoize to prevent unnecessary re-renders when parent updates
export const TicketCard = React.memo(TicketCardComponent, (prevProps, nextProps) => {
    // Custom comparison - only re-render if ticket data or onClick changed
    return (
        prevProps.ticket.id === nextProps.ticket.id &&
        prevProps.ticket.status === nextProps.ticket.status &&
        prevProps.ticket.priority === nextProps.ticket.priority &&
        prevProps.ticket.isOverdue === nextProps.ticket.isOverdue &&
        prevProps.onClick === nextProps.onClick
    );
});
