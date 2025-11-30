import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
    Bell, 
    Ticket, 
    Check, 
    Trash2,
    UserPlus,
    MessageSquare,
    AlertTriangle,
    Clock,
    CheckCheck,
    Inbox,
    Filter,
    ArrowLeft
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import api from '@/lib/api';
import { useAuth } from '@/stores/useAuth';

interface Notification {
    id: string;
    type: string;
    category: string;
    title: string;
    message: string;
    ticketId?: string;
    link?: string;
    isRead: boolean;
    createdAt: string;
}

type FilterValue = 'all' | 'unread' | 'read';

const NOTIFICATION_ICONS: Record<string, React.ElementType> = {
    TICKET_CREATED: Ticket,
    TICKET_ASSIGNED: UserPlus,
    TICKET_UPDATED: Ticket,
    TICKET_RESOLVED: Check,
    TICKET_CANCELLED: Ticket,
    TICKET_REPLY: MessageSquare,
    MENTION: MessageSquare,
    SLA_WARNING: Clock,
    SLA_BREACHED: AlertTriangle,
    SYSTEM: Bell,
};

const getNotificationColor = (type: string): string => {
    switch (type) {
        case 'TICKET_ASSIGNED':
            return 'text-blue-500';
        case 'TICKET_RESOLVED':
            return 'text-green-500';
        case 'SLA_WARNING':
            return 'text-yellow-500';
        case 'SLA_BREACHED':
            return 'text-red-500';
        case 'MENTION':
            return 'text-purple-500';
        default:
            return 'text-slate-500';
    }
};

const formatTimeAgo = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
};

// Group notifications by date
const getDateGroup = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    if (date >= today) return 'Today';
    if (date >= yesterday) return 'Yesterday';
    if (date >= weekAgo) return 'This Week';
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
};

const groupNotificationsByDate = (notifications: Notification[]): Map<string, Notification[]> => {
    const groups = new Map<string, Notification[]>();
    
    notifications.forEach(notification => {
        const group = getDateGroup(notification.createdAt);
        const existing = groups.get(group) || [];
        groups.set(group, [...existing, notification]);
    });
    
    return groups;
};

export const ClientNotificationCenter: React.FC = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const [readFilter, setReadFilter] = useState<FilterValue>('all');

    const { data: notifications = [], isLoading } = useQuery<Notification[]>({
        queryKey: ['notifications', 'client', readFilter],
        queryFn: async () => {
            const params = new URLSearchParams();
            params.set('category', 'CATEGORY_TICKET'); // Only ticket notifications for users
            if (readFilter === 'unread') params.set('isRead', 'false');
            if (readFilter === 'read') params.set('isRead', 'true');
            params.set('limit', '100');
            
            const res = await api.get(`/notifications?${params}`);
            return res.data;
        },
        staleTime: 30000,
    });

    const { data: countData } = useQuery<{ count: number }>({
        queryKey: ['notifications-count'],
        queryFn: async () => {
            const res = await api.get('/notifications/count');
            return res.data;
        },
        staleTime: 30000,
    });

    const unreadCount = countData?.count || 0;

    const markAsReadMutation = useMutation({
        mutationFn: async (id: string) => {
            await api.patch(`/notifications/${id}/read`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
            queryClient.invalidateQueries({ queryKey: ['notifications-count'] });
        },
    });

    const markAllAsReadMutation = useMutation({
        mutationFn: async () => {
            await api.post('/notifications/read-all');
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
            queryClient.invalidateQueries({ queryKey: ['notifications-count'] });
        },
    });

    const deleteNotificationMutation = useMutation({
        mutationFn: async (id: string) => {
            await api.delete(`/notifications/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
            queryClient.invalidateQueries({ queryKey: ['notifications-count'] });
        },
    });

    const handleNotificationClick = async (notification: Notification) => {
        if (!notification.isRead) {
            markAsReadMutation.mutate(notification.id);
        }
        // Navigate to client ticket path
        if (notification.ticketId) {
            navigate(`/client/tickets/${notification.ticketId}`);
        } else {
            navigate('/client/my-tickets');
        }
    };

    const renderNotificationList = () => {
        if (isLoading) {
            return (
                <div className="flex flex-col items-center justify-center py-16">
                    <div className="animate-spin w-10 h-10 border-3 border-primary border-t-transparent rounded-full" />
                    <p className="text-slate-400 text-sm mt-4">Loading notifications...</p>
                </div>
            );
        }

        if (notifications.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center py-16">
                    <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mb-4">
                        <Inbox className="w-10 h-10 text-slate-400" />
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 font-medium">No notifications</p>
                    <p className="text-slate-400 text-sm mt-1">You're all caught up!</p>
                </div>
            );
        }

        const groupedNotifications = groupNotificationsByDate(notifications);

        return (
            <div>
                {Array.from(groupedNotifications.entries()).map(([dateGroup, groupNotifications]) => (
                    <div key={dateGroup}>
                        <div className="sticky top-0 z-10 px-4 py-2 bg-slate-100 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-600">
                            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                {dateGroup}
                            </span>
                        </div>
                        
                        <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                            {groupNotifications.map((notification) => {
                                const Icon = NOTIFICATION_ICONS[notification.type] || Bell;
                                const iconColor = getNotificationColor(notification.type);
                                
                                return (
                                    <div
                                        key={notification.id}
                                        onClick={() => handleNotificationClick(notification)}
                                        className={`p-4 cursor-pointer transition-all hover:bg-slate-50 dark:hover:bg-slate-700/30 group ${
                                            !notification.isRead ? 'bg-primary/5 dark:bg-primary/5' : ''
                                        }`}
                                    >
                                        <div className="flex gap-4">
                                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                                                !notification.isRead 
                                                    ? 'bg-primary/10' 
                                                    : 'bg-slate-100 dark:bg-slate-700'
                                            }`}>
                                                <Icon className={`w-6 h-6 ${iconColor}`} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2">
                                                            <p className={`font-semibold ${
                                                                notification.isRead 
                                                                    ? 'text-slate-600 dark:text-slate-300' 
                                                                    : 'text-slate-800 dark:text-white'
                                                            }`}>
                                                                {notification.title}
                                                            </p>
                                                            {!notification.isRead && (
                                                                <span className="w-2 h-2 bg-primary rounded-full shrink-0" />
                                                            )}
                                                        </div>
                                                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                                                            {notification.message}
                                                        </p>
                                                    </div>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            deleteNotificationMutation.mutate(notification.id);
                                                        }}
                                                        className="text-slate-400 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition-all"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                                <div className="flex items-center gap-3 mt-3">
                                                    <span className="text-xs text-slate-400 font-medium">
                                                        {formatTimeAgo(notification.createdAt)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <button
                    onClick={() => navigate(-1)}
                    className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                            <Bell className="w-5 h-5 text-primary" />
                        </div>
                        Notifications
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">
                        Stay updated with your ticket activities
                    </p>
                </div>
                {unreadCount > 0 && (
                    <Button
                        onClick={() => markAllAsReadMutation.mutate()}
                        disabled={markAllAsReadMutation.isPending}
                        className="bg-primary hover:bg-primary/90 text-slate-900 font-semibold gap-2"
                    >
                        <CheckCheck className="w-4 h-4" />
                        Mark all as read
                    </Button>
                )}
            </div>

            {/* Stats */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                            <Ticket className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-slate-800 dark:text-white">{unreadCount}</p>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Unread notifications</p>
                        </div>
                    </div>
                    
                    {/* Filter */}
                    <div className="flex items-center gap-2">
                        <Filter className="w-4 h-4 text-slate-400" />
                        <select
                            value={readFilter}
                            onChange={(e) => setReadFilter(e.target.value as FilterValue)}
                            className="text-sm bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/50"
                        >
                            <option value="all">All notifications</option>
                            <option value="unread">Unread only</option>
                            <option value="read">Read only</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Notification List */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="min-h-[400px] max-h-[calc(100vh-350px)] overflow-y-auto">
                    {renderNotificationList()}
                </div>

                {notifications.length > 0 && (
                    <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                        <p className="text-sm text-slate-500 dark:text-slate-400 text-center">
                            Showing {notifications.length} notifications
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ClientNotificationCenter;
