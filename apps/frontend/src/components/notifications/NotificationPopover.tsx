import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as Popover from '@radix-ui/react-popover';
import { Bell, Settings } from 'lucide-react';
import { useSocket } from '../../lib/socket';
import { useAuth } from '../../stores/useAuth';
import api from '../../lib/api';
import { cn } from '@/lib/utils';
import { NotificationType, Notification } from './types/notification.types';
import { NOTIFICATION_ICONS } from './constants/notification.constants';
import { formatTimeAgo, stripEmoji } from './utils/notification.utils';
import { getNotificationRedirectPath, UserRole } from './utils/notificationRouter';

export const NotificationPopover: React.FC = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { socket } = useSocket();
    const { user } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const userRole = (user?.role || 'ADMIN') as UserRole;

    const { data: notifications = [] } = useQuery<Notification[]>({
        queryKey: ['notifications', 'popover'],
        queryFn: async () => {
            const res = await api.get('/notifications?limit=10');
            return res.data.data;
        },
        enabled: !!user,
        staleTime: 30000,
    });

    const { data: countData } = useQuery<{ count: number }>({
        queryKey: ['notifications', 'count'],
        queryFn: async () => {
            const res = await api.get('/notifications/count');
            return res.data;
        },
        enabled: !!user,
        staleTime: 30000,
    });

    const unreadCount = countData?.count || 0;

    const markAsReadMutation = useMutation({
        mutationFn: async (id: string) => {
            await api.patch(`/notifications/${id}/read`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
        },
    });

    useEffect(() => {
        if (!socket || !user) return;
        const handleNew = () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
        };
        socket.on(`notification:${user.id}`, handleNew);
        return () => {
            socket.off(`notification:${user.id}`, handleNew);
        };
    }, [socket, user, queryClient]);

    return (
        <Popover.Root open={isOpen} onOpenChange={setIsOpen}>
            <Popover.Trigger asChild>
                <button className="relative p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group">
                    <Bell className="w-5 h-5 text-slate-600 dark:text-slate-400 group-hover:text-primary transition-colors" />
                    {unreadCount > 0 && (
                        <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-primary text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white dark:border-slate-900">
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                    )}
                </button>
            </Popover.Trigger>

            <Popover.Portal>
                <Popover.Content 
                    className="w-80 md:w-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 animate-in zoom-in-95 duration-200" 
                    sideOffset={8}
                    align="end"
                >
                    <div className="flex items-center justify-between p-4 border-b border-slate-50 dark:border-slate-800">
                        <h3 className="font-bold text-slate-900 dark:text-white">Notifications</h3>
                        <Link 
                            to="/notifications" 
                            onClick={() => setIsOpen(false)}
                            className="text-xs font-bold text-primary hover:underline"
                        >
                            View All
                        </Link>
                    </div>

                    <div className="max-h-[400px] overflow-y-auto">
                        {notifications.length === 0 ? (
                            <div className="p-10 text-center">
                                <Bell className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                                <p className="text-sm text-slate-500">No notifications yet</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-50 dark:divide-slate-800">
                                {notifications.map(notification => {
                                    const Icon = NOTIFICATION_ICONS[notification.type] || NOTIFICATION_ICONS[NotificationType.SYSTEM];
                                    return (
                                        <div 
                                            key={notification.id}
                                            onClick={() => {
                                                if (!notification.isRead) markAsReadMutation.mutate(notification.id);
                                                navigate(getNotificationRedirectPath(notification, userRole));
                                                setIsOpen(false);
                                            }}
                                            className={cn(
                                                "p-4 flex gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors",
                                                !notification.isRead && "bg-primary/5"
                                            )}
                                        >
                                            <div className="shrink-0 w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400">
                                                <Icon className="w-5 h-5" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className={cn(
                                                    "text-sm font-bold truncate",
                                                    !notification.isRead ? "text-slate-900 dark:text-white" : "text-slate-500"
                                                )}>
                                                    {stripEmoji(notification.title)}
                                                </p>
                                                <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                                                    {notification.message}
                                                </p>
                                                <span className="text-[10px] text-slate-400 mt-1 block">
                                                    {formatTimeAgo(notification.createdAt)}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                    
                    <div className="p-3 border-t border-slate-50 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 text-center">
                        <Link 
                            to="/admin/settings" 
                            onClick={() => setIsOpen(false)}
                            className="text-xs font-medium text-slate-500 hover:text-primary flex items-center justify-center gap-1.5"
                        >
                            <Settings className="w-3.5 h-3.5" />
                            Notification Settings
                        </Link>
                    </div>
                </Popover.Content>
            </Popover.Portal>
        </Popover.Root>
    );
};
