import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { 
    Bell, CheckCheck, Settings, Search, X, Volume2, VolumeX, 
    ChevronLeft, ChevronRight, Inbox, HelpCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { NotificationCategory } from './types/notification.types';
import { useNotificationCenter } from '../../features/notifications/hooks/useNotificationCenter';
import { NotificationItem } from './NotificationItem';
import { NotificationSkeleton } from './NotificationSkeleton';
import { NotificationStatCard } from './NotificationStatCard';
import { groupNotificationsByDate } from './utils/notification.utils';

export const NotificationCenter: React.FC = () => {
    const {
        // State
        activeTab, setActiveTab,
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
        totalCategoryCounts,
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

    const systemTotal = (totalCategoryCounts?.CATEGORY_TICKET || 0) + 
                       (totalCategoryCounts?.CATEGORY_RENEWAL || 0) + 
                       (totalCategoryCounts?.CATEGORY_HARDWARE || 0) + 
                       (totalCategoryCounts?.CATEGORY_ZOOM || 0) + 
                       (totalCategoryCounts?.CATEGORY_EFORM || 0);

    const getFilterCount = (filter: 'all' | 'unread' | 'read') => {
        let currentTotal = systemTotal;
        let currentUnread = totalUnread;

        if (activeTab !== 'all') {
            const catField = activeTab === 'tickets' ? 'CATEGORY_TICKET' 
                            : activeTab === 'hardware' ? 'CATEGORY_HARDWARE'
                            : activeTab === 'renewals' ? 'CATEGORY_RENEWAL'
                            : activeTab === 'zoom' ? 'CATEGORY_ZOOM'
                            : 'CATEGORY_EFORM';
            currentTotal = totalCategoryCounts?.[catField as NotificationCategory] || 0;
            currentUnread = categoryCounts?.[catField as NotificationCategory] || 0;
        }

        if (filter === 'unread') return currentUnread;
        if (filter === 'read') return currentTotal - currentUnread;
        return currentTotal; // 'all'
    };

    const renderEmptyState = () => (
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <div className="w-20 h-20 rounded-full bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center mb-6 border border-slate-100 dark:border-slate-700/50">
                {searchQuery ? <Search className="w-10 h-10 text-slate-300" /> : <Inbox className="w-10 h-10 text-slate-300" />}
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                {searchQuery ? 'No results found' : 'All caught up!'}
            </h3>
            <p className="text-sm text-slate-500 max-w-xs mx-auto">
                {searchQuery 
                    ? `We couldn't find any notifications matching "${searchQuery}". Try a different term.`
                    : "You don't have any notifications at the moment. Check back later for updates."}
            </p>
            {searchQuery && (
                <Button 
                    variant="ghost" 
                    onClick={() => setSearchQuery('')}
                    className="mt-4 text-primary font-bold hover:bg-primary/5"
                >
                    Clear search
                </Button>
            )}
        </div>
    );

    return (
        <div className="w-full max-w-full flex flex-col h-full px-4 sm:px-6 lg:px-8 xl:px-10 py-6 space-y-6 animate-in fade-in duration-500 overflow-hidden">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="space-y-1">
                    <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                        Notification Center
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 font-medium">
                        Manage your alerts, ticket updates, and system notifications.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={toggleSound}
                        className="rounded-xl border-slate-200 dark:border-slate-700 w-11 h-11"
                        title={soundEnabled ? "Mute sounds" : "Unmute sounds"}
                    >
                        {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5 text-slate-400" />}
                    </Button>
                    
                    <Link to="/admin/settings">
                        <Button variant="outline" size="icon" className="rounded-xl border-slate-200 dark:border-slate-700 w-11 h-11">
                            <Settings className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                        </Button>
                    </Link>

                    {totalUnread > 0 && (
                        <Button 
                            onClick={() => markAllAsReadMutation.mutate()}
                            disabled={markAllAsReadMutation.isPending}
                            className="rounded-xl px-5 font-bold gap-2 shadow-sm"
                        >
                            <CheckCheck className="w-4 h-4" />
                            Mark all as read
                        </Button>
                    )}
                </div>
            </div>

            {/* Stats / Tabs Section */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 shrink-0">
                <button
                    onClick={() => setActiveTab('all')}
                    className={cn(
                        "relative flex-1 min-w-[140px] flex flex-col items-start p-5 rounded-2xl transition-colors duration-150 border-2 text-left group",
                        activeTab === 'all' 
                            ? "bg-slate-50 dark:bg-slate-800 border-primary shadow-lg shadow-primary/10 scale-[1.02]" 
                            : "bg-white dark:bg-slate-800/60 border-slate-100 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-md"
                    )}
                >
                    <div className="w-full flex justify-between items-start mb-4">
                        <div className={cn(
                            "p-2.5 rounded-xl transition-colors duration-300",
                            activeTab === 'all' 
                                ? "bg-white dark:bg-slate-900 text-primary shadow-sm" 
                                : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                        )}>
                            <Bell className="w-5 h-5" />
                        </div>
                        
                        {totalUnread > 0 && (
                            <span className={cn(
                                "px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide animate-in zoom-in duration-300",
                                activeTab === 'all' 
                                    ? "bg-rose-500 text-white shadow-md shadow-rose-500/20" 
                                    : "bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400"
                            )}>
                                {totalUnread} NEW
                            </span>
                        )}
                    </div>
                    
                    <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                            <span className={cn(
                                "text-3xl font-black tracking-tight leading-none",
                                activeTab === 'all' ? "text-primary" : "text-slate-900 dark:text-white group-hover:text-slate-700 dark:group-hover:text-slate-200"
                            )}>
                                {systemTotal}
                            </span>
                            {totalUnread > 0 && activeTab !== 'all' && (
                                <span className="flex h-2.5 w-2.5 rounded-full shadow-sm animate-pulse bg-rose-500" />
                            )}
                        </div>
                        
                        <span className={cn(
                            "text-xs font-bold uppercase tracking-wider mt-1",
                            activeTab === 'all' ? "text-primary/80 dark:text-primary/80" : "text-slate-500 dark:text-slate-400 group-hover:text-slate-600"
                        )}>
                            Total Alerts
                        </span>
                    </div>

                    {activeTab === 'all' && (
                        <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-10 h-1.5 bg-primary dark:bg-primary rounded-t-full" />
                    )}
                </button>

                <NotificationStatCard 
                    category={NotificationCategory.CATEGORY_TICKET}
                    count={totalCategoryCounts?.CATEGORY_TICKET || 0}
                    unreadCount={categoryCounts?.CATEGORY_TICKET || 0}
                    isActive={activeTab === 'tickets'}
                    onClick={() => setActiveTab('tickets')}
                />
                <NotificationStatCard 
                    category={NotificationCategory.CATEGORY_HARDWARE}
                    count={totalCategoryCounts?.CATEGORY_HARDWARE || 0}
                    unreadCount={categoryCounts?.CATEGORY_HARDWARE || 0}
                    isActive={activeTab === 'hardware'}
                    onClick={() => setActiveTab('hardware')}
                />
                <NotificationStatCard 
                    category={NotificationCategory.CATEGORY_RENEWAL}
                    count={totalCategoryCounts?.CATEGORY_RENEWAL || 0}
                    unreadCount={categoryCounts?.CATEGORY_RENEWAL || 0}
                    isActive={activeTab === 'renewals'}
                    onClick={() => setActiveTab('renewals')}
                />
                <NotificationStatCard 
                    category={NotificationCategory.CATEGORY_ZOOM}
                    count={totalCategoryCounts?.CATEGORY_ZOOM || 0}
                    unreadCount={categoryCounts?.CATEGORY_ZOOM || 0}
                    isActive={activeTab === 'zoom'}
                    onClick={() => setActiveTab('zoom')}
                />
                <NotificationStatCard 
                    category={NotificationCategory.CATEGORY_EFORM}
                    count={totalCategoryCounts?.CATEGORY_EFORM || 0}
                    unreadCount={categoryCounts?.CATEGORY_EFORM || 0}
                    isActive={activeTab === 'eform'}
                    onClick={() => setActiveTab('eform')}
                />
            </div>

            {/* Main Content Area */}
            <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl overflow-hidden flex flex-col flex-1 min-h-0">
                {/* Toolbar */}
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md">
                    <div className="flex items-center gap-3 flex-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                                setIsSelectionMode(!isSelectionMode);
                                if (isSelectionMode) handleSelectAll(); // Deselect all when exiting
                            }}
                            className={cn(
                                "rounded-xl w-10 h-10 border border-transparent transition-[opacity,transform,colors] duration-200 ease-out",
                                isSelectionMode ? "bg-primary/10 text-primary border-primary/20" : "hover:bg-slate-100 dark:hover:bg-slate-800"
                            )}
                        >
                            <CheckCheck className="w-5 h-5" />
                        </Button>

                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Filter notifications..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 text-sm font-medium bg-slate-50 dark:bg-slate-800/50 border-none rounded-2xl focus:ring-2 focus:ring-primary/20 transition-colors duration-150 placeholder:text-slate-400 text-slate-900 dark:text-white"
                            />
                            {searchQuery && (
                                <button onClick={() => setSearchQuery('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/50 p-1 rounded-2xl border border-slate-100 dark:border-slate-700/50">
                        {(['all', 'unread', 'read'] as const).map((filter) => {
                            const count = getFilterCount(filter);
                            return (
                                <button
                                    key={filter}
                                    onClick={() => setReadFilter(filter)}
                                    className={cn(
                                        "px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-xl transition-colors duration-150 flex items-center gap-2",
                                        readFilter === filter 
                                            ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm border border-slate-200/50 dark:border-slate-600/50" 
                                            : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                                    )}
                                >
                                    {filter}
                                    <span className={cn(
                                        "px-1.5 py-0.5 rounded-md text-[10px] bg-slate-100 dark:bg-slate-800",
                                        readFilter === filter ? "text-slate-900 dark:text-white font-black" : "text-slate-400"
                                    )}>
                                        {count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* List Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {isLoading ? (
                        <div className="space-y-4">
                            {[1, 2, 3, 4, 5].map(i => <NotificationSkeleton key={i} />)}
                        </div>
                    ) : notifications.length === 0 ? (
                        renderEmptyState()
                    ) : (
                        <div className="space-y-8">
                            {Object.entries(groupedNotifications).map(([dateGroup, items]) => (
                                items.length > 0 && (
                                    <div key={dateGroup} className="space-y-3">
                                        <div className="flex items-center gap-4 px-2">
                                            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
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
                            Page {currentPage} of {totalPages}
                        </span>
                        
                        <div className="flex items-center gap-1">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1 || isFetching}
                                className="rounded-xl h-9 px-3 border-slate-200 dark:border-slate-700 font-bold gap-1"
                            >
                                <ChevronLeft className="w-4 h-4" />
                                Previous
                            </Button>
                            
                            <div className="flex items-center mx-2 gap-1">
                                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                    // Simple pagination logic for first 5 pages or current surroundings
                                    let pageNum = i + 1;
                                    if (totalPages > 5 && currentPage > 3) {
                                        pageNum = currentPage - 2 + i;
                                        if (pageNum > totalPages) pageNum = totalPages - (4 - i);
                                        if (pageNum < 1) pageNum = i + 1;
                                    }
                                    
                                    return (
                                        <button
                                            key={pageNum}
                                            onClick={() => setCurrentPage(pageNum)}
                                            className={cn(
                                                "w-9 h-9 rounded-xl text-xs font-black transition-colors duration-150",
                                                currentPage === pageNum 
                                                    ? "bg-primary text-white shadow-md shadow-primary/20" 
                                                    : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
                                            )}
                                        >
                                            {pageNum}
                                        </button>
                                    );
                                })}
                            </div>

                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages || isFetching}
                                className="rounded-xl h-9 px-3 border-slate-200 dark:border-slate-700 font-bold gap-1"
                            >
                                Next
                                <ChevronRight className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* Bulk Action Bar */}
            {isSelectionMode && selectedIds.size > 0 && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 px-6 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-3xl shadow-2xl animate-in slide-in-from-bottom-10">
                    <div className="pr-4 border-r border-white/10 dark:border-slate-900/10">
                        <span className="text-sm font-black uppercase tracking-widest">
                            {selectedIds.size} Selected
                        </span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={handleBulkMarkAsRead}
                            className="text-white dark:text-slate-900 hover:bg-white/10 dark:hover:bg-slate-900/10 font-bold rounded-xl h-10 px-4"
                        >
                            Mark Read
                        </Button>
                        <Button 
                            variant="destructive" 
                            size="sm" 
                            onClick={handleBulkDelete}
                            className="bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl h-10 px-4"
                        >
                            Delete
                        </Button>
                    </div>

                    <button 
                        onClick={() => {
                            setIsSelectionMode(false);
                            handleSelectAll();
                        }}
                        className="ml-2 p-1 hover:rotate-90 transition-transform"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
            )}

            {/* Shortcut Help Hint */}
            <div className="flex items-center justify-center gap-2 text-slate-400">
                <HelpCircle className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-widest">
                    Pro tip: use <span className="text-slate-900 dark:text-slate-300 px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded mx-0.5">J</span> and <span className="text-slate-900 dark:text-slate-300 px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded mx-0.5">K</span> to navigate
                </span>
            </div>
        </div>
    );
};

export default NotificationCenter;
