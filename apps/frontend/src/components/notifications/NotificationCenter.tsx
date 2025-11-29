import { useState } from 'react';
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
    Calendar,
    CheckCheck,
    Inbox,
    Filter
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import api from '@/lib/api';
import { NotificationCategory, NotificationType, Notification, NotificationCountByCategory } from './types/notification.types';
import { getNotificationRedirectPath } from './utils/notificationRouter';

type TabValue = 'all' | 'tickets' | 'renewals';
type FilterValue = 'all' | 'unread' | 'read';

// Icon mapping for notification types
const NOTIFICATION_ICONS: Record<string, React.ElementType> = {
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
    [NotificationType.RENEWAL_D60_WARNING]: Calendar,
    [NotificationType.RENEWAL_D30_WARNING]: CalendarClock,
    [NotificationType.RENEWAL_D7_WARNING]: CalendarClock,
    [NotificationType.RENEWAL_D1_WARNING]: AlertTriangle,
    [NotificationType.RENEWAL_EXPIRED]: AlertTriangle,
};

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

export const NotificationCenter: React.FC = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState<TabValue>('all');
    const [readFilter, setReadFilter] = useState<FilterValue>('all');

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

    const { data: notifications = [], isLoading } = useQuery<Notification[]>({
        queryKey: ['notifications', 'center', activeTab, readFilter],
        queryFn: async () => {
            const category = getCategoryFilter();
            const params = new URLSearchParams();
            if (category) params.set('category', category);
            if (readFilter === 'unread') params.set('isRead', 'false');
            if (readFilter === 'read') params.set('isRead', 'true');
            params.set('limit', '100');
            
            const res = await api.get(`/notifications?${params}`);
            return res.data;
        },
        staleTime: 30000,
    });

    const { data: categoryCounts } = useQuery<NotificationCountByCategory>({
        queryKey: ['notifications', 'count', 'by-category'],
        queryFn: async () => {
            const res = await api.get('/notifications/count/by-category');
            return res.data;
        },
        staleTime: 30000,
    });

    const markAsReadMutation = useMutation({
        mutationFn: async (id: string) => {
            await api.patch(`/notifications/${id}/read`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
        },
    });

    const markAllAsReadMutation = useMutation({
        mutationFn: async () => {
            await api.post('/notifications/read-all');
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
        },
    });

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

    const StatCard = ({ 
        title, 
        count, 
        icon: Icon, 
        color, 
        bgColor,
        onClick,
        isActive 
    }: { 
        title: string; 
        count: number; 
        icon: React.ElementType; 
        color: string;
        bgColor: string;
        onClick: () => void;
        isActive: boolean;
    }) => (
        <button
            onClick={onClick}
            className={`flex-1 p-4 rounded-2xl border-2 transition-all hover:scale-[1.02] ${
                isActive 
                    ? `${bgColor} border-current ${color}` 
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
            }`}
        >
            <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isActive ? 'bg-white/20' : bgColor}`}>
                    <Icon className={`w-6 h-6 ${color}`} />
                </div>
                <div className="text-left">
                    <p className={`text-2xl font-bold ${isActive ? 'text-current' : 'text-slate-800 dark:text-white'}`}>
                        {count}
                    </p>
                    <p className={`text-sm ${isActive ? 'text-current opacity-80' : 'text-slate-500 dark:text-slate-400'}`}>
                        {title}
                    </p>
                </div>
            </div>
        </button>
    );

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
                    <p className="text-slate-400 text-sm mt-1">
                        {activeTab === 'all' ? 'You\'re all caught up!' : `No ${activeTab.slice(0, -1)} notifications`}
                    </p>
                </div>
            );
        }

        // Group notifications by date
        const groupedNotifications = groupNotificationsByDate(notifications);
        
        return (
            <div>
                {Array.from(groupedNotifications.entries()).map(([dateGroup, groupNotifications]) => (
                    <div key={dateGroup}>
                        {/* Date Group Header */}
                        <div className="sticky top-0 z-10 px-4 py-2 bg-slate-100 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-600">
                            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                {dateGroup}
                            </span>
                        </div>
                        
                        {/* Notifications in this group */}
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
                                                    <span className={`text-xs px-2 py-1 rounded-lg font-medium ${
                                                        notification.category === NotificationCategory.CATEGORY_RENEWAL
                                                            ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400'
                                                            : 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                                                    }`}>
                                                        {notification.category === NotificationCategory.CATEGORY_RENEWAL ? 'Renewal' : 'Ticket'}
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
        <div className="w-full space-y-6">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                            <Bell className="w-5 h-5 text-primary" />
                        </div>
                        Notification Center
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1 ml-13">
                        Stay updated with your tickets and renewals
                    </p>
                </div>
                {totalUnread > 0 && (
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

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatCard
                    title="Total Unread"
                    count={totalUnread}
                    icon={Bell}
                    color="text-slate-600 dark:text-slate-300"
                    bgColor="bg-slate-100 dark:bg-slate-700"
                    onClick={() => setActiveTab('all')}
                    isActive={activeTab === 'all'}
                />
                <StatCard
                    title="Ticket Updates"
                    count={ticketCount}
                    icon={Ticket}
                    color="text-blue-600"
                    bgColor="bg-blue-100 dark:bg-blue-900/30"
                    onClick={() => setActiveTab('tickets')}
                    isActive={activeTab === 'tickets'}
                />
                <StatCard
                    title="Renewal Alerts"
                    count={renewalCount}
                    icon={CalendarClock}
                    color="text-orange-600"
                    bgColor="bg-orange-100 dark:bg-orange-900/30"
                    onClick={() => setActiveTab('renewals')}
                    isActive={activeTab === 'renewals'}
                />
            </div>

            {/* Main Content */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
                {/* Toolbar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                    {/* Category Tabs */}
                    <div className="flex items-center gap-1 p-1 bg-slate-200/50 dark:bg-slate-700/50 rounded-xl">
                        <button
                            onClick={() => setActiveTab('all')}
                            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                                activeTab === 'all'
                                    ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-white shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                            }`}
                        >
                            <Bell className="h-4 w-4" />
                            All
                        </button>
                        <button
                            onClick={() => setActiveTab('tickets')}
                            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                                activeTab === 'tickets'
                                    ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-white shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                            }`}
                        >
                            <Ticket className="h-4 w-4" />
                            Tickets
                        </button>
                        <button
                            onClick={() => setActiveTab('renewals')}
                            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                                activeTab === 'renewals'
                                    ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-white shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                            }`}
                        >
                            <CalendarClock className="h-4 w-4" />
                            Renewals
                        </button>
                    </div>

                    {/* Read Filter */}
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

                {/* Notification List */}
                <div className="min-h-[500px] max-h-[calc(100vh-400px)] overflow-y-auto">
                    {renderNotificationList()}
                </div>

                {/* Footer */}
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

export default NotificationCenter;
