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
        <div className="p-3 bg-white dark:bg-slate-900/30">
            {/* Description - Compact */}
            <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-700 dark:text-slate-300 leading-relaxed line-clamp-3">
                        {truncatedDesc}
                    </p>
                </div>

                {/* Timestamps - Compact Pills */}
                <div className="flex items-center gap-2 shrink-0 text-[10px] text-gray-500 dark:text-slate-500">
                    <span className="flex items-center gap-1 bg-gray-100 dark:bg-slate-800/50 border border-gray-200 dark:border-transparent px-2 py-1 rounded">
                        <Calendar className="w-3 h-3" />
                        {formatRelativeTime(ticket.createdAt)}
                    </span>
                    <span className="flex items-center gap-1 bg-gray-100 dark:bg-slate-800/50 border border-gray-200 dark:border-transparent px-2 py-1 rounded">
                        <Clock className="w-3 h-3" />
                        {formatRelativeTime(ticket.updatedAt)}
                    </span>
                </div>
            </div>

            {/* Attachments - Inline if any */}
            {ticket.messages && ticket.messages[0]?.attachments?.length > 0 && (
                <div className="flex items-center gap-2 mt-2">
                    <Paperclip className="w-3 h-3 text-slate-500" />
                    <div className="flex gap-1.5 overflow-x-auto">
                        {ticket.messages[0].attachments.slice(0, 3).map((url, index) => (
                            <a
                                key={index}
                                href={`${staticBaseUrl}${url}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] text-primary hover:underline bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-transparent px-2 py-1 rounded truncate max-w-[100px]"
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
