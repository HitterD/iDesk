import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CheckCircle, Loader2, X, ChevronRight } from 'lucide-react';
import { useSocket } from '@/lib/socket';
import { useAuth } from '@/stores/useAuth';
import { Button } from '@/components/ui/button';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { useHasPermission } from '@/hooks/usePermissions';

interface CriticalNotification {
    id: string;
    type: string;
    title: string;
    message: string;
    referenceId?: string;
    link?: string;
    createdAt: string;
    requiresAcknowledge: boolean;
    userId?: string;
    category?: any;
    ticketId?: string;
}

export const CriticalNotificationBanner: React.FC = () => {
    const navigate = useNavigate();
    const { socket } = useSocket();
    const { user } = useAuth();
    const [notifications, setNotifications] = useState<CriticalNotification[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isAcknowledging, setIsAcknowledging] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);
    const [isDismissed, setIsDismissed] = useState(false);

    // Check if user has permission to see renewal notifications via preset system
    const { hasPermission, isLoading: isPermissionLoading } = useHasPermission('renewal.view', 'view');

    // Fetch unacknowledged critical notifications on mount
    const fetchUnacknowledged = useCallback(async () => {
        if (!hasPermission) return;

        try {
            const res = await api.get<CriticalNotification[]>('/notifications/critical/unacknowledged');
            setNotifications(res.data);
            
            // Check if dismissed in this session
            const dismissed = sessionStorage.getItem('dismissed_critical_banner');
            if (dismissed === 'true') {
                setIsDismissed(true);
            }
        } catch (error) {
            console.error('Failed to fetch critical notifications:', error);
        } finally {
            setIsLoaded(true);
        }
    }, [hasPermission]);

    // Listen for new critical notifications
    useEffect(() => {
        if (!socket || !user || !hasPermission) return;

        const handleCriticalNotification = (data: CriticalNotification) => {
            // Only add if it's for this user and requires acknowledge
            if (data.userId === user.id && data.requiresAcknowledge) {
                setNotifications(prev => {
                    if (prev.find(n => n.id === data.id)) return prev;
                    return [data, ...prev];
                });
                
                // If a new critical notification comes in, un-dismiss the banner
                setIsDismissed(false);
                sessionStorage.removeItem('dismissed_critical_banner');

                // Play alert sound
                try {
                    const audio = new Audio('/sounds/critical-alert.mp3');
                    audio.volume = 0.5;
                    audio.play().catch(() => { /* Ignore autoplay errors */ });
                } catch { /* Ignore */ }
            }
        };

        const handleAcknowledged = (data: { notificationId: string }) => {
             setNotifications(prev => prev.filter(n => n.id !== data.notificationId));
             if (currentIndex >= notifications.length - 1) {
                 setCurrentIndex(0);
             }
        };

        socket.on('critical_notification', handleCriticalNotification);
        socket.on(`notification:acknowledged:${user.id}`, handleAcknowledged);

        return () => {
             socket.off('critical_notification', handleCriticalNotification);
             socket.off(`notification:acknowledged:${user.id}`, handleAcknowledged);
        };
    }, [socket, user, hasPermission, currentIndex, notifications.length]);

    // Fetch on mount
    useEffect(() => {
        fetchUnacknowledged();
    }, [fetchUnacknowledged]);

    // Handle acknowledge
    const handleAcknowledge = async (e: React.MouseEvent) => {
        e.stopPropagation(); // prevent clicking the banner background
        const currentNotification = notifications[currentIndex];
        if (!currentNotification) return;

        setIsAcknowledging(true);
        try {
            await api.post(`/notifications/${currentNotification.id}/acknowledge`);

            // Remove from list
            setNotifications(prev => prev.filter(n => n.id !== currentNotification.id));

            // Move to next or reset
            if (currentIndex >= notifications.length - 1) {
                setCurrentIndex(0);
            }
        } catch (error) {
            console.error('Failed to acknowledge:', error);
        } finally {
            setIsAcknowledging(false);
        }
    };

    // Handle go to details
    const handleGoToDetails = async () => {
        const currentNotification = notifications[currentIndex];
        if (!currentNotification) return;

        let targetPath = currentNotification.link;

        if (!targetPath) {
            try {
                const { getNotificationRedirectPath } = await import('./utils/notificationRouter');
                targetPath = getNotificationRedirectPath(currentNotification as any, user?.role as any);
            } catch {
                targetPath = '/dashboard';
            }
        }

        // Override to direct specific tabs in Renewal Hub
        if (currentNotification.type.includes('VPN') || currentNotification.title.includes('VPN')) {
            const prefix = user?.role === 'MANAGER' ? '/manager' : '';
            targetPath = `${prefix}/renewal?tab=vpn`;
        } else if (currentNotification.type.includes('D1') || currentNotification.type.includes('D7')) {
            const prefix = user?.role === 'MANAGER' ? '/manager' : '';
            targetPath = `${prefix}/renewal?tab=contracts`;
        }

        navigate(targetPath || '/dashboard');
    };

    const handleDismiss = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsDismissed(true);
        sessionStorage.setItem('dismissed_critical_banner', 'true');
    };

    // Don't render if no permission, still loading, dismissed, or no notifications
    if (isPermissionLoading || !hasPermission || !isLoaded || notifications.length === 0 || isDismissed) {
        return null;
    }

    const currentNotification = notifications[currentIndex];
    const isUrgent = currentNotification.type.includes('D1') || currentNotification.type.includes('D7') || currentNotification.type.includes('EXPIRED');

    return (
        <AnimatePresence>
            <motion.div
                initial={{ y: 100, opacity: 0, scale: 0.95 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ y: 100, opacity: 0, scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                className="fixed bottom-0 left-0 right-0 z-[9999] px-4 pb-6 lg:px-8 lg:pb-10 pointer-events-none flex justify-center"
            >
                <div 
                    onClick={handleGoToDetails}
                    className={cn(
                        "pointer-events-auto relative w-full max-w-5xl rounded-3xl border shadow-[0_20px_50px_rgba(0,0,0,0.2)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.4)] flex items-center overflow-hidden cursor-pointer group transition-all duration-300 hover:scale-[1.01] active:scale-[0.99] backdrop-blur-xl",
                        isUrgent 
                            ? "bg-red-50/90 dark:bg-red-950/90 border-red-200/50 dark:border-red-500/30 text-red-900 dark:text-red-50" 
                            : "bg-amber-50/90 dark:bg-amber-950/90 border-amber-200/50 dark:border-amber-500/30 text-amber-900 dark:text-amber-50"
                    )}
                >
                    {/* Animated Glow Border Effect */}
                    <div className={cn(
                        "absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none",
                        isUrgent ? "bg-gradient-to-r from-red-500/10 to-transparent" : "bg-gradient-to-r from-amber-500/10 to-transparent"
                    )} />

                    {/* Left Icon Area - Premium Circular Badge */}
                    <div className="flex shrink-0 items-center justify-center p-5 pl-6">
                        <div className={cn(
                            "w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-transform group-hover:rotate-3 group-hover:scale-110",
                            isUrgent 
                                ? "bg-red-100 dark:bg-red-500 text-red-600 dark:text-white shadow-red-500/20 dark:shadow-red-500/40" 
                                : "bg-amber-100 dark:bg-amber-500 text-amber-600 dark:text-white shadow-amber-500/20 dark:shadow-amber-500/40"
                        )}>
                            <AlertTriangle className={cn("w-6 h-6", isUrgent && "animate-pulse")} />
                        </div>
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 overflow-hidden relative flex flex-col justify-center py-5 px-2 min-h-[5rem]">
                        <div className="flex items-center gap-2 mb-1.5">
                            <span className={cn(
                                "text-[10px] font-black tracking-[0.2em] uppercase px-2 py-0.5 rounded-md",
                                isUrgent ? "bg-red-500/10 text-red-600 dark:text-red-400" : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                            )}>
                                {isUrgent ? 'URGENT ACTION REQUIRED' : 'ATTENTION NEEDED'}
                            </span>
                            {notifications.length > 1 && (
                                <span className="bg-slate-200/50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 text-[10px] px-2 py-0.5 rounded-full font-bold tabular-nums">
                                    {currentIndex + 1} of {notifications.length}
                                </span>
                            )}
                        </div>

                        {/* Title & Message with Better Hierarchy */}
                        <div className="w-full relative overflow-hidden group-hover:pause-animation">
                            <div className="flex items-center whitespace-nowrap animate-marquee-slow pr-12">
                                <span className="font-extrabold text-sm lg:text-base mr-3 tracking-tight">
                                    {currentNotification.title}:
                                </span>
                                <span className="text-slate-600 dark:text-slate-300 font-medium text-sm lg:text-base opacity-90 group-hover:opacity-100 transition-opacity">
                                    {currentNotification.message}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Right Actions Area - Refined with Glassmorphism */}
                    <div className="flex shrink-0 items-center justify-center gap-3 px-6 py-4 border-l border-slate-200/50 dark:border-slate-800/50 bg-slate-500/5 dark:bg-black/20">
                        <Button
                            onClick={handleAcknowledge}
                            disabled={isAcknowledging}
                            variant="default"
                            size="sm"
                            className={cn(
                                "font-bold rounded-2xl transition-all shrink-0 px-4 py-5 shadow-xl hover:shadow-2xl active:scale-95 border",
                                isUrgent 
                                    ? "bg-red-600 hover:bg-red-700 text-white border-red-500 shadow-red-500/20" 
                                    : "bg-amber-600 hover:bg-amber-700 text-white border-amber-500 shadow-amber-500/20"
                            )}
                        >
                            {isAcknowledging ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <div className="flex items-center gap-2">
                                    <CheckCircle className="w-4 h-4" />
                                    <span className="tracking-tight">ACKNOWLEDGE</span>
                                </div>
                            )}
                        </Button>

                        <div className="text-slate-400 dark:text-slate-500 group-hover:text-slate-900 dark:group-hover:text-white mx-1 transition-all group-hover:translate-x-1">
                            <ChevronRight className="w-6 h-6 hidden md:block" />
                        </div>

                        {/* Dismiss */}
                        <button 
                            onClick={handleDismiss}
                            className="p-2.5 text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-800/50 rounded-xl transition-all ml-1"
                            title="Dismiss temporarily"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                </div>
            </motion.div>
        </AnimatePresence>
    );
};

export default CriticalNotificationBanner;
