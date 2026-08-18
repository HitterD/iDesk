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
            {/* Timeline */}
            <div className="flex-1 overflow-y-auto p-4 max-w-2xl mx-auto w-full">
                {systemMessages.length > 0 ? (
                    <div className="relative space-y-4 before:absolute before:left-[5px] before:top-2 before:bottom-2 before:w-px before:bg-border">
                        {systemMessages.map((message, index) => (
                            <div key={message.id} className="relative pl-6">
                                {/* Timeline dot */}
                                <div className={`absolute left-0 top-1.5 w-[11px] h-[11px] rounded-full border-2 border-background ${index === 0
                                    ? 'bg-primary'
                                    : 'bg-slate-300 dark:bg-slate-600'
                                    }`} />

                                {/* Content */}
                                <p className="text-sm text-foreground leading-snug font-medium">
                                    {message.content.replace('System: ', '')}
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    {formatRelativeTime(message.createdAt)}
                                </p>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-12">
                        <History className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">No activity yet</p>
                    </div>
                )}
            </div>
        </div>
    );
};
