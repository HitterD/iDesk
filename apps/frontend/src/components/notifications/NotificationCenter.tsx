import { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
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
    Wrench,
    Search,
    X,
    ExternalLink,
    Settings,
    ChevronDown,
    ChevronRight,
    Square,
    CheckSquare
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import api from '@/lib/api';
import { useAuth } from '@/stores/useAuth';
import { NotificationCategory, NotificationType, Notification, NotificationCountByCategory } from './types/notification.types';
import { getNotificationRedirectPath, UserRole } from './utils/notificationRouter';

type TabValue = 'all' | 'tickets' | 'renewals' | 'hardware';
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
    [NotificationType.HARDWARE_INSTALL_D1]: Wrench,
    [NotificationType.HARDWARE_INSTALL_D0]: Wrench,
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
    const { user } = useAuth();
    const userRole = (user?.role || 'ADMIN') as UserRole;
    const [activeTab, setActiveTab] = useState<TabValue>('all');
    const [readFilter, setReadFilter] = useState<FilterValue>('all');
    // P3-1: Search state
    const [searchQuery, setSearchQuery] = useState('');
    // P3-2: Expanded notification state
    const [expandedId, setExpandedId] = useState<string | null>(null);
    // P2-1: Bulk selection state
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    // P3-4: Collapsible date groups
    const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
    // P2-2: Focused notification for keyboard navigation
    const [focusedIndex, setFocusedIndex] = useState<number>(-1);

    const getCategoryFilter = (): NotificationCategory | undefined => {
        switch (activeTab) {
            case 'tickets':
                return NotificationCategory.CATEGORY_TICKET;
            case 'renewals':
                return NotificationCategory.CATEGORY_RENEWAL;
            case 'hardware':
                return NotificationCategory.CATEGORY_HARDWARE;
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

    // P3-1: Client-side search filtering
    const filteredNotifications = useMemo(() => {
        if (!searchQuery.trim()) return notifications;
        const query = searchQuery.toLowerCase();
        return notifications.filter(n =>
            n.title.toLowerCase().includes(query) ||
            n.message.toLowerCase().includes(query)
        );
    }, [notifications, searchQuery]);

    // P3-2: Toggle expand notification
    const handleNotificationExpand = useCallback((notification: Notification) => {
        if (!notification.isRead) {
            markAsReadMutation.mutate(notification.id);
        }
        setExpandedId(prev => prev === notification.id ? null : notification.id);
    }, [markAsReadMutation]);

    // Navigate to source
    const handleViewDetails = useCallback((notification: Notification) => {
        const path = getNotificationRedirectPath(notification, userRole);
        navigate(path);
    }, [navigate, userRole]);

    // P2-1: Bulk delete mutation
    const bulkDeleteMutation = useMutation({
        mutationFn: async (ids: string[]) => {
            await Promise.all(ids.map(id => api.delete(`/notifications/${id}`)));
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
            setSelectedIds(new Set());
            setIsSelectionMode(false);
        },
    });

    // P2-1: Bulk mark as read mutation
    const bulkMarkAsReadMutation = useMutation({
        mutationFn: async (ids: string[]) => {
            await Promise.all(ids.map(id => api.patch(`/notifications/${id}/read`)));
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
            setSelectedIds(new Set());
        },
    });

    // P2-1: Toggle selection
    const handleToggleSelect = useCallback((id: string, e?: React.MouseEvent) => {
        e?.stopPropagation();
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    // P2-1: Select/deselect all
    const handleSelectAll = useCallback(() => {
        if (selectedIds.size === filteredNotifications.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredNotifications.map(n => n.id)));
        }
    }, [filteredNotifications, selectedIds.size]);

    // P3-4: Toggle collapsed group
    const toggleGroupCollapse = useCallback((group: string) => {
        setCollapsedGroups(prev => {
            const next = new Set(prev);
            if (next.has(group)) next.delete(group);
            else next.add(group);
            return next;
        });
    }, []);

    // P2-2: Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

            switch (e.key) {
                case 'j': // Next item
                    e.preventDefault();
                    setFocusedIndex(prev => Math.min(prev + 1, filteredNotifications.length - 1));
                    break;
                case 'k': // Previous item
                    e.preventDefault();
                    setFocusedIndex(prev => Math.max(prev - 1, 0));
                    break;
                case 'Enter': // Expand/View
                    e.preventDefault();
                    if (focusedIndex >= 0 && focusedIndex < filteredNotifications.length) {
                        handleNotificationExpand(filteredNotifications[focusedIndex]);
                    }
                    break;
                case 'd': // Delete
                    if (focusedIndex >= 0 && focusedIndex < filteredNotifications.length) {
                        e.preventDefault();
                        deleteNotificationMutation.mutate(filteredNotifications[focusedIndex].id);
                    }
                    break;
                case 'r': // Mark as read
                    if (focusedIndex >= 0 && focusedIndex < filteredNotifications.length) {
                        e.preventDefault();
                        markAsReadMutation.mutate(filteredNotifications[focusedIndex].id);
                    }
                    break;
                case 'Escape': // Exit selection mode
                    if (isSelectionMode) {
                        e.preventDefault();
                        setIsSelectionMode(false);
                        setSelectedIds(new Set());
                    }
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [filteredNotifications, focusedIndex, handleNotificationExpand, deleteNotificationMutation, markAsReadMutation, isSelectionMode]);

    const ticketCount = categoryCounts?.[NotificationCategory.CATEGORY_TICKET] || 0;
    const renewalCount = categoryCounts?.[NotificationCategory.CATEGORY_RENEWAL] || 0;
    const hardwareCount = categoryCounts?.[NotificationCategory.CATEGORY_HARDWARE] || 0;
    const totalUnread = ticketCount + renewalCount + hardwareCount;

    // P1-2: Improved stat card with better contrast
    const StatCard = ({
        title,
        count,
        icon: Icon,
        color,
        bgColor,
        activeColor,
        onClick,
        isActive
    }: {
        title: string;
        count: number;
        icon: React.ElementType;
        color: string;
        bgColor: string;
        activeColor: string;
        onClick: () => void;
        isActive: boolean;
    }) => {
        // Mute colors when count is 0
        const isMuted = count === 0;
        const effectiveColor = isMuted ? 'text-slate-400 dark:text-slate-500' : color;
        const effectiveBgColor = isMuted ? 'bg-slate-100 dark:bg-slate-700/50' : bgColor;

        return (
            <button
                onClick={onClick}
                className={`flex-1 p-4 rounded-2xl border-2 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:-translate-y-1 ${isActive
                    ? `${activeColor} border-current shadow-lg ring-2 ring-white/20`
                    : 'glass-card border-slate-200/50 dark:border-slate-700/50 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
            >
                <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isActive
                        ? 'bg-white/30 dark:bg-white/10'
                        : effectiveBgColor
                        }`}>
                        <Icon className={`w-6 h-6 ${isActive ? 'text-white' : effectiveColor}`} />
                    </div>
                    <div className="text-left">
                        <p className={`text-2xl font-bold ${isActive ? 'text-white' : 'text-slate-800 dark:text-white'}`}>
                            {count}
                        </p>
                        <p className={`text-sm ${isActive ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'}`}>
                            {title}
                        </p>
                    </div>
                </div>
            </button>
        );
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

        if (filteredNotifications.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center py-16">
                    <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mb-4">
                        {searchQuery ? <Search className="w-10 h-10 text-slate-400" /> : <Inbox className="w-10 h-10 text-slate-400" />}
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 font-medium">
                        {searchQuery ? 'No results found' : 'No notifications'}
                    </p>
                    <p className="text-slate-400 text-sm mt-1">
                        {searchQuery
                            ? `Try a different search term`
                            : activeTab === 'all' ? 'You\'re all caught up!' : `No ${activeTab.slice(0, -1)} notifications`}
                    </p>
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="mt-3 text-sm text-primary hover:underline"
                        >
                            Clear search
                        </button>
                    )}
                </div>
            );
        }

        // Group notifications by date
        const groupedNotifications = groupNotificationsByDate(filteredNotifications);
        let notificationIndex = 0; // For staggered animations

        return (
            <div>
                {Array.from(groupedNotifications.entries()).map(([dateGroup, groupNotifications]) => {
                    const isCollapsed = collapsedGroups.has(dateGroup);

                    return (
                        <div key={dateGroup}>
                            {/* P1-4: Frosted Date Group Header + P3-4: Collapsible */}
                            <button
                                onClick={() => toggleGroupCollapse(dateGroup)}
                                className="sticky top-0 z-10 w-full px-4 py-2.5 backdrop-blur-md bg-white/80 dark:bg-slate-800/80 border-b border-slate-200/50 dark:border-slate-600/50 flex items-center justify-between hover:bg-white/90 dark:hover:bg-slate-800/90 transition-colors"
                            >
                                <div className="flex items-center gap-2">
                                    {isCollapsed ? (
                                        <ChevronRight className="w-4 h-4 text-slate-400" />
                                    ) : (
                                        <ChevronDown className="w-4 h-4 text-slate-400" />
                                    )}
                                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                        {dateGroup}
                                    </span>
                                </div>
                                <span className="text-xs text-slate-400 dark:text-slate-500">
                                    {groupNotifications.length} notification{groupNotifications.length !== 1 ? 's' : ''}
                                </span>
                            </button>

                            {/* Notifications in this group */}
                            {!isCollapsed && (
                                <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                                    {groupNotifications.map((notification) => {
                                        const Icon = NOTIFICATION_ICONS[notification.type] || Bell;
                                        const iconColor = getNotificationColor(notification.type);
                                        const isExpanded = expandedId === notification.id;
                                        const currentIndex = notificationIndex++;
                                        const isFocused = focusedIndex === filteredNotifications.findIndex(n => n.id === notification.id);
                                        const isSelected = selectedIds.has(notification.id);


                                        return (
                                            <div
                                                key={notification.id}
                                                onClick={() => isSelectionMode ? handleToggleSelect(notification.id) : handleNotificationExpand(notification)}
                                                style={{ animationDelay: `${currentIndex * 50}ms` }}
                                                className={`p-4 cursor-pointer transition-all duration-200 group animate-fade-in-up ${
                                                    // P2-2: Focused notification ring
                                                    isFocused ? 'ring-2 ring-primary ring-inset' : ''
                                                    } ${
                                                    // P2-1: Selected styling
                                                    isSelected ? 'bg-primary/10 dark:bg-primary/10' : ''
                                                    } ${
                                                    // P1-1: Urgent notification styling with red border and glow
                                                    (notification.type === NotificationType.SLA_BREACHED ||
                                                        notification.type === NotificationType.RENEWAL_EXPIRED)
                                                        ? 'border-l-4 border-red-500 bg-red-50 dark:bg-red-900/20 animate-critical-pulse hover:bg-red-100 dark:hover:bg-red-900/30'
                                                        : notification.type === NotificationType.RENEWAL_D1_WARNING
                                                            ? 'border-l-4 border-orange-500 bg-orange-50 dark:bg-orange-900/20 animate-high-priority hover:bg-orange-100 dark:hover:bg-orange-900/30'
                                                            : !notification.isRead
                                                                ? 'border-l-4 border-primary/50 bg-primary/5 dark:bg-primary/5 hover:bg-slate-50 dark:hover:bg-slate-700/30'
                                                                : 'border-l-4 border-transparent hover:bg-slate-50 dark:hover:bg-slate-700/30'
                                                    }`}
                                            >
                                                <div className="flex gap-4">
                                                    {/* P2-1: Selection checkbox */}
                                                    {isSelectionMode && (
                                                        <button
                                                            onClick={(e) => handleToggleSelect(notification.id, e)}
                                                            className="shrink-0 self-center"
                                                        >
                                                            {isSelected ? (
                                                                <CheckSquare className="w-5 h-5 text-primary" />
                                                            ) : (
                                                                <Square className="w-5 h-5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300" />
                                                            )}
                                                        </button>
                                                    )}
                                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${!notification.isRead
                                                        ? 'bg-primary/10'
                                                        : 'bg-slate-100 dark:bg-slate-700'
                                                        }`}>
                                                        <Icon className={`w-6 h-6 ${iconColor}`} />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div className="flex-1">
                                                                <div className="flex items-center gap-2">
                                                                    <p className={`font-semibold ${notification.isRead
                                                                        ? 'text-slate-600 dark:text-slate-300'
                                                                        : 'text-slate-800 dark:text-white'
                                                                        }`}>
                                                                        {notification.title}
                                                                    </p>
                                                                    {!notification.isRead && (
                                                                        <span className="w-2 h-2 bg-primary rounded-full shrink-0 animate-pulse-ring" />
                                                                    )}
                                                                </div>
                                                                {/* P3-2: Expandable message */}
                                                                <p className={`text-sm text-slate-500 dark:text-slate-400 mt-1 ${isExpanded ? '' : 'line-clamp-2'}`}>
                                                                    {notification.message}
                                                                </p>
                                                                {/* P3-2: View Details button when expanded */}
                                                                {isExpanded && (
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleViewDetails(notification);
                                                                        }}
                                                                        className="mt-3 flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                                                                    >
                                                                        <ExternalLink className="w-4 h-4" />
                                                                        View Details
                                                                    </button>
                                                                )}
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
                                                        {/* P2-1: Repositioned timestamp and badge to right side */}
                                                        <div className="flex items-center justify-end gap-2 mt-2">
                                                            <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${notification.category === NotificationCategory.CATEGORY_RENEWAL
                                                                ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300'
                                                                : notification.category === NotificationCategory.CATEGORY_HARDWARE
                                                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                                                                    : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                                                                }`}>
                                                                {notification.category === NotificationCategory.CATEGORY_RENEWAL
                                                                    ? 'Renewal'
                                                                    : notification.category === NotificationCategory.CATEGORY_HARDWARE
                                                                        ? 'Hardware'
                                                                        : 'Ticket'}
                                                            </span>
                                                            <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                                                                {formatTimeAgo(notification.createdAt)}
                                                            </span>
                                                            {/* P2-3: Always visible View button */}
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleViewDetails(notification);
                                                                }}
                                                                className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors ml-2"
                                                            >
                                                                View
                                                                <ExternalLink className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
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
                <div className="flex items-center gap-2">
                    {/* P3-2: Settings shortcut */}
                    <Link
                        to="/admin/settings"
                        className="p-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                        title="Notification Settings"
                    >
                        <Settings className="w-5 h-5" />
                    </Link>
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
            </div>

            {/* Stats Cards - P1-2: Enhanced with better contrast and active states */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    title="Total Unread"
                    count={totalUnread}
                    icon={Bell}
                    color="text-slate-700 dark:text-slate-200"
                    bgColor="bg-slate-200 dark:bg-slate-600"
                    activeColor="bg-gradient-to-r from-slate-700 to-slate-600 dark:from-slate-600 dark:to-slate-500 text-white"
                    onClick={() => setActiveTab('all')}
                    isActive={activeTab === 'all'}
                />
                <StatCard
                    title="Ticket Updates"
                    count={ticketCount}
                    icon={Ticket}
                    color="text-blue-600 dark:text-blue-400"
                    bgColor="bg-blue-100 dark:bg-blue-900/40"
                    activeColor="bg-gradient-to-r from-blue-600 to-blue-500 dark:from-blue-500 dark:to-blue-400 text-white"
                    onClick={() => setActiveTab('tickets')}
                    isActive={activeTab === 'tickets'}
                />
                <StatCard
                    title="Hardware Installation"
                    count={hardwareCount}
                    icon={Wrench}
                    color="text-emerald-600 dark:text-emerald-400"
                    bgColor="bg-emerald-100 dark:bg-emerald-900/40"
                    activeColor="bg-gradient-to-r from-emerald-600 to-emerald-500 dark:from-emerald-500 dark:to-emerald-400 text-white"
                    onClick={() => setActiveTab('hardware')}
                    isActive={activeTab === 'hardware'}
                />
                <StatCard
                    title="Renewal Alerts"
                    count={renewalCount}
                    icon={CalendarClock}
                    color="text-orange-600 dark:text-orange-400"
                    bgColor="bg-orange-100 dark:bg-orange-900/40"
                    activeColor="bg-gradient-to-r from-orange-600 to-orange-500 dark:from-orange-500 dark:to-orange-400 text-white"
                    onClick={() => setActiveTab('renewals')}
                    isActive={activeTab === 'renewals'}
                />
            </div>

            {/* Main Content - P1-1: Glass-morphic container */}
            <div className="glass-card rounded-2xl overflow-hidden">
                {/* Toolbar - P3-1: Added search input + P2-1: Selection mode toggle */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 border-b border-white/20 dark:border-white/10 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md">
                    {/* P2-1: Selection mode toggle */}
                    <button
                        onClick={() => {
                            setIsSelectionMode(!isSelectionMode);
                            if (isSelectionMode) setSelectedIds(new Set());
                        }}
                        className={`p-2.5 rounded-xl transition-all shrink-0 ${isSelectionMode
                            ? 'bg-primary text-slate-900'
                            : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                            }`}
                        title={isSelectionMode ? 'Exit selection mode' : 'Select multiple'}
                    >
                        {isSelectionMode ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                    </button>
                    {/* P3-1: Search Input */}
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search notifications..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-10 py-2 text-sm bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3">
                        {/* Current filter indicator */}
                        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                            <span className="px-2 py-1 bg-primary/10 text-primary rounded-lg font-semibold capitalize text-xs">
                                {activeTab === 'all' ? 'All' : activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
                            </span>
                            <span className="text-xs text-slate-400">
                                ({filteredNotifications.length})
                            </span>
                        </div>

                        {/* Read Filter - Visible toggle buttons */}
                        <div className="flex items-center gap-1 p-1 bg-slate-200/50 dark:bg-slate-700/50 rounded-xl">
                            <button
                                onClick={() => setReadFilter('all')}
                                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${readFilter === 'all'
                                    ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-white shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                    }`}
                            >
                                All
                            </button>
                            <button
                                onClick={() => setReadFilter('unread')}
                                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${readFilter === 'unread'
                                    ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-white shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                    }`}
                            >
                                Unread
                            </button>
                            <button
                                onClick={() => setReadFilter('read')}
                                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${readFilter === 'read'
                                    ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-white shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                    }`}
                            >
                                Read
                            </button>
                        </div>
                    </div>
                </div>

                {/* Notification List */}
                <div className="min-h-[500px] max-h-[calc(100vh-400px)] overflow-y-auto">
                    {renderNotificationList()}
                </div>

                {/* Footer */}
                {notifications.length > 0 && (
                    <div className="px-4 py-3 border-t border-white/20 dark:border-white/10 bg-white/30 dark:bg-slate-900/30 backdrop-blur-sm">
                        <p className="text-sm text-slate-500 dark:text-slate-400 text-center">
                            Showing {filteredNotifications.length}{searchQuery ? ` of ${notifications.length}` : ''} notifications
                            {isSelectionMode && selectedIds.size > 0 && (
                                <span className="ml-2 text-primary font-medium">
                                    • {selectedIds.size} selected
                                </span>
                            )}
                        </p>
                    </div>
                )}
            </div>

            {/* P2-1: Floating Bulk Action Bar */}
            {selectedIds.size > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-6 py-3 glass-card rounded-2xl shadow-2xl animate-slide-up">
                    <button
                        onClick={handleSelectAll}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white transition-colors"
                    >
                        {selectedIds.size === filteredNotifications.length ? (
                            <>
                                <X className="w-4 h-4" />
                                Deselect All
                            </>
                        ) : (
                            <>
                                <CheckSquare className="w-4 h-4" />
                                Select All
                            </>
                        )}
                    </button>
                    <div className="w-px h-6 bg-slate-200 dark:bg-slate-600" />
                    <button
                        onClick={() => bulkMarkAsReadMutation.mutate(Array.from(selectedIds))}
                        disabled={bulkMarkAsReadMutation.isPending}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-500 hover:bg-blue-600 text-white rounded-xl transition-colors disabled:opacity-50"
                    >
                        <Check className="w-4 h-4" />
                        Mark Read
                    </button>
                    <button
                        onClick={() => bulkDeleteMutation.mutate(Array.from(selectedIds))}
                        disabled={bulkDeleteMutation.isPending}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-red-500 hover:bg-red-600 text-white rounded-xl transition-colors disabled:opacity-50"
                    >
                        <Trash2 className="w-4 h-4" />
                        Delete ({selectedIds.size})
                    </button>
                    <button
                        onClick={() => {
                            setSelectedIds(new Set());
                            setIsSelectionMode(false);
                        }}
                        className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                        title="Cancel"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
            )}
        </div>
    );
};

export default NotificationCenter;
