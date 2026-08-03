import React, { useState } from 'react';
import { Paperclip, Calendar, Clock } from 'lucide-react';
import { TicketDetail } from './types';
import { formatRelativeTime } from '@/lib/utils/dateFormat';
import { getAttachmentUrl } from './utils';

interface TicketInfoCardProps {
    ticket: TicketDetail;
}

const DESCRIPTION_PREVIEW_LENGTH = 200;
const ATTACHMENT_PREVIEW_COUNT = 3;

export const TicketInfoCard: React.FC<TicketInfoCardProps> = ({ ticket }) => {
    const [expanded, setExpanded] = useState(false);

    const description = ticket.description || '';
    const isTruncatable = description.length > DESCRIPTION_PREVIEW_LENGTH;
    // Truncating with no way to read the rest hid the actual problem statement on
    // any ticket longer than a paragraph.
    const shownDesc = isTruncatable && !expanded
        ? `${description.substring(0, DESCRIPTION_PREVIEW_LENGTH)}…`
        : description;

    // The first message is often a system entry ("Ticket created") that carries no
    // files; the reporter's attachments live on the first real message.
    const attachments = ticket.messages?.find(
        m => !m.isSystemMessage && m.attachments?.length > 0
    )?.attachments ?? [];

    return (
        <div className="p-5 bg-transparent">
            {/* Description - Editorial Block */}
            <div className="flex flex-col md:flex-row md:items-start gap-4 justify-between">
                <div className="flex-1 min-w-0 border-l-[3px] border-slate-200 dark:border-[hsl(var(--border))] pl-4 py-1">
                    <p className="text-sm text-slate-900 dark:text-slate-200 leading-relaxed font-medium whitespace-pre-wrap break-words">
                        {shownDesc}
                    </p>
                    {isTruncatable && (
                        <button
                            type="button"
                            onClick={() => setExpanded(v => !v)}
                            aria-expanded={expanded}
                            className="mt-1 text-xs font-semibold text-primary hover:underline"
                        >
                            {expanded ? 'Show less' : 'Show more'}
                        </button>
                    )}
                </div>

                {/* Timestamps */}
                <div className="flex items-center gap-3 shrink-0 text-xs text-slate-500 font-medium mt-2 md:mt-0">
                    <span className="flex items-center gap-1.5 border border-slate-200 dark:border-[hsl(var(--border))] px-3 py-1.5 rounded-xl bg-white dark:bg-[hsl(var(--card))]" title="Created">
                        <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
                        {formatRelativeTime(ticket.createdAt)}
                    </span>
                    <span className="flex items-center gap-1.5 border border-slate-200 dark:border-[hsl(var(--border))] px-3 py-1.5 rounded-xl bg-white dark:bg-[hsl(var(--card))]" title="Last updated">
                        <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                        {formatRelativeTime(ticket.updatedAt)}
                    </span>
                </div>
            </div>

            {/* Attachments - Inline if any */}
            {attachments.length > 0 && (
                <div className="flex items-center gap-2 mt-4 ml-5">
                    <Paperclip className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                    <div className="flex gap-2 overflow-x-auto">
                        {attachments.slice(0, ATTACHMENT_PREVIEW_COUNT).map((url, index) => {
                            const name = decodeURIComponent(url.split(/[?#]/)[0].split('/').pop() || 'attachment');
                            return (
                                <a
                                    key={index}
                                    href={getAttachmentUrl(url)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title={name}
                                    className="text-xs text-primary hover:text-primary/80 font-medium hover:underline border border-slate-200 dark:border-[hsl(var(--border))] bg-white dark:bg-[hsl(var(--card))] px-3 py-1.5 rounded-xl truncate max-w-[120px] transition-colors"
                                >
                                    {name}
                                </a>
                            );
                        })}
                        {attachments.length > ATTACHMENT_PREVIEW_COUNT && (
                            <span className="text-[10px] text-slate-500 px-2 py-1">
                                +{attachments.length - ATTACHMENT_PREVIEW_COUNT} more
                            </span>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
