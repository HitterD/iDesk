import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
    Bell, 
    Ticket, 
    CalendarClock, 
    Check, 
    Trash2,
    UserPlus,
    MessageSquare,
    AlertTriangle,
    Clock,
    Calendar
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import api from '@/lib/api';
import { NotificationCategory, NotificationType, Notification, NotificationCountByCategory } from './types/notification.types';
import { getNotificationRedirectPath } from './utils/notificationRouter';

type TabValue = 'all' | 'tickets' | 'renewals';

// Icon mapping for notification types
const NOTIFICATION_ICONS: Record<string, React.ElementType> = {
    // Ticket types
    [NotificationType.TICKET_CREATED]: Ticket,
    [NotificationType.TICKET_ASSIGNED]: UserPlus,
    [NotificationType.TICKET_UPDATED]: Ticket,
    [NotificationType.TICKET_RESOLVED]: Check,
    [NotificationType.TICKET_CANCELLED]: Ticket,
    [NotificationType.TICKET_REPLY]: MessageSquare,
    [NotificationType.MENTION]: MessageSquare,
    [NotificationType.SLA_WARNING]: Clock,
    [NotificationType.SLA_BREACHED]: AlertTriangle,
    [NotificationType.SYSTEM]: Bell,
    // Renewal types
    [NotificationType.RENEWAL_D60_WARNING]: Calendar,
    [NotificationType.RENEWAL_D30_WARNING]: CalendarClock,
    [NotificationType.RENEWAL_D7_WARNING]: CalendarClock,
    [NotificationType.RENEWAL_D1_WARNING]: AlertTriangle,
    [NotificationType.RENEWAL_EXPIRED]: AlertTriangle,
};

// Color mapping for notification types
const getNotificationColor = (type: NotificationType): string => {
    switch (type) {
        case NotificationType.TICKET_ASSIGNED:
            return 'text-blue-500';
        case NotificationType.TICKET_RESOLVED:
            return 'text-green-500';
        case NotificationType.SLA_WARNING:
        case NotificationType.RENEWAL_D30_WARNING:
        case NotificationType.RENEWAL_D60_WARNING:
            return 'text-yellow-500';
        case NotificationType.SLA_BREACHED:
        case NotificationType.RENEWAL_D1_WARNING:
        case NotificationType.RENEWAL_EXPIRED:
            return 'text-red-500';
        case NotificationType.MENTION:
            return 'text-purple-500';
        case NotificationType.RENEWAL_D7_WARNING:
            return 'text-orange-500';
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

interface NotificationCenterProps {
    className?: string;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ className }) => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState<TabValue>('all');

    // Get category filter based on active tab
    const getCategoryFilter = (): NotificationCategory | undefined => {
        switch (activeTab) {
            case 'tickets':
                return NotificationCategory.CATEGORY_TICKET;
            case 'renewals':
                return NotificationCategory.CATEGORY_RENEWAL;
            default:
                return undefined;
        }
    };

    // Fetch notifications with category filter
    const { data: notifications = [], isLoading } = useQuery<Notification[]>({
        queryKey: ['notifications', 'center', activeTab],
        queryFn: async () => {
            const category = getCategoryFilter();
            const params = new URLSearchParams();
            if (category) params.set('category', category);
            params.set('limit', '50');
            
            const res = await api.get(`/notifications?${params}`);
            return res.data;
        },
    });

    // Fetch counts by category
    const { data: categoryCounts } = useQuery<NotificationCountByCategory>({
        queryKey: ['notifications', 'count', 'by-category'],
        queryFn: async () => {
            const res = await api.get('/notifications/count/by-category');
            return res.data;
        },
    });

    // Mark as read mutation
    const markAsReadMutation = useMutation({
        mutationFn: async (id: string) => {
            await api.patch(`/notifications/${id}/read`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
        },
    });

    // Mark all as read mutation
    const markAllAsReadMutation = useMutation({
        mutationFn: async () => {
            await api.post('/notifications/read-all');
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
        },
    });

    // Delete notification mutation
    const deleteNotificationMutation = useMutation({
        mutationFn: async (id: string) => {
            await api.delete(`/notifications/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
        },
    });

    const handleNotificationClick = async (notification: Notification) => {
        if (!notification.isRead) {
            markAsReadMutation.mutate(notification.id);
        }
        const path = getNotificationRedirectPath(notification);
        navigate(path);
    };

    const ticketCount = categoryCounts?.[NotificationCategory.CATEGORY_TICKET] || 0;
    const renewalCount = categoryCounts?.[NotificationCategory.CATEGORY_RENEWAL] || 0;
    const totalUnread = ticketCount + renewalCount;

    const renderNotificationList = () => {
        if (isLoading) {
            return (
                <div className="py-12 text-center">
                    <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
                    <p className="text-slate-400 text-sm mt-4">Loading notifications...</p>
                </div>
            );
        }

        if (notifications.length === 0) {
            return (
                <div className="py-12 text-center">
                    <Bell className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-500 dark:text-slate-400 text-sm">
                        No {activeTab === 'all' ? '' : activeTab.slice(0, -1)} notifications
                    </p>
                </div>
            );
        }

        return (
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {notifications.map((notification) => {
                    const Icon = NOTIFICATION_ICONS[notification.type] || Bell;
                    const iconColor = getNotificationColor(notification.type);
                    
                    return (
                        <div
                            key={notification.id}
                            onClick={() => handleNotificationClick(notification)}
                            className={`px-4 py-3 cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/50 group ${
                                !notification.isRead ? 'bg-primary/5 dark:bg-primary/10' : ''
                            }`}
                        >
                            <div className="flex gap-3">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                                    !notification.isRead 
                                        ? 'bg-primary/10' 
                                        : 'bg-slate-100 dark:bg-slate-700'
                                }`}>
                                    <Icon className={`w-5 h-5 ${iconColor}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2">
                                        <p className={`text-sm font-medium ${
                                            notification.isRead 
                                                ? 'text-slate-600 dark:text-slate-300' 
                                                : 'text-slate-800 dark:text-white'
                                        }`}>
                                            {notification.title}
                                        </p>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                deleteNotificationMutation.mutate(notification.id);
                                            }}
                                            className="text-slate-400 hover:text-red-500 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                                        {notification.message}
                                    </p>
                                    <div className="flex items-center gap-2 mt-2">
                                        <span className="text-[10px] text-slate-400">
                                            {formatTimeAgo(notification.createdAt)}
                                        </span>
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                                            notification.category === NotificationCategory.CATEGORY_RENEWAL
                                                ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400'
                                                : 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                                        }`}>
                                            {notification.category === NotificationCategory.CATEGORY_RENEWAL ? 'Renewal' : 'Ticket'}
                                        </span>
                                    </div>
                                </div>
                                {!notification.isRead && (
                                    <span className="w-2 h-2 bg-primary rounded-full shrink-0 mt-2" />
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div className={`bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden ${className}`}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
                <h2 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                    <Bell className="w-5 h-5" />
                    Notification Center
                    {totalUnread > 0 && (
                        <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full">
                            {totalUnread}
                        </span>
                    )}
                </h2>
                {totalUnread > 0 && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => markAllAsReadMutation.mutate()}
                        className="text-xs"
                    >
                        <Check className="w-4 h-4 mr-1" />
                        Mark all read
                    </Button>
                )}
            </div>

            {/* Tabs */}
            <div className="border-b border-slate-200 dark:border-slate-700">
                <div className="flex">
                    <button
                        onClick={() => setActiveTab('all')}
                        className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                            activeTab === 'all'
                                ? 'border-primary text-primary'
                                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                        }`}
                    >
                        <Bell className="h-4 w-4" />
                        All
                        {totalUnread > 0 && (
                            <span className="text-xs bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded-full">
                                {totalUnread}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab('tickets')}
                        className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                            activeTab === 'tickets'
                                ? 'border-primary text-primary'
                                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                        }`}
                    >
                        <Ticket className="h-4 w-4" />
                        Tickets
                        {ticketCount > 0 && (
                            <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded-full">
                                {ticketCount}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab('renewals')}
                        className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                            activeTab === 'renewals'
                                ? 'border-primary text-primary'
                                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                        }`}
                    >
                        <CalendarClock className="h-4 w-4" />
                        Renewals
                        {renewalCount > 0 && (
                            <span className="text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 px-1.5 py-0.5 rounded-full">
                                {renewalCount}
                            </span>
                        )}
                    </button>
                </div>
            </div>

            {/* Notification List */}
            <div className="h-[400px] overflow-y-auto">
                {renderNotificationList()}
            </div>
        </div>
    );
};

export default NotificationCenter;
