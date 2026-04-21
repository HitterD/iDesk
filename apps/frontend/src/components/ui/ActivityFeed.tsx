import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, formatDistanceToNow } from 'date-fns';
import {
    Ticket,
    MessageSquare,
    UserPlus,
    CheckCircle2,
    AlertTriangle,
    Clock,
    ArrowRight,
    RefreshCw,
    Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { UserAvatar } from './UserAvatar';

// Activity types
type ActivityType =
    | 'ticket_created'
    | 'ticket_assigned'
    | 'ticket_resolved'
    | 'ticket_updated'
    | 'message_sent'
    | 'sla_warning'
    | 'sla_breach';

interface Activity {
    id: string;
    type: ActivityType;
    timestamp: string;
    user?: {
        id: string;
        fullName: string;
        avatarUrl?: string;
    };
    ticket?: {
        id: string;
        ticketNumber: string;
        title: string;
    };
    metadata?: Record<string, any>;
}

interface ActivityFeedProps {
    activities: Activity[];
    isLoading?: boolean;
    isLive?: boolean;
    maxItems?: number;
    className?: string;
    onActivityClick?: (activity: Activity) => void;
    onRefresh?: () => void;
}

const ACTIVITY_CONFIG: Record<ActivityType, {
    icon: React.ElementType;
    color: string;
    bgColor: string;
    label: string;
}> = {
    ticket_created: {
        icon: Ticket,
        color: 'text-blue-600',
        bgColor: 'bg-blue-100 dark:bg-blue-900/30',
        label: 'created a ticket',
    },
    ticket_assigned: {
        icon: UserPlus,
        color: 'text-purple-600',
        bgColor: 'bg-purple-100 dark:bg-purple-900/30',
        label: 'was assigned',
    },
    ticket_resolved: {
        icon: CheckCircle2,
        color: 'text-green-600',
        bgColor: 'bg-green-100 dark:bg-green-900/30',
        label: 'resolved',
    },
    ticket_updated: {
        icon: RefreshCw,
        color: 'text-slate-600',
        bgColor: 'bg-slate-100 dark:bg-slate-700',
        label: 'updated',
    },
    message_sent: {
        icon: MessageSquare,
        color: 'text-primary',
        bgColor: 'bg-primary/10',
        label: 'sent a message',
    },
    sla_warning: {
        icon: Clock,
        color: 'text-amber-600',
        bgColor: 'bg-amber-100 dark:bg-amber-900/30',
        label: 'SLA approaching',
    },
    sla_breach: {
        icon: AlertTriangle,
        color: 'text-red-600',
        bgColor: 'bg-red-100 dark:bg-red-900/30',
        label: 'SLA breached',
    },
};

const ActivityItem: React.FC<{
    activity: Activity;
    onClick?: () => void;
}> = ({ activity, onClick }) => {
    const config = ACTIVITY_CONFIG[activity.type];
    const Icon = config.icon;

    return (
        <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className={cn(
                'flex items-start gap-3 p-3 rounded-xl transition-colors cursor-pointer',
                'hover:bg-slate-50 dark:hover:bg-slate-700/50'
            )}
            onClick={onClick}
        >
            {/* Icon */}
            <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', config.bgColor)}>
                <Icon className={cn('w-4 h-4', config.color)} />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                    {activity.user && (
                        <>
                            <UserAvatar user={activity.user} size="xs" />
                            <span className="font-medium text-sm text-slate-800 dark:text-white">
                                {activity.user.fullName}
                            </span>
                        </>
                    )}
                    <span className="text-sm text-slate-500">{config.label}</span>
                </div>

                {activity.ticket && (
                    <div className="flex items-center gap-1 mt-1">
                        <span className="font-mono text-xs text-slate-400">
                            #{activity.ticket.ticketNumber}
                        </span>
                        <span className="text-sm text-slate-600 dark:text-slate-400 truncate">
                            {activity.ticket.title}
                        </span>
                    </div>
                )}

                <span className="text-xs text-slate-400 mt-1 block">
                    {(() => {
                        try {
                            if (!activity.timestamp) return 'Unknown time';
                            const date = new Date(activity.timestamp);
                            if (isNaN(date.getTime())) return 'Unknown time';
                            return formatDistanceToNow(date, { addSuffix: true });
                        } catch (e) {
                            return 'Unknown time';
                        }
                    })()}
                </span>
            </div>

            <ArrowRight className="w-4 h-4 text-slate-400 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
        </motion.div>
    );
};

export const ActivityFeed: React.FC<ActivityFeedProps> = ({
    activities,
    isLoading,
    isLive = false,
    maxItems = 20,
    className,
    onActivityClick,
    onRefresh,
}) => {
    const displayedActivities = activities.slice(0, maxItems);

    return (
        <div className={cn('bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden', className)}>
            {/* Header */}
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    {isLive && (
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                        </span>
                    )}
                    <h3 className="font-semibold text-slate-800 dark:text-white">
                        {isLive ? 'Live Activity' : 'Recent Activity'}
                    </h3>
                </div>

                {onRefresh && (
                    <button
                        onClick={onRefresh}
                        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                        title="Refresh"
                    >
                        <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
                    </button>
                )}
            </div>

            {/* Activity List */}
            <div className="max-h-96 overflow-y-auto">
                {isLoading && activities.length === 0 ? (
                    <div className="p-8 text-center text-slate-500">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                        Loading activities...
                    </div>
                ) : activities.length === 0 ? (
                    <div className="p-8 text-center text-slate-500">
                        <Zap className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                        No recent activity
                    </div>
                ) : (
                    <AnimatePresence mode="popLayout">
                        {displayedActivities.map((activity) => (
                            <ActivityItem
                                key={activity.id}
                                activity={activity}
                                onClick={() => onActivityClick?.(activity)}
                            />
                        ))}
                    </AnimatePresence>
                )}
            </div>

            {/* Footer */}
            {activities.length > maxItems && (
                <div className="px-4 py-2 border-t border-slate-200 dark:border-slate-700 text-center">
                    <button className="text-xs text-primary hover:underline">
                        View all {activities.length} activities
                    </button>
                </div>
            )}
        </div>
    );
};

// Hook for real-time activities - connects to actual WebSocket
export function useRealtimeActivities(enabled: boolean = true) {
    const [activities, setActivities] = useState<Activity[]>([]);
    const [isConnected, setIsConnected] = useState(false);

    const addActivity = useCallback((activity: Activity) => {
        setActivities(prev => [activity, ...prev].slice(0, 50));
    }, []);

    useEffect(() => {
        if (!enabled) return;

        // Dynamic import to avoid circular dependencies
        import('@/lib/socket').then(({ socket }) => {

            const handleConnect = () => setIsConnected(true);
            const handleDisconnect = () => setIsConnected(false);

            // Transform socket events to Activity format
            const handleTicketCreated = (data: any) => {
                const activity: Activity = {
                    id: `activity-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                    type: 'ticket_created',
                    timestamp: new Date().toISOString(),
                    user: data.user || data.createdBy || { id: 'unknown', fullName: 'System' },
                    ticket: {
                        id: data.id,
                        ticketNumber: data.ticketNumber || data.id?.slice(0, 8),
                        title: data.title || 'New ticket',
                    },
                };
                addActivity(activity);
            };

            const handleTicketUpdated = (data: any) => {
                const activity: Activity = {
                    id: `activity-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                    type: 'ticket_updated',
                    timestamp: new Date().toISOString(),
                    user: data.updatedBy || { id: 'unknown', fullName: 'System' },
                    ticket: {
                        id: data.id || data.ticketId,
                        ticketNumber: data.ticketNumber || data.id?.slice(0, 8),
                        title: data.title || 'Ticket updated',
                    },
                };
                addActivity(activity);
            };

            const handleTicketResolved = (data: any) => {
                const activity: Activity = {
                    id: `activity-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                    type: 'ticket_resolved',
                    timestamp: new Date().toISOString(),
                    user: data.resolvedBy || data.assignedTo || { id: 'unknown', fullName: 'System' },
                    ticket: {
                        id: data.id || data.ticketId,
                        ticketNumber: data.ticketNumber || data.id?.slice(0, 8),
                        title: data.title || 'Ticket resolved',
                    },
                };
                addActivity(activity);
            };

            const handleTicketAssigned = (data: any) => {
                const activity: Activity = {
                    id: `activity-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                    type: 'ticket_assigned',
                    timestamp: new Date().toISOString(),
                    user: data.assignedTo || { id: 'unknown', fullName: 'Agent' },
                    ticket: {
                        id: data.id || data.ticketId,
                        ticketNumber: data.ticketNumber || data.id?.slice(0, 8),
                        title: data.title || 'Ticket assigned',
                    },
                };
                addActivity(activity);
            };

            // Set initial connection state
            setIsConnected(socket.connected);

            // Subscribe to events
            socket.on('connect', handleConnect);
            socket.on('disconnect', handleDisconnect);
            socket.on('ticket:created', handleTicketCreated);
            socket.on('ticket:updated', handleTicketUpdated);
            socket.on('ticket:resolved', handleTicketResolved);
            socket.on('ticket:assigned', handleTicketAssigned);

            return () => {
                socket.off('connect', handleConnect);
                socket.off('disconnect', handleDisconnect);
                socket.off('ticket:created', handleTicketCreated);
                socket.off('ticket:updated', handleTicketUpdated);
                socket.off('ticket:resolved', handleTicketResolved);
                socket.off('ticket:assigned', handleTicketAssigned);
            };
        });
    }, [enabled, addActivity]);

    return {
        activities,
        isConnected,
        addActivity,
    };
}

export default ActivityFeed;
