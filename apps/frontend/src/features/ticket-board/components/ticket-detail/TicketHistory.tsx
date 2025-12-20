import React from 'react';
import { History } from 'lucide-react';
import { TicketDetail } from './types';
import { formatRelativeTime } from '@/lib/utils/dateFormat';

interface TicketHistoryProps {
    ticket: TicketDetail;
}

export const TicketHistory: React.FC<TicketHistoryProps> = ({ ticket }) => {
    const systemMessages = ticket.messages
        ?.filter(m => m.isSystemMessage)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) || [];

    return (
        <div className="h-full flex flex-col bg-slate-900/30">
            {/* Header */}
            <div className="px-3 py-2 border-b border-white/10 shrink-0">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <History className="w-3 h-3" />
                    Activity
                </h3>
            </div>

            {/* Timeline */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                {systemMessages.length > 0 ? (
                    systemMessages.map((message, index) => (
                        <div
                            key={message.id}
                            className="relative pl-4 py-1.5 group"
                        >
                            {/* Timeline dot */}
                            <div className={`absolute left-0 top-2.5 w-2 h-2 rounded-full ${index === 0
                                    ? 'bg-primary ring-2 ring-primary/30'
                                    : 'bg-slate-600'
                                }`} />

                            {/* Content */}
                            <p className="text-[11px] text-slate-300 leading-snug">
                                {message.content.replace('System: ', '')}
                            </p>
                            <p className="text-[9px] text-slate-500 mt-0.5">
                                {formatRelativeTime(message.createdAt)}
                            </p>
                        </div>
                    ))
                ) : (
                    <div className="text-center py-6">
                        <History className="w-6 h-6 text-slate-700 mx-auto mb-1" />
                        <p className="text-[10px] text-slate-600">No activity</p>
                    </div>
                )}
            </div>
        </div>
    );
};
