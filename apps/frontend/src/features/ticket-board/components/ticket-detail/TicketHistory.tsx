import React from 'react';
import { History } from 'lucide-react';
import { TicketDetail } from './types';

interface TicketHistoryProps {
    ticket: TicketDetail;
}

export const TicketHistory: React.FC<TicketHistoryProps> = ({ ticket }) => {
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
            <div className="px-6 py-4 border-b border-slate-200/60 dark:border-slate-700/60 bg-gradient-to-r from-slate-50/80 to-white/80 dark:from-slate-900/60 dark:to-slate-800/60">
                <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center">
                        <History className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                    </div>
                    Activity History
                </h3>
            </div>
            <div className="p-6">
                <div className="space-y-4 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-gradient-to-b before:from-primary/50 before:to-slate-200 dark:before:to-slate-700">
                    {ticket.messages
                        ?.filter(m => m.isSystemMessage)
                        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                        .map((message, index) => (
                            <div key={message.id} className="relative pl-8">
                                <div className={`absolute left-0 top-1 w-6 h-6 rounded-full border-4 border-white dark:border-slate-800 flex items-center justify-center shadow-sm ${index === 0 ? 'bg-gradient-to-br from-primary to-primary/80' : 'bg-slate-100 dark:bg-slate-700'
                                    }`}>
                                    <div className={`w-2 h-2 rounded-full ${index === 0 ? 'bg-white' : 'bg-slate-400'}`}></div>
                                </div>
                                <div className="bg-white dark:bg-slate-800 rounded-xl p-3 border border-slate-100 dark:border-slate-700 shadow-sm">
                                    <p className="text-slate-700 dark:text-slate-300 text-sm">
                                        {message.content.replace('System: ', '')}
                                    </p>
                                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 font-mono">
                                        {formatDate(message.createdAt)}
                                    </p>
                                </div>
                            </div>
                        ))}
                    {(!ticket.messages?.some(m => m.isSystemMessage)) && (
                        <p className="text-center text-slate-500 dark:text-slate-400 text-sm py-4">No activity recorded</p>
                    )}
                </div>
            </div>
        </div>
    );
};
