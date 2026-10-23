import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as Popover from '@radix-ui/react-popover';
import { Bell, BellRing, CheckCheck, Settings } from 'lucide-react';
import { useSocket } from '../../lib/socket';
import { useAuth } from '../../stores/useAuth';
import api from '../../lib/api';
import { cn } from '@/lib/utils';
import { NotificationType, Notification } from './types/notification.types';
import { CATEGORY_CONFIG, NOTIFICATION_ICONS } from './constants/notification.constants';
import { formatTimeAgo, stripEmoji } from './utils/notification.utils';
import { getNotificationCenterPath, getNotificationRedirectPath, UserRole } from './utils/notificationRouter';
import { useNotificationsReadSync } from '@/features/notifications/hooks/useMarkNotificationsRead';
import './notification-popover.css';

const PREVIEW_LIMIT = 12;
type Filter = 'all' | 'unread';

/** Bell in the topbar: the latest notifications, newest first, with unread ones marked and one-click "read all". */
export const NotificationPopover: React.FC = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { socket } = useSocket();
    const { user } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [filter, setFilter] = useState<Filter>('all');
    const userRole = (user?.role || 'ADMIN') as UserRole;
    useNotificationsReadSync();

    const { data: notifications = [], isLoading } = useQuery<Notification[]>({
        queryKey: ['notifications', 'popover', filter],
        queryFn: async () => {
            const res = await api.get(`/notifications?limit=${PREVIEW_LIMIT}${filter === 'unread' ? '&isRead=false' : ''}`);
            return res.data?.data ?? res.data ?? [];
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

    const markAllMutation = useMutation({
        mutationFn: async () => {
            await api.post('/notifications/read-all');
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

    const open = (notification: Notification) => {
        if (!notification.isRead) markAsReadMutation.mutate(notification.id);
        navigate(getNotificationRedirectPath(notification, userRole));
        setIsOpen(false);
    };

    return (
        <Popover.Root open={isOpen} onOpenChange={setIsOpen}>
            <Popover.Trigger asChild>
                <button
                    className="relative p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group"
                    aria-label={unreadCount > 0 ? `Notifikasi, ${unreadCount} belum dibaca` : 'Notifikasi'}
                >
                    <Bell className="w-5 h-5 text-slate-600 dark:text-slate-400 group-hover:text-primary transition-colors" />
                    {unreadCount > 0 && (
                        <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-primary text-white text-xs font-bold flex items-center justify-center rounded-full border-2 border-white dark:border-slate-900" aria-hidden="true">
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                    )}
                </button>
            </Popover.Trigger>

            <Popover.Portal>
                <Popover.Content className="np-panel" sideOffset={10} align="end" collisionPadding={12}>
                    <header className="np-head">
                        <h3>Notifikasi</h3>
                        {unreadCount > 0 && <span className="np-count">{unreadCount > 99 ? '99+' : unreadCount} baru</span>}
                        <button type="button" className="np-readall" onClick={() => markAllMutation.mutate()}
                            disabled={unreadCount === 0 || markAllMutation.isPending} title="Tandai semua dibaca">
                            <CheckCheck aria-hidden="true" />Tandai dibaca
                        </button>
                    </header>

                    <div className="np-seg" role="tablist" aria-label="Saring notifikasi">
                        {(['all', 'unread'] as const).map((value) => (
                            <button key={value} type="button" role="tab" aria-selected={filter === value}
                                className={cn(filter === value && 'is-active')} onClick={() => setFilter(value)}>
                                {value === 'all' ? 'Semua' : 'Belum dibaca'}
                            </button>
                        ))}
                    </div>

                    <div className="np-list">
                        {isLoading ? (
                            <div className="np-skeleton" aria-hidden="true"><i /><i /><i /></div>
                        ) : notifications.length === 0 ? (
                            <div className="np-empty">
                                <span><BellRing aria-hidden="true" /></span>
                                <b>{filter === 'unread' ? 'Semua sudah dibaca' : 'Belum ada notifikasi'}</b>
                                <small>Tiket dan pesan baru akan muncul di sini.</small>
                            </div>
                        ) : (
                            <ul>
                                {notifications.map((notification) => {
                                    const Icon = NOTIFICATION_ICONS[notification.type] || NOTIFICATION_ICONS[NotificationType.SYSTEM];
                                    const category = CATEGORY_CONFIG[notification.category]?.label ?? 'Sistem';
                                    const title = stripEmoji(notification.title);
                                    return (
                                        <li key={notification.id}>
                                            <button type="button" className={cn('np-item', !notification.isRead && 'is-unread')}
                                                data-cat={notification.category} onClick={() => open(notification)}>
                                                <span className="np-ico"><Icon aria-hidden="true" /></span>
                                                <span className="np-text">
                                                    <b>{title}</b>
                                                    <span>{notification.message}</span>
                                                    <small>{category} · {formatTimeAgo(notification.createdAt)}</small>
                                                </span>
                                                {!notification.isRead && <i className="np-dot" aria-label="Belum dibaca" />}
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>

                    <footer className="np-foot">
                        <Link to={getNotificationCenterPath(userRole)} onClick={() => setIsOpen(false)} className="np-all">
                            Lihat semua notifikasi
                        </Link>
                        {userRole !== 'USER' && (
                            <Link to="/settings/notifications" onClick={() => setIsOpen(false)} className="np-settings"
                                aria-label="Pengaturan notifikasi" title="Pengaturan notifikasi">
                                <Settings aria-hidden="true" />
                            </Link>
                        )}
                    </footer>
                </Popover.Content>
            </Popover.Portal>
        </Popover.Root>
    );
};
