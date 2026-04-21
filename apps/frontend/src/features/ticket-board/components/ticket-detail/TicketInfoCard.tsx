import React from 'react';
import { Paperclip, Calendar, Clock } from 'lucide-react';
import { TicketDetail } from './types';
import { formatRelativeTime } from '@/lib/utils/dateFormat';

// Base URL for static files (uploads) - without /v1 prefix
const staticBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5050';

interface TicketInfoCardProps {
    ticket: TicketDetail;
}

export const TicketInfoCard: React.FC<TicketInfoCardProps> = ({ ticket }) => {
    // Truncate description if too long
    const maxLength = 200;
    const description = ticket.description || '';
    const truncatedDesc = description.length > maxLength
        ? description.substring(0, maxLength) + '...'
        : description;

    return (
        <div className="p-5 bg-transparent">
            {/* Description - Editorial Block */}
            <div className="flex flex-col md:flex-row md:items-start gap-4 justify-between">
                <div className="flex-1 min-w-0 border-l-[3px] border-slate-200 dark:border-[hsl(var(--border))] pl-4 py-1">
                    <p className="text-sm text-slate-900 dark:text-slate-200 leading-relaxed font-medium">
                        {truncatedDesc}
                    </p>
                </div>

                {/* Timestamps */}
                <div className="flex items-center gap-3 shrink-0 text-xs text-slate-500 font-medium mt-2 md:mt-0">
                    <span className="flex items-center gap-1.5 border border-slate-200 dark:border-[hsl(var(--border))] px-3 py-1.5 rounded-xl bg-white dark:bg-[hsl(var(--card))]">
                        <Calendar className="w-3.5 h-3.5" />
                        {formatRelativeTime(ticket.createdAt)}
                    </span>
                    <span className="flex items-center gap-1.5 border border-slate-200 dark:border-[hsl(var(--border))] px-3 py-1.5 rounded-xl bg-white dark:bg-[hsl(var(--card))]">
                        <Clock className="w-3.5 h-3.5" />
                        {formatRelativeTime(ticket.updatedAt)}
                    </span>
                </div>
            </div>

            {/* Attachments - Inline if any */}
            {ticket.messages && ticket.messages[0]?.attachments?.length > 0 && (
                <div className="flex items-center gap-2 mt-4 ml-5">
                    <Paperclip className="w-3.5 h-3.5 text-slate-400" />
                    <div className="flex gap-2 overflow-x-auto">
                        {ticket.messages[0].attachments.slice(0, 3).map((url, index) => (
                            <a
                                key={index}
                                href={`${staticBaseUrl}${url}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-primary hover:text-primary/80 font-medium hover:underline border border-slate-200 dark:border-[hsl(var(--border))] bg-white dark:bg-[hsl(var(--card))] px-3 py-1.5 rounded-xl truncate max-w-[120px] transition-colors"
                            >
                                {url.split('/').pop()}
                            </a>
                        ))}
                        {ticket.messages[0].attachments.length > 3 && (
                            <span className="text-[10px] text-slate-500 px-2 py-1">
                                +{ticket.messages[0].attachments.length - 3} more
                            </span>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
