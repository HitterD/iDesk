import React from 'react';
import { ArrowLeft, Save } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { TicketDetail } from './types';
import { STATUS_CONFIG, PRIORITY_CONFIG } from './constants';

interface TicketHeaderProps {
    ticket: TicketDetail;
    onSave: () => void;
    isSaving: boolean;
}

export const TicketHeader: React.FC<TicketHeaderProps> = ({ ticket, onSave, isSaving }) => {
    const navigate = useNavigate();
    const statusConfig = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.TODO;
    const priorityConfig = PRIORITY_CONFIG[ticket.priority] || PRIORITY_CONFIG.MEDIUM;
    const StatusIcon = statusConfig.icon;

    return (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-white via-slate-50 to-white dark:from-slate-800 dark:via-slate-800/80 dark:to-slate-800 p-6 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50 backdrop-blur-sm">
            <div className="flex items-center gap-4">
                <button
                    onClick={() => navigate('/tickets/list')}
                    className="p-2.5 rounded-xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white transition-all shadow-sm hover:shadow-md hover:scale-105"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                    <div className="flex items-center gap-3 mb-1.5">
                        <span className="font-mono text-slate-500 dark:text-slate-400 text-sm bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded">#{ticket.ticketNumber || ticket.id.split('-')[0]}</span>
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold shadow-sm ${statusConfig.color}`}>
                            <StatusIcon className="w-3.5 h-3.5" />
                            {statusConfig.label}
                        </span>
                        <span className={`flex items-center gap-1.5 text-sm font-bold ${priorityConfig.color}`}>
                            <span className={`w-2.5 h-2.5 rounded-full ${priorityConfig.dot} shadow-sm`}></span>
                            {priorityConfig.label}
                        </span>
                    </div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-white drop-shadow-sm">{ticket.title}</h1>
                </div>
            </div>
            <button
                onClick={onSave}
                disabled={isSaving}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary to-primary/80 text-slate-900 font-bold rounded-xl hover:from-primary/90 hover:to-primary/70 transition-all shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 hover:scale-[1.02] active:scale-[0.98]"
            >
                <Save className="w-5 h-5" />
                {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
        </div>
    );
};
