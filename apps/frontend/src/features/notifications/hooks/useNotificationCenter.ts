import { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/stores/useAuth';
import { Notification, NotificationCategory } from '../../../components/notifications/types/notification.types';
import { getNotificationRedirectPath, UserRole } from '../../../components/notifications/utils/notificationRouter';
import { useNotificationQueries } from './useNotificationQueries';
import { useSocket } from '@/lib/socket';
import { useSoundNotification } from '@/hooks/useSoundNotification';

export type TabValue = 'all' | 'tickets' | 'renewals' | 'hardware' | 'zoom' | 'eform';
export type FilterValue = 'all' | 'unread' | 'read';

export const useNotificationCenter = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { socket } = useSocket();
    const { playSound, enabled: soundEnabled, toggleSound } = useSoundNotification();
    const userRole = (user?.role || 'ADMIN') as UserRole;

    const [activeTab, setActiveTab] = useState<TabValue>('all');
    const [readFilter, setReadFilter] = useState<FilterValue>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize] = useState(20);

    const getCategoryFilter = (): NotificationCategory | undefined => {
        switch (activeTab) {
            case 'tickets': return NotificationCategory.CATEGORY_TICKET;
            case 'renewals': return NotificationCategory.CATEGORY_RENEWAL;
            case 'hardware': return NotificationCategory.CATEGORY_HARDWARE;
            case 'zoom': return NotificationCategory.CATEGORY_ZOOM;
            case 'eform': return NotificationCategory.CATEGORY_EFORM;
            default: return undefined;
        }
    };

    const {
        notifications,
        total,
        isLoading,
        isFetching,
        categoryCounts,
        totalCategoryCounts,
        markAsReadMutation,
        markAllAsReadMutation,
        deleteNotificationMutation,
        bulkDeleteMutation,
        bulkMarkAsReadMutation,
    } = useNotificationQueries({
        activeCategory: getCategoryFilter(),
        readFilter,
        page: currentPage,
        limit: pageSize
    });

    // Real-time updates via socket
    useEffect(() => {
        if (!socket || !user) return;

        const handleNewNotification = (data: any) => {
            // Play sound for new notification if enabled
            if (data.requiresAcknowledge) {
                playSound('CRITICAL');
            } else {
                playSound('MESSAGE');
            }
        };

        socket.on(`notification:${user.id}`, handleNewNotification);
        return () => {
            socket.off(`notification:${user.id}`, handleNewNotification);
        };
    }, [socket, user, playSound]);

    const filteredNotifications = useMemo(() => {
        if (!searchQuery.trim()) return notifications;
        const query = searchQuery.toLowerCase();
        return notifications.filter(n =>
            n.title.toLowerCase().includes(query) ||
            n.message.toLowerCase().includes(query)
        );
    }, [notifications, searchQuery]);

    const handleToggleSelect = useCallback((id: string, e?: React.MouseEvent) => {
        e?.stopPropagation();
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const handleSelectAll = useCallback(() => {
        if (selectedIds.size === filteredNotifications.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredNotifications.map(n => n.id)));
        }
    }, [filteredNotifications, selectedIds.size]);

    const handleBulkDelete = () => {
        bulkDeleteMutation.mutate(Array.from(selectedIds), {
            onSuccess: () => {
                setSelectedIds(new Set());
                setIsSelectionMode(false);
            }
        });
    }

    const handleBulkMarkAsRead = () => {
        bulkMarkAsReadMutation.mutate(Array.from(selectedIds), {
            onSuccess: () => {
                setSelectedIds(new Set());
            }
        });
    }

    const handleMarkAsRead = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        markAsReadMutation.mutate(id);
    }

    const handleDelete = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        deleteNotificationMutation.mutate(id);
    }

    const handleViewDetails = (notification: Notification) => {
        const path = getNotificationRedirectPath(notification, userRole);
        navigate(path);
    }

    // Reset page when tab or filter changes
    useEffect(() => {
        setCurrentPage(1);
    }, [activeTab, readFilter]);

    return {
        // State
        activeTab, setActiveTab,
        readFilter, setReadFilter,
        searchQuery, setSearchQuery,
        isSelectionMode, setIsSelectionMode,
        selectedIds, setSelectedIds,
        currentPage, setCurrentPage,
        pageSize,
        soundEnabled,

        // Data & Mutations
        notifications,
        total,
        filteredNotifications,
        isLoading,
        isFetching,
        categoryCounts,
        totalCategoryCounts,
        markAsReadMutation,
        markAllAsReadMutation,
        deleteNotificationMutation,
        bulkDeleteMutation,
        bulkMarkAsReadMutation,

        // Actions
        handleToggleSelect,
        handleSelectAll,
        handleBulkDelete,
        handleBulkMarkAsRead,
        handleMarkAsRead,
        handleDelete,
        toggleSound,
        handleViewDetails,
    };
};
