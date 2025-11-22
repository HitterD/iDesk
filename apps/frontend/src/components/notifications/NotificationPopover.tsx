import React, { useState, useEffect } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Bell, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useSocket } from '../../lib/socket';

interface Notification {
    id: number;
    message: string;
    time: string;
    isRead: boolean;
}

export const NotificationPopover: React.FC = () => {
    const { socket } = useSocket();
    const [notifications, setNotifications] = useState<Notification[]>([
        { id: 1, message: "Ticket #123 Updated", time: "2m ago", isRead: false },
        { id: 2, message: "New Agent Joined", time: "1h ago", isRead: true },
    ]);
    const [hasUnread, setHasUnread] = useState(true);

    useEffect(() => {
        if (!socket) return;

        const handleNewNotification = (data: { message: string }) => {
            const newNotification: Notification = {
                id: Date.now(),
                message: data.message,
                time: 'Just now',
                isRead: false,
            };

            setNotifications((prev) => [newNotification, ...prev]);
            setHasUnread(true);
            toast.info('New Notification', {
                description: data.message,
            });
        };

        socket.on('notification:new', handleNewNotification);

        return () => {
            socket.off('notification:new', handleNewNotification);
        };
    }, [socket]);

    const markAllAsRead = () => {
        setNotifications((prev) =>
            prev.map((n) => ({ ...n, isRead: true }))
        );
        setHasUnread(false);
    };

    return (
        <Popover.Root>
            <Popover.Trigger asChild>
                <button className="relative p-2 text-slate-400 hover:text-white transition-colors rounded-full hover:bg-white/5 outline-none">
                    <Bell className="w-6 h-6" />
                    {hasUnread && (
                        <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-neon-orange rounded-full border-2 border-navy-main" />
                    )}
                </button>
            </Popover.Trigger>
            <Popover.Portal>
                <Popover.Content
                    className="w-80 bg-navy-light border border-white/10 rounded-xl shadow-2xl p-4 mr-4 mt-2 z-50 animate-in fade-in zoom-in-95"
                    sideOffset={5}
                    align="end"
                >
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-white font-semibold">Notifications</h3>
                        <button
                            onClick={markAllAsRead}
                            className="text-xs text-neon-green hover:text-neon-green/80 flex items-center gap-1"
                        >
                            <Check className="w-3 h-3" />
                            Mark all read
                        </button>
                    </div>

                    <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                        {notifications.length === 0 ? (
                            <p className="text-slate-500 text-center py-4 text-sm">No notifications</p>
                        ) : (
                            notifications.map((notification) => (
                                <div
                                    key={notification.id}
                                    className={`p-3 rounded-lg transition-colors ${notification.isRead ? 'bg-transparent' : 'bg-white/5'
                                        } hover:bg-white/10`}
                                >
                                    <p className={`text-sm mb-1 ${notification.isRead ? 'text-slate-400' : 'text-white'}`}>
                                        {notification.message}
                                    </p>
                                    <p className="text-xs text-slate-500">{notification.time}</p>
                                </div>
                            ))
                        )}
                    </div>
                    <Popover.Arrow className="fill-navy-light" />
                </Popover.Content>
            </Popover.Portal>
        </Popover.Root>
    );
};
