import React from 'react';
import { User, Building, Tag, Monitor, Paperclip, Calendar, Clock } from 'lucide-react';
import { TicketDetail } from './types';
import api from '@/lib/api';

interface TicketInfoCardProps {
    ticket: TicketDetail;
}

export const TicketInfoCard: React.FC<TicketInfoCardProps> = ({ ticket }) => {
    const formatDate = (dateString: string) => {
        if (!dateString) return 'N/A';
        return new Intl.DateTimeFormat('en-US', {
            dateStyle: 'medium',
            timeStyle: 'short',
            timeZone: 'Asia/Jakarta'
        }).format(new Date(dateString));
    };

    return (
        <div className="bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-800/90 rounded-2xl border border-slate-200/70 dark:border-slate-700/70 overflow-hidden shadow-lg shadow-slate-200/40 dark:shadow-slate-900/40">
            {/* Quick Info Bar */}
            <div className="flex flex-wrap items-center gap-3 px-6 py-4 bg-gradient-to-r from-slate-100/80 to-slate-50/80 dark:from-slate-900/60 dark:to-slate-800/60 border-b border-slate-200/60 dark:border-slate-700/60">
                <div className="flex items-center gap-2 text-sm bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
                    <User className="w-4 h-4 text-primary" />
                    <span className="text-slate-500 dark:text-slate-400">Requester:</span>
                    <span className="font-bold text-slate-800 dark:text-white">{ticket.user.fullName}</span>
                </div>
                <div className="flex items-center gap-2 text-sm bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
                    <Building className="w-4 h-4 text-blue-500" />
                    <span className="text-slate-500 dark:text-slate-400">Dept:</span>
                    <span className="font-bold text-slate-800 dark:text-white">{ticket.user.department?.name || 'N/A'}</span>
                </div>
                {ticket.category && (
                    <div className="flex items-center gap-2 text-sm bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
                        <Tag className="w-4 h-4 text-purple-500" />
                        <span className="font-medium text-slate-700 dark:text-slate-200">{ticket.category}</span>
                    </div>
                )}
                {ticket.device && (
                    <div className="flex items-center gap-2 text-sm bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
                        <Monitor className="w-4 h-4 text-cyan-500" />
                        <span className="font-medium text-slate-700 dark:text-slate-200">{ticket.device}</span>
                    </div>
                )}
            </div>

            {/* Description */}
            <div className="p-6">
                <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <div className="w-1 h-4 bg-gradient-to-b from-primary to-primary/50 rounded-full"></div>
                    Description
                </h3>
                <p className="text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">{ticket.description}</p>
            </div>

            {/* Attachments */}
            {ticket.messages && ticket.messages[0]?.attachments?.length > 0 && (
                <div className="px-6 pb-6">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <Paperclip className="w-4 h-4" />
                        Attachments ({ticket.messages[0].attachments.length})
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {ticket.messages[0].attachments.map((url, index) => (
                            <a
                                key={index}
                                href={`${api.defaults.baseURL}${url}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors group"
                            >
                                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                                    <Paperclip className="w-5 h-5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate group-hover:text-primary transition-colors">
                                        {url.split('/').pop()}
                                    </p>
                                    <p className="text-xs text-slate-400">Click to download</p>
                                </div>
                            </a>
                        ))}
                    </div>
                </div>
            )}

            {/* Timestamps */}
            <div className="flex items-center gap-6 px-6 py-4 bg-gradient-to-r from-slate-100/60 to-slate-50/60 dark:from-slate-900/50 dark:to-slate-800/50 border-t border-slate-200/50 dark:border-slate-700/50 text-xs">
                <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                    <Calendar className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                    Created: <span className="font-mono text-slate-600 dark:text-slate-300">{formatDate(ticket.createdAt)}</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                    <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                    Updated: <span className="font-mono text-slate-600 dark:text-slate-300">{formatDate(ticket.updatedAt)}</span>
                </div>
            </div>
        </div>
    );
};
