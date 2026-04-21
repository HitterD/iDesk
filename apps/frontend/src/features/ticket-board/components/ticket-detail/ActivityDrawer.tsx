/**
 * ActivityDrawer Component
 * 
 * A slide-out drawer for Activity History on mobile/tablet devices.
 * Replaces the hidden activity history column on smaller screens.
 */

import React from 'react';
import { History, X, ChevronRight } from 'lucide-react';
import { TicketDetail } from './types';
import { cn } from '@/lib/utils';
import { formatDateTime } from '@/lib/utils/dateFormat';

interface ActivityDrawerProps {
    ticket: TicketDetail;
    isOpen: boolean;
    onClose: () => void;
}

export const ActivityDrawer: React.FC<ActivityDrawerProps> = ({
    ticket,
    isOpen,
    onClose,
}) => {
    const systemMessages = ticket.messages
        ?.filter(m => m.isSystemMessage)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) || [];

    return (
        <>
            {/* Backdrop */}
            <div
                className={cn(
                    "fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity duration-300 xl:hidden",
                    isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
                )}
                onClick={onClose}
            />

            {/* Drawer */}
            <div
                className={cn(
                    "fixed right-0 top-0 h-full w-80 max-w-[85vw] bg-white dark:bg-slate-800 shadow-2xl z-50 transition-transform duration-300 ease-out xl:hidden",
                    isOpen ? "translate-x-0" : "translate-x-full"
                )}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-4 border-b border-slate-200 dark:border-slate-700">
                    <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center">
                            <History className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                        </div>
                        Activity History
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 overflow-y-auto h-[calc(100%-64px)] custom-scrollbar">
                    <div className="space-y-4 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-gradient-to-b before:from-primary/50 before:to-slate-200 dark:before:to-slate-700">
                        {systemMessages.map((message, index) => (
                            <div key={message.id} className="relative pl-8 animate-fade-in" style={{ animationDelay: `${index * 50}ms` }}>
                                <div className={`absolute left-0 top-1 w-6 h-6 rounded-full border-4 border-white dark:border-slate-800 flex items-center justify-center shadow-sm ${index === 0 ? 'bg-gradient-to-br from-primary to-primary/80' : 'bg-slate-100 dark:bg-slate-700'
                                    }`}>
                                    <div className={`w-2 h-2 rounded-full ${index === 0 ? 'bg-white' : 'bg-slate-400'}`}></div>
                                </div>
                                <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-3 border border-slate-100 dark:border-slate-700">
                                    <p className="text-slate-700 dark:text-slate-300 text-sm">
                                        {message.content.replace('System: ', '')}
                                    </p>
                                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 font-mono">
                                        {formatDateTime(message.createdAt)}
                                    </p>
                                </div>
                            </div>
                        ))}
                        {systemMessages.length === 0 && (
                            <div className="text-center py-8">
                                <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700 mx-auto mb-3 flex items-center justify-center">
                                    <History className="w-6 h-6 text-slate-400" />
                                </div>
                                <p className="text-slate-500 dark:text-slate-400 text-sm">No activity recorded</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

/**
 * ActivityDrawerTrigger Component
 * 
 * A floating button that opens the Activity Drawer on smaller screens.
 */
interface ActivityDrawerTriggerProps {
    onClick: () => void;
    activityCount: number;
}

export const ActivityDrawerTrigger: React.FC<ActivityDrawerTriggerProps> = ({
    onClick,
    activityCount,
}) => {
    return (
        <button
            onClick={onClick}
            className="fixed right-6 bottom-20 p-3 glass-card-elevated hover:glass-shadow-medium hover:scale-105 transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out z-40 group xl:hidden flex items-center gap-2"
            title="View Activity History"
        >
            <History className="w-5 h-5 text-slate-500 group-hover:text-primary transition-colors" />
            {activityCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-slate-900 text-xs font-bold rounded-full flex items-center justify-center">
                    {activityCount > 9 ? '9+' : activityCount}
                </span>
            )}
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300 hidden sm:inline">
                History
            </span>
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-primary transition-colors" />
        </button>
    );
};

export default ActivityDrawer;
