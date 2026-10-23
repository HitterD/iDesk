import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
    Bell, CalendarClock, Check, CheckCheck, FileKey2, History, Inbox, ListChecks, MonitorSmartphone,
    Search, Settings, Siren, Ticket, Trash2, Video, Volume2, VolumeX, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { TicketPillTone } from '@/components/ui/ticket-pill';
import { ResEmpty, ResHead, ResPager, ResSearch, ResSkeletonRows } from '@/components/resources/ResourceParts';
import { MgBanner, MgStat } from '@/components/management/MgmtParts';
import { DashSeg } from '@/features/dashboard/components/DashboardParts';
import { NotificationCategory } from './types/notification.types';
import { useNotificationCenter } from '../../features/notifications/hooks/useNotificationCenter';
import { NotificationItem } from './NotificationItem';
import { DesktopAppDownloadBanner } from './DesktopAppDownloadBanner';
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
        unacknowledgedCriticalCount,
        handleAcknowledge,
        isAcknowledgePending,
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

    const DAY_LABEL: Readonly<Record<string, string>> = {
        Today: 'Hari ini', Yesterday: 'Kemarin', 'Earlier This Week': 'Minggu ini', 'Earlier This Month': 'Bulan ini', Earlier: 'Sebelumnya',
    };
    const tabCards: readonly { key: typeof activeTab; label: string; icon: React.ElementType; tone: TicketPillTone; cat?: NotificationCategory }[] = [
        { key: 'all', label: 'Semua', icon: Inbox, tone: 'navy' },
        { key: 'tickets', label: 'Tickets', icon: Ticket, tone: 'blue', cat: NotificationCategory.CATEGORY_TICKET },
        { key: 'hardware', label: 'Hardware', icon: MonitorSmartphone, tone: 'amber', cat: NotificationCategory.CATEGORY_HARDWARE },
        { key: 'renewals', label: 'Renewals', icon: CalendarClock, tone: 'neutral', cat: NotificationCategory.CATEGORY_RENEWAL },
        { key: 'zoom', label: 'Zoom', icon: Video, tone: 'teal', cat: NotificationCategory.CATEGORY_ZOOM },
        { key: 'eform', label: 'E-Form', icon: FileKey2, tone: 'green', cat: NotificationCategory.CATEGORY_EFORM },
    ];
    const READ_LABEL = { all: 'Semua', unread: 'Belum dibaca', read: 'Sudah dibaca' } as const;
    const exitSelection = () => { setIsSelectionMode(false); if (selectedIds.size > 0) handleSelectAll(); };

    return (
        <div className="res-page mg-page is-narrow">
            <ResHead icon={Bell} tone="red" title="Notification Center" description="Semua pemberitahuan tiket, hardware, renewal, Zoom, dan E-Form"
                actions={(
                    <>
                        <Button variant="soft" size="icon" onClick={toggleSound} aria-pressed={soundEnabled}
                            aria-label={soundEnabled ? 'Matikan suara notifikasi' : 'Nyalakan suara notifikasi'} title={soundEnabled ? 'Matikan suara notifikasi' : 'Nyalakan suara notifikasi'}>
                            {soundEnabled ? <Volume2 aria-hidden="true" /> : <VolumeX aria-hidden="true" />}
                        </Button>
                        <Button variant="soft" size="icon" asChild>
                            <Link to="/admin/settings" aria-label="Pengaturan notifikasi" title="Pengaturan notifikasi"><Settings aria-hidden="true" /></Link>
                        </Button>
                        <Button variant={isSelectionMode ? 'primary' : 'soft'} aria-pressed={isSelectionMode}
                            onClick={() => (isSelectionMode ? exitSelection() : setIsSelectionMode(true))}>
                            <ListChecks aria-hidden="true" />Pilih
                        </Button>
                        <Button variant="soft" onClick={() => markAllAsReadMutation.mutate()} disabled={totalUnread === 0} loading={markAllAsReadMutation.isPending}>
                            {!markAllAsReadMutation.isPending && <CheckCheck aria-hidden="true" />}Tandai semua dibaca
                        </Button>
                        <Button variant="soft" asChild>
                            <Link to="/notifications/history" title="Buka Tabel Riwayat Notifikasi Lengkap (Format Santos)"><History aria-hidden="true" />Riwayat Notifikasi</Link>
                        </Button>
                    </>
                )} />

            {unacknowledgedCriticalCount > 0 && (
                <MgBanner tone="crit" icon={Siren} title={`${unacknowledgedCriticalCount} notifikasi kritis belum dikonfirmasi`}
                    actions={<Button variant="soft" onClick={() => { setReadFilter('all'); setActiveTab('all'); }}>Lihat</Button>}>
                    Konfirmasi setelah Anda menindaklanjuti.
                </MgBanner>
            )}

            {/* Desktop App Tray / Toast Banner */}
            <DesktopAppDownloadBanner showAdminTools={true} />

            <section className="res-stats is-six" aria-label="Kategori notifikasi">
                {tabCards.map((c) => {
                    const unread = c.cat ? categoryCounts?.[c.cat] || 0 : totalUnread;
                    const all = c.cat ? totalCategoryCounts?.[c.cat] || 0 : systemTotal;
                    return (
                        <MgStat key={c.key} icon={c.icon} tone={c.tone} label={c.label} value={unread} zero={unread === 0}
                            sub={`${all} total`} active={activeTab === c.key} onClick={() => setActiveTab(c.key)}
                            ariaLabel={`${c.label}: ${unread} belum dibaca dari ${all}`} />
                    );
                })}
            </section>

            <div className="res-filters">
                <ResSearch id="notif-search" value={searchQuery} onChange={setSearchQuery} placeholder="Filter notifikasi…" label="Filter notifikasi" />
                <DashSeg aria-label="Status baca" value={readFilter} onChange={setReadFilter}
                    options={(['all', 'unread', 'read'] as const).map((f) => ({ value: f, label: `${READ_LABEL[f]} ${getFilterCount(f)}` }))} />
                {isFetching && !isLoading && <span className="res-muted text-xs" role="status">Memuat…</span>}
            </div>

            {isLoading ? (
                <div className="dash-panel mg-notif-panel"><ResSkeletonRows rows={5} /></div>
            ) : notifications.length === 0 ? (
                <div className="res-table">
                    <ResEmpty icon={searchQuery ? Search : Inbox} title={searchQuery ? 'Tidak ada hasil' : 'Semua sudah dibaca!'}
                        cta={searchQuery ? <Button variant="subtle" onClick={() => setSearchQuery('')}>Hapus pencarian</Button> : undefined}>
                        {searchQuery ? `Tidak ada notifikasi yang cocok dengan "${searchQuery}".` : 'Tidak ada notifikasi untuk filter ini.'}
                    </ResEmpty>
                </div>
            ) : (
                <div>
                    {Object.entries(groupedNotifications).map(([dateGroup, items]) => items.length > 0 && (
                        <React.Fragment key={dateGroup}>
                            <div className="mg-day">{DAY_LABEL[dateGroup] ?? dateGroup}</div>
                            <section className="dash-panel mg-notif-panel" aria-label={DAY_LABEL[dateGroup] ?? dateGroup}>
                                <div className="dash-list">
                                    {items.map((notification) => (
                                        <NotificationItem
                                            key={notification.id}
                                            notification={notification}
                                            isSelectionMode={isSelectionMode}
                                            isSelected={selectedIds.has(notification.id)}
                                            onSelect={handleToggleSelect}
                                            onDelete={handleDelete}
                                            onMarkRead={handleMarkAsRead}
                                            onViewDetails={handleViewDetails}
                                            onAcknowledge={handleAcknowledge}
                                            isAcknowledgePending={isAcknowledgePending}
                                        />
                                    ))}
                                </div>
                            </section>
                        </React.Fragment>
                    ))}
                </div>
            )}

            {!isLoading && total > pageSize && (
                <div className="res-foot mt-3 rounded-2xl" style={{ borderTop: 0 }}>
                    <span>Halaman {currentPage} dari {totalPages}</span>
                    <ResPager page={currentPage} totalPages={totalPages} disabled={isFetching} onChange={setCurrentPage} />
                </div>
            )}

            {isSelectionMode && selectedIds.size > 0 && (
                <div className="mg-bulkbar" role="toolbar" aria-label="Aksi notifikasi terpilih">
                    <span className="text-sm font-semibold">{selectedIds.size} dipilih</span>
                    <Button variant="soft" onClick={handleBulkMarkAsRead}><Check aria-hidden="true" />Tandai dibaca</Button>
                    <Button variant="danger" onClick={handleBulkDelete}><Trash2 aria-hidden="true" />Hapus</Button>
                    <button type="button" className="res-icon-btn" onClick={exitSelection} aria-label="Batalkan pilihan"><X aria-hidden="true" /></button>
                </div>
            )}
        </div>
    );
};

export default NotificationCenter;
