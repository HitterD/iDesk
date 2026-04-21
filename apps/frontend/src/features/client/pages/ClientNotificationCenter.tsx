import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    Bell, ArrowLeft, CheckCheck, Search, X, Volume2, VolumeX,
    ChevronLeft, ChevronRight, Inbox
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useNotificationCenter } from '../../notifications/hooks/useNotificationCenter';
import { NotificationItem } from '../../../components/notifications/NotificationItem';
import { NotificationSkeleton } from '../../../components/notifications/NotificationSkeleton';
import { groupNotificationsByDate } from '../../../components/notifications/utils/notification.utils';

export const ClientNotificationCenter: React.FC = () => {
    const navigate = useNavigate();
    const {
        // State
        readFilter, setReadFilter,
        searchQuery, setSearchQuery,
        isSelectionMode, setIsSelectionMode,
        selectedIds,
        currentPage, setCurrentPage,
        pageSize,
        soundEnabled,

        // Data & Mutations
        notifications,
        total,
        isLoading,
        isFetching,
        categoryCounts,
        markAllAsReadMutation,

        // Actions
        handleToggleSelect,
        handleSelectAll,
        handleBulkDelete,
        handleBulkMarkAsRead,
        handleMarkAsRead,
        handleDelete,
        toggleSound,
        handleViewDetails,
    } = useNotificationCenter();

    const groupedNotifications = useMemo(() => groupNotificationsByDate(notifications), [notifications]);
    
    const totalPages = Math.ceil(total / pageSize);
    const totalUnread = (categoryCounts?.CATEGORY_TICKET || 0) + 
                       (categoryCounts?.CATEGORY_RENEWAL || 0) + 
                       (categoryCounts?.CATEGORY_HARDWARE || 0) + 
                       (categoryCounts?.CATEGORY_ZOOM || 0) + 
                       (categoryCounts?.CATEGORY_EFORM || 0);

    const getFilterCount = (filter: 'all' | 'unread' | 'read') => {
        // For client view, they only see their own notifications, and total counts aren't split by category centrally here
        // But `total` from the query represents the filtered count. To get true counts we use the props
        let currentTotal = total + (readFilter === 'unread' ? (total - totalUnread > 0 ? total - totalUnread : 0) : 0); // Approximation since we don't have systemTotal in this hook directly without fetching. But wait, `useNotificationQueries` doesn't expose systemTotal. Let's just use total and totalUnread.
        // Actually, best to just hide the count for 'all' / 'read' if we don't have accurate systemTotal here, OR just use totalUnread.
        // Let's just use `totalUnread` for 'unread' and omit the others if not known, or compute it if `total` is the full total.
        // Looking at the hook, `total` is data.total from the paginated query, which changes when readFilter changes.
        // So we shouldn't use it for static counts. Let's just show `totalUnread` for the unread tab.
    };

    const renderEmptyState = () => (
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <div className="w-16 h-16 rounded-full bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center mb-6 border border-slate-100 dark:border-slate-700/50">
                {searchQuery ? <Search className="w-8 h-8 text-slate-300" /> : <Inbox className="w-8 h-8 text-slate-300" />}
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                {searchQuery ? 'No results found' : 'All caught up!'}
            </h3>
            <p className="text-sm text-slate-500 max-w-xs mx-auto">
                {searchQuery 
                    ? `We couldn't find any notifications matching "${searchQuery}".`
                    : "You don't have any notifications at the moment."}
            </p>
        </div>
    );

    return (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 pb-20 pt-8 animate-in fade-in duration-500">
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => navigate(-1)}
                        className="rounded-xl border border-slate-200 dark:border-slate-800 w-10 h-10"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                            Notifications
                        </h1>
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-0.5">
                            Client Service Updates
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={toggleSound}
                        className="rounded-xl border border-slate-200 dark:border-slate-800 w-10 h-10"
                    >
                        {soundEnabled ? <Volume2 className="w-4 h-4 text-primary" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
                    </Button>
                    
                    {totalUnread > 0 && (
                        <Button 
                            onClick={() => markAllAsReadMutation.mutate()}
                            disabled={markAllAsReadMutation.isPending}
                            className="rounded-xl px-4 h-10 font-bold gap-2 shadow-sm text-xs uppercase tracking-wider"
                        >
                            <CheckCheck className="w-4 h-4" />
                            Mark All Read
                        </Button>
                    )}
                </div>
            </div>

            {/* Main Content Area */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl overflow-hidden flex flex-col min-h-[500px]">
                {/* Toolbar */}
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search notifications..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 text-sm font-medium bg-slate-50 dark:bg-slate-800/50 border-none rounded-xl focus:ring-2 focus:ring-primary/20 transition-colors duration-150 placeholder:text-slate-400"
                        />
                    </div>

                    <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800/50 p-1 rounded-xl border border-slate-100 dark:border-slate-700/50">
                        {(['all', 'unread', 'read'] as const).map((filter) => (
                            <button
                                key={filter}
                                onClick={() => setReadFilter(filter)}
                                className={cn(
                                    "px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors duration-150 flex items-center gap-2",
                                    readFilter === filter 
                                        ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm" 
                                        : "text-slate-500 hover:text-slate-700"
                                )}
                            >
                                {filter}
                                {filter === 'unread' && totalUnread > 0 && (
                                    <span className={cn(
                                        "px-1.5 py-0.5 rounded-md text-[10px] bg-slate-100 dark:bg-slate-800",
                                        readFilter === filter ? "text-slate-900 dark:text-white font-black" : "text-slate-400"
                                    )}>
                                        {totalUnread}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* List Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                    {isLoading ? (
                        <div className="space-y-4">
                            {[1, 2, 3, 4].map(i => <NotificationSkeleton key={i} />)}
                        </div>
                    ) : notifications.length === 0 ? (
                        renderEmptyState()
                    ) : (
                        <div className="space-y-8">
                            {Object.entries(groupedNotifications).map(([dateGroup, items]) => (
                                items.length > 0 && (
                                    <div key={dateGroup} className="space-y-3">
                                        <div className="flex items-center gap-4 px-2">
                                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                                                {dateGroup}
                                            </span>
                                            <div className="h-px bg-slate-100 dark:bg-slate-800 flex-1" />
                                        </div>
                                        <div className="space-y-2">
                                            {items.map(notification => (
                                                <NotificationItem 
                                                    key={notification.id}
                                                    notification={notification}
                                                    isSelectionMode={isSelectionMode}
                                                    isSelected={selectedIds.has(notification.id)}
                                                    onSelect={handleToggleSelect}
                                                    onDelete={handleDelete}
                                                    onMarkRead={handleMarkAsRead}
                                                    onViewDetails={handleViewDetails}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )
                            ))}
                        </div>
                    )}
                </div>

                {/* Pagination Footer */}
                {!isLoading && total > pageSize && (
                    <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                            Page {currentPage} / {totalPages}
                        </span>
                        
                        <div className="flex items-center gap-1">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1 || isFetching}
                                className="rounded-xl h-8 border-slate-200 dark:border-slate-700"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </Button>
                            
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages || isFetching}
                                className="rounded-xl h-8 border-slate-200 dark:border-slate-700"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ClientNotificationCenter;
