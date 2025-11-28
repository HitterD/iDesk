import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as Popover from '@radix-ui/react-popover';
import { Bell, Check, Ticket, UserPlus, MessageSquare, AlertTriangle, Clock, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useSocket } from '../../lib/socket';
import { useAuth } from '../../stores/useAuth';
import api from '../../lib/api';

interface Notification {
    id: string;
    type: string;
    title: string;
    message: string;
    ticketId?: string;
    link?: string;
    isRead: boolean;
    createdAt: string;
}

const NOTIFICATION_ICONS: Record<string, any> = {
    TICKET_CREATED: Ticket,
    TICKET_ASSIGNED: UserPlus,
    TICKET_UPDATED: Ticket,
    TICKET_RESOLVED: Check,
    TICKET_REPLY: MessageSquare,
    MENTION: MessageSquare,
    SLA_WARNING: Clock,
    SLA_BREACHED: AlertTriangle,
    SYSTEM: Bell,
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

export const NotificationPopover: React.FC = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { socket } = useSocket();
    const { user } = useAuth();
    const [isOpen, setIsOpen] = useState(false);

    // Fetch notifications - only poll when tab is visible
    const { data: notifications = [], refetch } = useQuery<Notification[]>({
        queryKey: ['notifications'],
        queryFn: async () => {
            const res = await api.get('/notifications?limit=20');
            return res.data;
        },
        enabled: !!user,
        staleTime: 30000, // Data is fresh for 30 seconds
        refetchInterval: () => {
            // Only poll if tab is visible
            return document.visibilityState === 'visible' ? 60000 : false;
        },
        refetchOnWindowFocus: true,
    });

    // Fetch unread count - with reduced polling
    const { data: countData } = useQuery<{ count: number }>({
        queryKey: ['notifications-count'],
        queryFn: async () => {
            const res = await api.get('/notifications/count');
            return res.data;
        },
        enabled: !!user,
        staleTime: 30000,
        refetchInterval: () => {
            return document.visibilityState === 'visible' ? 60000 : false;
        },
        refetchOnWindowFocus: true,
    });

    const unreadCount = countData?.count || 0;

    // Mark as read mutation
    const markAsReadMutation = useMutation({
        mutationFn: async (id: string) => {
            await api.patch(`/notifications/${id}/read`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
            queryClient.invalidateQueries({ queryKey: ['notifications-count'] });
        },
    });

    // Mark all as read mutation
    const markAllAsReadMutation = useMutation({
        mutationFn: async () => {
            await api.post('/notifications/read-all');
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
            queryClient.invalidateQueries({ queryKey: ['notifications-count'] });
        },
    });

    // Delete notification mutation
    const deleteNotificationMutation = useMutation({
        mutationFn: async (id: string) => {
            await api.delete(`/notifications/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
            queryClient.invalidateQueries({ queryKey: ['notifications-count'] });
        },
    });

    // Listen for real-time notifications
    useEffect(() => {
        if (!socket || !user) return;

        const handleNewNotification = (data: any) => {
            // Only process if notification is for current user
            if (data.userId === user.id || data.notification?.userId === user.id) {
                refetch();
                queryClient.invalidateQueries({ queryKey: ['notifications-count'] });

                const notification = data.notification || data;
                toast.info(notification.title || 'New Notification', {
                    description: notification.message,
                    action: notification.link ? {
                        label: 'View',
                        onClick: () => navigate(notification.link),
                    } : undefined,
                });
            }
        };

        // Listen to user-specific channel
        socket.on(`notification:${user.id}`, handleNewNotification);
        socket.on('notification:new', handleNewNotification);

        return () => {
            socket.off(`notification:${user.id}`, handleNewNotification);
            socket.off('notification:new', handleNewNotification);
        };
    }, [socket, user, refetch, queryClient, navigate]);

    const handleNotificationClick = async (notification: Notification) => {
        if (!notification.isRead) {
            markAsReadMutation.mutate(notification.id);
        }
        if (notification.link) {
            navigate(notification.link);
            setIsOpen(false);
        }
    };

    const getNotificationIcon = (type: string) => {
        const Icon = NOTIFICATION_ICONS[type] || Bell;
        return Icon;
    };

    const getNotificationColor = (type: string): string => {
        switch (type) {
            case 'TICKET_ASSIGNED':
                return 'text-blue-400';
            case 'TICKET_RESOLVED':
                return 'text-green-400';
            case 'SLA_WARNING':
                return 'text-yellow-400';
            case 'SLA_BREACHED':
                return 'text-red-400';
            case 'MENTION':
                return 'text-purple-400';
            default:
                return 'text-slate-400';
        }
    };

    return (
        <Popover.Root open={isOpen} onOpenChange={setIsOpen}>
            <Popover.Trigger asChild>
                <button className="relative p-2 text-slate-400 hover:text-white transition-colors rounded-full hover:bg-white/5 outline-none">
                    <Bell className="w-6 h-6" />
                    {unreadCount > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center px-1">
                            {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                    )}
                </button>
            </Popover.Trigger>
            <Popover.Portal>
                <Popover.Content
                    className="w-96 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden mr-4 mt-2 z-50 animate-in fade-in zoom-in-95"
                    sideOffset={5}
                    align="end"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                        <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                            <Bell className="w-4 h-4" />
                            Notifications
                            {unreadCount > 0 && (
                                <span className="text-xs bg-red-500 text-white px-1.5 py-0.5 rounded-full">
                                    {unreadCount}
                                </span>
                            )}
                        </h3>
                        {notifications.some(n => !n.isRead) && (
                            <button
                                onClick={() => markAllAsReadMutation.mutate()}
                                className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 font-medium"
                            >
                                <Check className="w-3 h-3" />
                                Mark all read
                            </button>
                        )}
                    </div>

                    {/* Notification List */}
                    <div className="max-h-[400px] overflow-y-auto">
                        {notifications.length === 0 ? (
                            <div className="py-12 text-center">
                                <Bell className="w-12 h-12 text-slate-200 dark:text-slate-600 mx-auto mb-3" />
                                <p className="text-slate-400 text-sm">No notifications yet</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100 dark:divide-slate-700">
                                {notifications.map((notification) => {
                                    const Icon = getNotificationIcon(notification.type);
                                    const iconColor = getNotificationColor(notification.type);
                                    return (
                                        <div
                                            key={notification.id}
                                            onClick={() => handleNotificationClick(notification)}
                                            className={`px-4 py-3 cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/50 ${!notification.isRead ? 'bg-primary/5 dark:bg-primary/10' : ''
                                                }`}
                                        >
                                            <div className="flex gap-3">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${!notification.isRead ? 'bg-primary/10' : 'bg-slate-100 dark:bg-slate-700'
                                                    }`}>
                                                    <Icon className={`w-4 h-4 ${iconColor}`} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-start justify-between gap-2">
                                                        <p className={`text-sm font-medium truncate ${notification.isRead
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
                                                            <Trash2 className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                                                        {notification.message}
                                                    </p>
                                                    <p className="text-[10px] text-slate-400 mt-1">
                                                        {formatTimeAgo(notification.createdAt)}
                                                    </p>
                                                </div>
                                                {!notification.isRead && (
                                                    <span className="w-2 h-2 bg-primary rounded-full shrink-0 mt-2" />
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    {notifications.length > 0 && (
                        <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                            <Link
                                to="/notifications"
                                onClick={() => setIsOpen(false)}
                                className="block text-xs text-primary font-medium hover:underline w-full text-center"
                            >
                                View all notifications
                            </Link>
                        </div>
                    )}
                </Popover.Content>
            </Popover.Portal>
        </Popover.Root>
    );
};
