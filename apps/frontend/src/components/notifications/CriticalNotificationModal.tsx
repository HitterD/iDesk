import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Calendar, Clock, CheckCircle, Loader2, Volume2 } from 'lucide-react';
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
}

export const CriticalNotificationModal: React.FC = () => {
    const navigate = useNavigate();
    const { socket } = useSocket();
    const { user } = useAuth();
    const [notifications, setNotifications] = useState<CriticalNotification[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isAcknowledging, setIsAcknowledging] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);

    // Check if user has permission to see renewal notifications via preset system
    // This respects the 'renewal.view' permission from the agent preset configuration
    const { hasPermission, isLoading: isPermissionLoading } = useHasPermission('renewal.view', 'view');

    // Fetch unacknowledged critical notifications on mount
    const fetchUnacknowledged = useCallback(async () => {
        if (!hasPermission) return;

        try {
            const res = await api.get<CriticalNotification[]>('/notifications/critical/unacknowledged');
            setNotifications(res.data);
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
                    // Avoid duplicates
                    if (prev.find(n => n.id === data.id)) return prev;
                    return [data, ...prev];
                });

                // Play alert sound
                try {
                    const audio = new Audio('/sounds/critical-alert.mp3');
                    audio.volume = 0.5;
                    audio.play().catch(() => { /* Ignore autoplay errors */ });
                } catch { /* Ignore */ }
            }
        };

        socket.on('critical_notification', handleCriticalNotification);

        return () => {
            socket.off('critical_notification', handleCriticalNotification);
        };
    }, [socket, user, hasPermission]);

    // Fetch on mount
    useEffect(() => {
        fetchUnacknowledged();
    }, [fetchUnacknowledged]);

    // Handle acknowledge
    const handleAcknowledge = async () => {
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

    // Handle go to renewal page
    const handleGoToRenewal = () => {
        const currentNotification = notifications[currentIndex];
        if (currentNotification?.link) {
            navigate(currentNotification.link);
        }
    };

    // Don't render if no permission, still loading, or no notifications
    if (isPermissionLoading || !hasPermission || !isLoaded || notifications.length === 0) {
        return null;
    }

    const currentNotification = notifications[currentIndex];
    const isRenewalWarning = currentNotification.type.includes('RENEWAL');
    const isUrgent = currentNotification.type.includes('D1') || currentNotification.type.includes('D7');

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
            >
                {/* Backdrop - blocks everything */}
                <div className="absolute inset-0 bg-black/80 backdrop-blur-lg" />

                {/* Pulsing alert effect for urgent */}
                {isUrgent && (
                    <div className="absolute inset-0 animate-pulse">
                        <div className="absolute inset-0 bg-gradient-to-r from-red-900/20 via-transparent to-red-900/20" />
                    </div>
                )}

                {/* Modal */}
                <motion.div
                    initial={{ scale: 0.8, y: 50 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0.8, y: 50 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                    className={cn(
                        "relative w-full max-w-2xl rounded-3xl border-2 shadow-2xl overflow-hidden",
                        isUrgent
                            ? "bg-gradient-to-br from-red-950 via-red-900 to-orange-900 border-red-500/50"
                            : "bg-gradient-to-br from-orange-950 via-amber-900 to-yellow-900 border-orange-500/50"
                    )}
                >
                    {/* Header */}
                    <div className={cn(
                        "px-8 py-5 flex items-center gap-4",
                        isUrgent ? "bg-red-600" : "bg-orange-600"
                    )}>
                        <div className={cn(
                            "p-3 rounded-2xl",
                            isUrgent ? "bg-red-500/50" : "bg-orange-500/50"
                        )}>
                            {isUrgent ? (
                                <AlertTriangle className="w-8 h-8 text-white animate-pulse" />
                            ) : (
                                <Calendar className="w-8 h-8 text-white" />
                            )}
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-white">
                                {isUrgent ? '🚨 URGENT ACTION REQUIRED' : '⚠️ RENEWAL ATTENTION NEEDED'}
                            </h2>
                            <p className="text-white/80 text-sm">
                                {notifications.length} notification{notifications.length > 1 ? 's' : ''} pending acknowledgment
                            </p>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="p-8">
                        <div className="mb-6">
                            <h3 className="text-xl font-bold text-white mb-2">
                                {currentNotification.title}
                            </h3>
                            <p className="text-lg text-white/80 leading-relaxed">
                                {currentNotification.message}
                            </p>
                        </div>

                        {/* Time indicator */}
                        <div className="flex items-center gap-2 text-white/60 text-sm mb-8">
                            <Clock className="w-4 h-4" />
                            <span>Received: {new Date(currentNotification.createdAt).toLocaleString('id-ID')}</span>
                        </div>

                        {/* Pagination dots if multiple */}
                        {notifications.length > 1 && (
                            <div className="flex justify-center gap-2 mb-6">
                                {notifications.map((_, idx) => (
                                    <div
                                        key={idx}
                                        className={cn(
                                            "w-2 h-2 rounded-full transition-all",
                                            idx === currentIndex
                                                ? "w-6 bg-white"
                                                : "bg-white/30"
                                        )}
                                    />
                                ))}
                            </div>
                        )}

                        {/* Actions */}
                        <div className="space-y-3">
                            <Button
                                onClick={handleAcknowledge}
                                disabled={isAcknowledging}
                                className={cn(
                                    "w-full py-6 text-lg font-bold rounded-2xl transition-all",
                                    isUrgent
                                        ? "bg-white text-red-600 hover:bg-red-100"
                                        : "bg-white text-orange-600 hover:bg-orange-100"
                                )}
                            >
                                {isAcknowledging ? (
                                    <>
                                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                        Processing...
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle className="w-5 h-5 mr-2" />
                                        I ACKNOWLEDGE THIS ALERT
                                    </>
                                )}
                            </Button>

                            {isRenewalWarning && (
                                <Button
                                    onClick={handleGoToRenewal}
                                    variant="ghost"
                                    className="w-full py-4 text-white/80 hover:text-white hover:bg-white/10"
                                >
                                    <Calendar className="w-4 h-4 mr-2" />
                                    View Renewal Details
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Sound indicator */}
                    <div className="absolute top-4 right-4 text-white/40">
                        <Volume2 className="w-5 h-5" />
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default CriticalNotificationModal;
