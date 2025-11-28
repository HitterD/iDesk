import React, { useState, useEffect } from 'react';
import { Timer, CheckCircle2, AlertCircle, Pause, AlertTriangle, Clock } from 'lucide-react';
import { TicketDetail } from './types';

interface SlaStatusCardProps {
    ticket: TicketDetail;
}

export const SlaStatusCard: React.FC<SlaStatusCardProps> = ({ ticket }) => {
    const [timeRemaining, setTimeRemaining] = useState<string>('');
    const [percentRemaining, setPercentRemaining] = useState<number>(100);

    useEffect(() => {
        const calculateTimeRemaining = () => {
            if (!ticket.slaTarget || ticket.status === 'RESOLVED') return;

            const now = new Date();
            const target = new Date(ticket.slaTarget);
            const diff = target.getTime() - now.getTime();

            if (diff <= 0) {
                setTimeRemaining('Overdue');
                setPercentRemaining(0);
                return;
            }

            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

            const parts = [];
            if (days > 0) parts.push(`${days}d`);
            if (hours > 0) parts.push(`${hours}h`);
            parts.push(`${minutes}m`);

            setTimeRemaining(parts.join(' '));

            // Calculate percentage (assuming max SLA is based on created time)
            const created = new Date(ticket.createdAt);
            const totalTime = target.getTime() - created.getTime();
            const elapsed = now.getTime() - created.getTime();
            const percent = Math.max(0, Math.min(100, ((totalTime - elapsed) / totalTime) * 100));
            setPercentRemaining(percent);
        };

        calculateTimeRemaining();
        const interval = setInterval(calculateTimeRemaining, 60000); // Update every minute

        return () => clearInterval(interval);
    }, [ticket]);

    const isResolved = ticket.status === 'RESOLVED';
    const isPaused = ticket.status === 'WAITING_VENDOR';
    const isOverdue = timeRemaining === 'Overdue';
    const isWarning = percentRemaining > 0 && percentRemaining < 25;

    const formatDate = (dateString: string) => {
        if (!dateString) return 'N/A';
        return new Intl.DateTimeFormat('en-US', {
            dateStyle: 'medium',
            timeStyle: 'short',
            timeZone: 'Asia/Jakarta'
        }).format(new Date(dateString));
    };

    // Determine status colors and icons
    let bgColor = 'bg-blue-50 dark:bg-blue-900/20';
    let borderColor = 'border-blue-200 dark:border-blue-800';
    let textColor = 'text-blue-700 dark:text-blue-400';
    let iconBg = 'bg-blue-100 dark:bg-blue-900/50';
    let iconColor = 'text-blue-600';
    let progressColor = 'bg-blue-500';
    let StatusIcon = Timer;
    let statusText = 'Time Remaining';

    if (isResolved) {
        bgColor = 'bg-green-50 dark:bg-green-900/20';
        borderColor = 'border-green-200 dark:border-green-800';
        textColor = 'text-green-700 dark:text-green-400';
        iconBg = 'bg-green-100 dark:bg-green-900/50';
        iconColor = 'text-green-600';
        progressColor = 'bg-green-500';
        StatusIcon = CheckCircle2;
        statusText = 'Resolved';
    } else if (isOverdue) {
        bgColor = 'bg-red-50 dark:bg-red-900/20';
        borderColor = 'border-red-200 dark:border-red-800';
        textColor = 'text-red-700 dark:text-red-400';
        iconBg = 'bg-red-100 dark:bg-red-900/50';
        iconColor = 'text-red-600';
        progressColor = 'bg-red-500';
        StatusIcon = AlertCircle;
        statusText = 'SLA Breached';
    } else if (isPaused) {
        bgColor = 'bg-orange-50 dark:bg-orange-900/20';
        borderColor = 'border-orange-200 dark:border-orange-800';
        textColor = 'text-orange-700 dark:text-orange-400';
        iconBg = 'bg-orange-100 dark:bg-orange-900/50';
        iconColor = 'text-orange-600';
        progressColor = 'bg-orange-500';
        StatusIcon = Pause;
        statusText = 'SLA Paused';
    } else if (isWarning) {
        bgColor = 'bg-yellow-50 dark:bg-yellow-900/20';
        borderColor = 'border-yellow-200 dark:border-yellow-800';
        textColor = 'text-yellow-700 dark:text-yellow-400';
        iconBg = 'bg-yellow-100 dark:bg-yellow-900/50';
        iconColor = 'text-yellow-600';
        progressColor = 'bg-yellow-500';
        StatusIcon = AlertTriangle;
        statusText = 'Almost Due';
    }

    return (
        <div className={`rounded-2xl p-6 border ${bgColor} ${borderColor}`}>
            <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${iconBg}`}>
                    <StatusIcon className={`w-6 h-6 ${iconColor}`} />
                </div>
                <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className={`text-lg font-bold ${textColor}`}>
                            {statusText}
                        </h3>
                        {!isResolved && timeRemaining && (
                            <span className={`text-2xl font-mono font-bold ${textColor}`}>
                                {timeRemaining}
                            </span>
                        )}
                    </div>

                    {/* Progress Bar */}
                    {!isResolved && !isPaused && ticket.slaTarget && (
                        <div className="mb-3">
                            <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                <div
                                    className={`h-full ${progressColor} transition-all duration-500`}
                                    style={{ width: `${percentRemaining}%` }}
                                />
                            </div>
                        </div>
                    )}

                    <div className="space-y-1 text-sm">
                        <p className="text-slate-600 dark:text-slate-300 flex items-center gap-2">
                            <Clock className="w-4 h-4 text-slate-400" />
                            <span className="text-slate-400">Target:</span>
                            <span className="font-mono font-medium">
                                {ticket.slaTarget ? formatDate(ticket.slaTarget) : 'Not set'}
                            </span>
                        </p>
                        {isResolved && (
                            <p className="text-slate-600 dark:text-slate-300 flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 text-green-500" />
                                <span className="text-slate-400">Resolved:</span>
                                <span className="font-mono font-medium">
                                    {formatDate(ticket.updatedAt)}
                                </span>
                            </p>
                        )}
                        {isPaused && (
                            <p className="text-orange-600 dark:text-orange-400 text-xs mt-2 flex items-center gap-1">
                                <Pause className="w-3 h-3" />
                                Timer paused while waiting for vendor
                            </p>
                        )}
                        {isOverdue && (
                            <p className="text-red-600 dark:text-red-400 text-xs mt-2 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                Resolution target has been exceeded
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
