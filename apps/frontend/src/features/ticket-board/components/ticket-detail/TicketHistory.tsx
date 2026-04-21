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
        <div className="h-full flex flex-col bg-transparent">
            {/* Header */}
            <div className="px-4 py-3 border-b border-slate-200 dark:border-[hsl(var(--border))] shrink-0">
                <h3 className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <History className="w-4 h-4" />
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
                            <div className={`absolute left-0 top-3 w-2 h-2 rounded-full ${index === 0
                                ? 'bg-[hsl(var(--primary))]'
                                : 'bg-slate-300 dark:bg-slate-600'
                                }`} />

                            {/* Content */}
                            <p className="text-[11px] text-slate-800 dark:text-slate-300 leading-snug font-medium">
                                {message.content.replace('System: ', '')}
                            </p>
                            <p className="text-[10px] text-slate-500 dark:text-slate-500 mt-0.5">
                                {formatRelativeTime(message.createdAt)}
                            </p>
                        </div>
                    ))
                ) : (
                    <div className="text-center py-6">
                        <History className="w-6 h-6 text-slate-400 dark:text-slate-700 mx-auto mb-1" />
                        <p className="text-[10px] text-slate-500 dark:text-slate-600">No activity</p>
                    </div>
                )}
            </div>
        </div>
    );
};
