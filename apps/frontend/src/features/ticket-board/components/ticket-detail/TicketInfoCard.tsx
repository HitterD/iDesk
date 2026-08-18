import React, { useState } from 'react';
import { Paperclip, Calendar, Clock, FileText, Image as ImageIcon, Download, ExternalLink, User, Building, Monitor, Laptop } from 'lucide-react';
import { TicketDetail } from './types';
import { formatRelativeTime, formatDateTimeID } from '@/lib/utils/dateFormat';
import { getAttachmentUrl, isImageUrl } from './utils';
import { cn } from '@/lib/utils';

interface TicketInfoCardProps {
    ticket: TicketDetail;
    onImageClick?: (url: string) => void;
    onPdfClick?: (url: string, filename: string) => void;
}

const DESCRIPTION_PREVIEW_LENGTH = 500;

export const TicketInfoCard: React.FC<TicketInfoCardProps> = ({ ticket, onImageClick, onPdfClick }) => {
    const [expanded, setExpanded] = useState(false);

    const description = ticket.description || '';
    const isTruncatable = description.length > DESCRIPTION_PREVIEW_LENGTH;
    const shownDesc = isTruncatable && !expanded
        ? `${description.substring(0, DESCRIPTION_PREVIEW_LENGTH)}…`
        : description;

    // Attachments from initial report
    const attachments = ticket.messages?.find(
        m => !m.isSystemMessage && m.attachments?.length > 0
    )?.attachments ?? [];

    const fileNameOf = (url: string, fallback: string): string => {
        const path = url.split(/[?#]/)[0];
        return decodeURIComponent(path.substring(path.lastIndexOf('/') + 1)) || fallback;
    };

    return (
        <div className="p-5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
            {/* Requester & Submission Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 mb-3.5 border-b border-slate-100 dark:border-slate-800/80">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-600/10 dark:bg-blue-500/20 border border-blue-500/20 text-blue-600 dark:text-blue-400 font-bold flex items-center justify-center text-sm shadow-xs shrink-0">
                        {ticket.user.fullName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-slate-900 dark:text-white">
                                {ticket.user.fullName}
                            </span>
                            <span className="text-xs text-slate-400 dark:text-slate-500">
                                ({ticket.user.email})
                            </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                            {ticket.user.department?.name && (
                                <span className="inline-flex items-center gap-1">
                                    <Building className="w-3 h-3 text-slate-400" />
                                    {ticket.user.department.name}
                                </span>
                            )}
                            {ticket.device && (
                                <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md font-mono text-[11px] text-slate-600 dark:text-slate-300">
                                    <Monitor className="w-3 h-3 text-slate-400" />
                                    {ticket.device}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3 text-xs text-slate-400 dark:text-slate-500 self-start sm:self-center">
                    <span className="flex items-center gap-1.5" title={`Created at: ${formatDateTimeID(ticket.createdAt)}`}>
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {formatRelativeTime(ticket.createdAt)}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1.5" title={`Updated at: ${formatDateTimeID(ticket.updatedAt)}`}>
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        updated {formatRelativeTime(ticket.updatedAt)}
                    </span>
                </div>
            </div>

            {/* Description Body */}
            <div className="space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Issue Description
                </div>
                <div className="p-4 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800">
                    <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap break-words">
                        {shownDesc || <span className="italic text-slate-400">No additional description provided.</span>}
                    </p>
                    {isTruncatable && (
                        <button
                            type="button"
                            onClick={() => setExpanded(v => !v)}
                            aria-expanded={expanded}
                            className="mt-2 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                        >
                            {expanded ? 'Show less' : 'Read full description'}
                        </button>
                    )}
                </div>
            </div>

            {/* Attachments Section */}
            {attachments.length > 0 && (
                <div className="mt-4 pt-3.5 border-t border-slate-100 dark:border-slate-800/80 space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        <Paperclip className="w-3.5 h-3.5" />
                        <span>Initial Attachments ({attachments.length})</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                        {attachments.map((url, index) => {
                            const fullUrl = getAttachmentUrl(url);
                            const name = fileNameOf(url, `Attachment ${index + 1}`);
                            const isImg = isImageUrl(url);
                            const isPdf = url.toLowerCase().endsWith('.pdf');

                            return (
                                <div
                                    key={index}
                                    className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600 transition-colors shadow-2xs group"
                                >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700/80 flex items-center justify-center text-slate-500 dark:text-slate-400 shrink-0">
                                            {isImg ? (
                                                <ImageIcon className="w-4 h-4 text-blue-500" />
                                            ) : isPdf ? (
                                                <FileText className="w-4 h-4 text-rose-500" />
                                            ) : (
                                                <FileText className="w-4 h-4 text-slate-400" />
                                            )}
                                        </div>
                                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[140px]" title={name}>
                                            {name}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-1 shrink-0">
                                        {isImg && onImageClick && (
                                            <button
                                                type="button"
                                                onClick={() => onImageClick(fullUrl)}
                                                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-blue-600 transition-colors"
                                                title="View Image"
                                            >
                                                <ExternalLink className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                        {isPdf && onPdfClick && (
                                            <button
                                                type="button"
                                                onClick={() => onPdfClick(fullUrl, name)}
                                                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-rose-600 transition-colors"
                                                title="Preview PDF"
                                            >
                                                <ExternalLink className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                        <a
                                            href={fullUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            download
                                            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
                                            title="Download Attachment"
                                        >
                                            <Download className="w-3.5 h-3.5" />
                                        </a>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};
