import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
    Bell,
    Ticket,
    UserPlus,
    MessageSquare,
    AlertTriangle,
    Clock,
    Check,
    X,
    Calendar,
    FileText,
} from 'lucide-react';
import { useSocket } from '@/lib/socket';
import { useAuth } from '@/stores/useAuth';
import { cn } from '@/lib/utils';

interface InAppNotification {
    id: string;
    type: string;
    title: string;
    message: string;
    ticketId?: string;
    link?: string;
    createdAt: Date;
}

const NOTIFICATION_ICONS: Record<string, React.ElementType> = {
    TICKET_CREATED: Ticket,
    TICKET_ASSIGNED: UserPlus,
    TICKET_UPDATED: Ticket,
    TICKET_RESOLVED: Check,
    TICKET_REPLY: MessageSquare,
    TICKET_COMMENT: MessageSquare,
    MENTION: MessageSquare,
    SLA_WARNING: Clock,
    SLA_BREACHED: AlertTriangle,
    CONTRACT_EXPIRING: Calendar,
    CONTRACT_RENEWED: FileText,
    SYSTEM: Bell,
};

const NOTIFICATION_COLORS: Record<string, { bg: string; icon: string; border: string }> = {
    TICKET_CREATED: { bg: 'bg-blue-500/10', icon: 'text-blue-400', border: 'border-blue-500/30' },
    TICKET_ASSIGNED: { bg: 'bg-purple-500/10', icon: 'text-purple-400', border: 'border-purple-500/30' },
    TICKET_UPDATED: { bg: 'bg-sky-500/10', icon: 'text-sky-400', border: 'border-sky-500/30' },
    TICKET_RESOLVED: { bg: 'bg-green-500/10', icon: 'text-green-400', border: 'border-green-500/30' },
    TICKET_REPLY: { bg: 'bg-indigo-500/10', icon: 'text-indigo-400', border: 'border-indigo-500/30' },
    MENTION: { bg: 'bg-pink-500/10', icon: 'text-pink-400', border: 'border-pink-500/30' },
    SLA_WARNING: { bg: 'bg-amber-500/10', icon: 'text-amber-400', border: 'border-amber-500/30' },
    SLA_BREACHED: { bg: 'bg-red-500/10', icon: 'text-red-400', border: 'border-red-500/30' },
    CONTRACT_EXPIRING: { bg: 'bg-orange-500/10', icon: 'text-orange-400', border: 'border-orange-500/30' },
    SYSTEM: { bg: 'bg-slate-500/10', icon: 'text-slate-400', border: 'border-slate-500/30' },
};

// Duration to show notification (in ms)
const NOTIFICATION_DURATION = 5000;
// Max notifications to show at once
const MAX_VISIBLE_NOTIFICATIONS = 3;

interface NotificationToastProps {
    notification: InAppNotification;
    onClose: () => void;
    onClick: () => void;
    index: number;
}

const NotificationToast: React.FC<NotificationToastProps> = ({
    notification,
    onClose,
    onClick,
    index,
}) => {
    const Icon = NOTIFICATION_ICONS[notification.type] || Bell;
    const colors = NOTIFICATION_COLORS[notification.type] || NOTIFICATION_COLORS.SYSTEM;

    // Auto-dismiss after duration
    useEffect(() => {
        const timer = setTimeout(onClose, NOTIFICATION_DURATION);
        return () => clearTimeout(timer);
    }, [onClose]);

    return (
        <motion.div
            initial={{ opacity: 0, x: 400, scale: 0.8 }}
            animate={{
                opacity: 1,
                x: 0,
                scale: 1,
            }}
            exit={{
                opacity: 0,
                x: 400,
                scale: 0.8,
                transition: { duration: 0.2 }
            }}
            transition={{
                type: 'spring',
                stiffness: 400,
                damping: 30,
            }}
            className={cn(
                "pointer-events-auto w-[320px] sm:w-[360px] overflow-hidden shrink-0",
                "rounded-2xl backdrop-blur-xl",
                "border shadow-2xl shadow-black/20",
                "bg-white/90 dark:bg-slate-900/90",
                colors.border,
            )}
            style={{ zIndex: 100 - index }}
        >
            {/* Progress bar */}
            <motion.div
                initial={{ width: '100%' }}
                animate={{ width: '0%' }}
                transition={{ duration: NOTIFICATION_DURATION / 1000, ease: 'linear' }}
                className={cn("h-1", colors.icon.replace('text-', 'bg-'))}
            />

            <div
                onClick={onClick}
                className="cursor-pointer"
            >
                <div className="p-4 flex items-start gap-3">
                    {/* Icon */}
                    <div className={cn(
                        "shrink-0 w-10 h-10 rounded-xl flex items-center justify-center",
                        colors.bg
                    )}>
                        <Icon className={cn("w-5 h-5", colors.icon)} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 pt-0.5">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                            {notification.title}
                        </p>
                        <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 mt-0.5">
                            {notification.message}
                        </p>
                    </div>

                    {/* Close button */}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onClose();
                        }}
                        className="shrink-0 p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Tap to view hint */}
                <div className="px-4 pb-3 flex items-center justify-between">
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                        Tap to view
                    </span>
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                        Just now
                    </span>
                </div>
            </div>
        </motion.div>
    );
};

export const InAppNotificationToast: React.FC = () => {
    const navigate = useNavigate();
    const { socket } = useSocket();
    const { user } = useAuth();
    const [notifications, setNotifications] = useState<InAppNotification[]>([]);

    // Handle new notification
    const addNotification = useCallback((data: any) => {
        const notification: InAppNotification = {
            id: data.id || `${Date.now()}-${Math.random()}`,
            type: data.type || 'SYSTEM',
            title: data.title || 'New Notification',
            message: data.message || '',
            ticketId: data.ticketId,
            link: data.link,
            createdAt: new Date(),
        };

        setNotifications((prev) => {
            // Remove oldest if max reached
            const updated = [notification, ...prev];
            return updated.slice(0, MAX_VISIBLE_NOTIFICATIONS);
        });
    }, []);

    // Remove notification
    const removeNotification = useCallback((id: string) => {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, []);

    // Handle notification click
    const handleClick = useCallback((notification: InAppNotification) => {
        removeNotification(notification.id);

        // Navigate based on notification type
        if (notification.link) {
            navigate(notification.link);
        } else if (notification.ticketId) {
            const basePath = user?.role === 'USER' ? '/client/tickets' : '/tickets';
            navigate(`${basePath}/${notification.ticketId}`);
        }
    }, [navigate, removeNotification, user?.role]);

    // Listen for real-time notifications
    useEffect(() => {
        if (!socket || !user) return;

        const handleNewNotification = (data: any) => {
            // Only show if notification is for current user
            if (!data.userId || data.userId === user.id) {
                addNotification(data);
            }
        };

        // Listen to user-specific channel
        socket.on(`notification:${user.id}`, handleNewNotification);
        // Also listen to general notification event
        socket.on('notification:new', (data: any) => {
            if (data.userId === user.id) {
                addNotification(data.notification || data);
            }
        });

        return () => {
            socket.off(`notification:${user.id}`, handleNewNotification);
            socket.off('notification:new');
        };
    }, [socket, user, addNotification]);

    return (
        <div
            className="fixed top-4 right-4 z-[100] flex flex-col gap-3 pointer-events-none"
            aria-live="polite"
            aria-label="Notifications"
        >
            <AnimatePresence>
                {notifications.map((notification, index) => (
                    <NotificationToast
                        key={notification.id}
                        notification={notification}
                        index={index}
                        onClose={() => removeNotification(notification.id)}
                        onClick={() => handleClick(notification)}
                    />
                ))}
            </AnimatePresence>
        </div>
    );
};

export default InAppNotificationToast;
