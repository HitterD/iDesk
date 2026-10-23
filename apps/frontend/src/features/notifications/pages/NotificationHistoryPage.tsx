import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, Mail, Check, Trash2, Search, Filter, ChevronLeft, ChevronRight, ExternalLink, CheckSquare, Square, Bell, Download } from 'lucide-react';
import { useAuth } from '@/stores/useAuth';
import { cn } from '@/lib/utils';
import { ResHead } from '@/components/resources/ResourceParts';
import { useNotificationCenter } from '../../notifications/hooks/useNotificationCenter';
import { NotificationCategory } from '../../../components/notifications/types/notification.types';

export const NotificationHistoryPage: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();

    const {
        readFilter, setReadFilter,
        searchQuery, setSearchQuery,
        selectedIds,
        currentPage, setCurrentPage,
        pageSize,
        notifications,
        total,
        isLoading,
        isFetching,
        categoryCounts,
        handleToggleSelect,
        handleSelectAll,
        handleBulkDelete,
        handleBulkMarkAsRead,
        handleMarkAsRead,
        handleViewDetails,
        activeTab, setActiveTab
    } = useNotificationCenter();

    const [selectedAppFilter, setSelectedAppFilter] = useState<string>('ALL');

    // Filter by search query & app
    const filteredNotifications = useMemo(() => {
        return notifications.filter((notif) => {
            // App filter
            if (selectedAppFilter !== 'ALL') {
                const titleLower = (notif.title || '').toLowerCase();
                const msgLower = (notif.message || '').toLowerCase();
                const appMatch = selectedAppFilter.toLowerCase();
                const isMatch = titleLower.includes(appMatch) || msgLower.includes(appMatch);
                if (!isMatch) return false;
            }

            // Search query filter
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const inTitle = (notif.title || '').toLowerCase().includes(q);
                const inMsg = (notif.message || '').toLowerCase().includes(q);
                const inRef = (notif.referenceId || '').toLowerCase().includes(q);
                return inTitle || inMsg || inRef;
            }

            return true;
        });
    }, [notifications, selectedAppFilter, searchQuery]);

    const totalPages = Math.ceil(total / pageSize) || 1;
    const isAllSelected = filteredNotifications.length > 0 && filteredNotifications.every((n) => selectedIds.has(n.id));

    const appCounts = useMemo(() => {
        let idesk = 0;
        let ppaset = 0;
        let ipop = 0;
        let hris = 0;
        notifications.forEach((n) => {
            const text = `${n.title} ${n.message}`.toLowerCase();
            if (text.includes('ppaset') || text.includes('aset') || text.includes('hardware')) ppaset++;
            else if (text.includes('ipop') || text.includes('purchase order') || text.includes('po')) ipop++;
            else if (text.includes('hris') || text.includes('cuti') || text.includes('lembur')) hris++;
            else idesk++;
        });
        return { idesk, ppaset, ipop, hris };
    }, [notifications]);

    const handleExportCsv = () => {
        const headers = ['ID', 'Aplikasi', 'Status', 'Judul', 'Pesan', 'Ref ID', 'Tanggal'];
        const rows = filteredNotifications.map((n) => [
            n.id,
            getAppPill(n.title, n.message).label,
            n.isRead ? 'DIBACA' : 'BELUM DIBACA',
            `"${(n.title || '').replace(/"/g, '""')}"`,
            `"${(n.message || '').replace(/"/g, '""')}"`,
            n.referenceId || '',
            formatDate(n.createdAt),
        ]);
        const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `notification_history_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const getAppPill = (title: string, message: string) => {
        const text = `${title} ${message}`.toLowerCase();
        if (text.includes('ppaset') || text.includes('aset') || text.includes('hardware')) {
            return { label: 'PPAset', color: 'bg-ok/10 text-ok-ink border-ok/20' };
        }
        if (text.includes('ipop') || text.includes('purchase order') || text.includes('po')) {
            return { label: 'iPop', color: 'bg-brand/10 text-brand border-brand/20' };
        }
        if (text.includes('hris') || text.includes('cuti') || text.includes('lembur')) {
            return { label: 'HRIS', color: 'bg-aqua/10 text-aqua-ink border-aqua/20' };
        }
        return { label: 'iDesk', color: 'bg-brand/10 text-brand border-brand/20' };
    };

    const formatDate = (isoString: string) => {
        try {
            const d = new Date(isoString);
            return d.toLocaleDateString('id-ID', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }).replace(',', '');
        } catch {
            return isoString;
        }
    };

    return (
        <div className="res-page space-y-6">
            <ResHead icon={Bell} tone="red" title="Notification History" description="Arsip & log resmi seluruh notifikasi sistem internal PT Santos Jaya Abadi"
                actions={(
                    <span className="queue-pop font-mono" title="Pengguna">
                        {user?.employeeId || '00061058'} - {(user?.fullName || 'RM BAGASTYO ANGGORO INDRASTOTO').toUpperCase()}
                    </span>
                )} />

            {/* Bento App Counter Ribbons */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-surface rounded-2xl border border-line p-3.5 shadow-xs flex items-center justify-between">
                    <div>
                        <div className="text-[10px] font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">iDesk Service</div>
                        <div className="text-lg font-bold text-[#2D4A8C] mt-0.5">{appCounts.idesk} Notif</div>
                    </div>
                    <span className="w-2.5 h-2.5 rounded-full bg-brand" />
                </div>
                <div className="bg-surface rounded-2xl border border-line p-3.5 shadow-xs flex items-center justify-between">
                    <div>
                        <div className="text-[10px] font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">PPAset Approval</div>
                        <div className="text-lg font-bold text-ok-ink mt-0.5">{appCounts.ppaset} Notif</div>
                    </div>
                    <span className="w-2.5 h-2.5 rounded-full bg-ok" />
                </div>
                <div className="bg-surface rounded-2xl border border-line p-3.5 shadow-xs flex items-center justify-between">
                    <div>
                        <div className="text-[10px] font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">iPop Procurement</div>
                        <div className="text-lg font-bold text-brand mt-0.5">{appCounts.ipop} Notif</div>
                    </div>
                    <span className="w-2.5 h-2.5 rounded-full bg-brand" />
                </div>
                <div className="bg-surface rounded-2xl border border-line p-3.5 shadow-xs flex items-center justify-between">
                    <div>
                        <div className="text-[10px] font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">HRIS Portal</div>
                        <div className="text-lg font-bold text-aqua-ink mt-0.5">{appCounts.hris} Notif</div>
                    </div>
                    <span className="w-2.5 h-2.5 rounded-full bg-aqua" />
                </div>
            </div>

            {/* Action Toolbar */}
            <div className="bg-surface rounded-2xl border border-line p-4 shadow-xs space-y-3.5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    {/* Left Action Buttons */}
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={() => window.location.reload()}
                            className="idesk-btn is-primary"
                        >
                            <RefreshCw size={13} className={isFetching ? 'animate-spin' : ''} />
                            <span>Refresh</span>
                        </button>

                        <button
                            type="button"
                            disabled={selectedIds.size === 0}
                            onClick={handleBulkMarkAsRead}
                            className="idesk-btn is-soft"
                        >
                            <Check size={13} />
                            <span>Tandai Dibaca</span>
                        </button>

                        <button
                            type="button"
                            disabled={selectedIds.size === 0}
                            onClick={handleBulkDelete}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-bad/10 hover:bg-bad/20 text-bad-ink text-xs font-semibold border border-bad/20 transition disabled:opacity-40 cursor-pointer"
                        >
                            <Trash2 size={13} />
                            <span>Hapus</span>
                        </button>

                        <button
                            type="button"
                            onClick={handleExportCsv}
                            className="idesk-btn is-soft"
                            title="Unduh seluruh riwayat notifikasi ke file CSV"
                        >
                            <Download size={13} />
                            <span>Ekspor CSV</span>
                        </button>

                        <div className="text-xs text-[hsl(var(--muted-foreground))] ml-1 font-mono">
                            Selected: <span className="font-bold text-[hsl(var(--foreground))]">{selectedIds.size}</span>
                        </div>
                    </div>

                    {/* Right Status Tabs, App Filter & Search */}
                    <div className="flex flex-wrap items-center gap-2.5">
                        {/* Status Filter Tabs */}
                        <div className="flex items-center gap-1 bg-[hsl(var(--muted)/0.5)] p-1 rounded-xl border border-line text-xs font-semibold">
                            <button
                                type="button"
                                onClick={() => setReadFilter('all')}
                                className={cn(
                                    "px-2.5 py-1 rounded-lg transition cursor-pointer",
                                    readFilter === 'all'
                                        ? "bg-surface text-[hsl(var(--foreground))] shadow-xs font-bold"
                                        : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                                )}
                            >
                                Semua
                            </button>
                            <button
                                type="button"
                                onClick={() => setReadFilter('unread')}
                                className={cn(
                                    "px-2.5 py-1 rounded-lg transition cursor-pointer",
                                    readFilter === 'unread'
                                        ? "bg-surface text-[hsl(var(--foreground))] shadow-xs font-bold"
                                        : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                                )}
                            >
                                Belum Dibaca
                            </button>
                            <button
                                type="button"
                                onClick={() => setReadFilter('read')}
                                className={cn(
                                    "px-2.5 py-1 rounded-lg transition cursor-pointer",
                                    readFilter === 'read'
                                        ? "bg-surface text-[hsl(var(--foreground))] shadow-xs font-bold"
                                        : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                                )}
                            >
                                Sudah Dibaca
                            </button>
                        </div>

                        {/* App Filter */}
                        <div className="flex items-center gap-1.5">
                            <select
                                value={selectedAppFilter}
                                onChange={(e) => setSelectedAppFilter(e.target.value)}
                                className="px-2.5 py-1.5 rounded-xl border border-line bg-surface text-xs font-medium text-[hsl(var(--foreground))] outline-none focus:border-[#2D4A8C]"
                            >
                                <option value="ALL">Semua Aplikasi</option>
                                <option value="iDesk">iDesk</option>
                                <option value="PPAset">PPAset</option>
                                <option value="iPop">iPop</option>
                                <option value="HRIS">HRIS</option>
                            </select>
                        </div>

                        {/* Search Input */}
                        <div className="relative w-44 sm:w-56">
                            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
                            <input
                                type="text"
                                placeholder="Cari notifikasi..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-line bg-surface text-xs text-[hsl(var(--foreground))] outline-none focus:border-[#2D4A8C]"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Notification History Data Table (Legacy Grid -> Bento Enterprise Table) */}
            <div className="bg-surface rounded-2xl border border-line overflow-hidden shadow-xs">
                {isLoading ? (
                    <div className="p-16 text-center text-xs text-[hsl(var(--muted-foreground))] space-y-2">
                        <RefreshCw size={24} className="animate-spin mx-auto text-[#2D4A8C]" />
                        <p className="font-semibold">Memuat riwayat notifikasi...</p>
                    </div>
                ) : filteredNotifications.length === 0 ? (
                    <div className="p-16 text-center space-y-2">
                        <Mail size={32} className="mx-auto text-[hsl(var(--muted-foreground))] opacity-40" />
                        <h3 className="text-sm font-bold text-[hsl(var(--foreground))]">Tidak Ada Riwayat Notifikasi</h3>
                        <p className="text-xs text-[hsl(var(--muted-foreground))] max-w-sm mx-auto">
                            Semua notifikasi pengajuan tiket, form approval aset, atau pembaruan telah selesai diproses.
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-[#101520] text-white text-xs font-bold uppercase tracking-wider border-b border-[#262D3C]">
                                    <th className="p-3.5 pl-5 w-12 text-center">
                                        <button
                                            type="button"
                                            onClick={handleSelectAll}
                                            className="text-ink-3 hover:text-white transition cursor-pointer"
                                        >
                                            {isAllSelected ? <CheckSquare size={16} className="text-ok" /> : <Square size={16} />}
                                        </button>
                                    </th>
                                    <th className="p-3.5 w-12 text-center">Status</th>
                                    <th className="p-3.5 w-32">Application</th>
                                    <th className="p-3.5">Message / Rincian Notifikasi</th>
                                    <th className="p-3.5 w-44">Created Date</th>
                                    <th className="p-3.5 pr-5 w-20 text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[hsl(var(--border))] text-xs">
                                {filteredNotifications.map((notif) => {
                                    const isSelected = selectedIds.has(notif.id);
                                    const appPill = getAppPill(notif.title, notif.message);

                                    return (
                                        <tr
                                            key={notif.id}
                                            className={cn(
                                                "transition-colors hover:bg-[hsl(var(--muted)/0.3)]",
                                                !notif.isRead && "bg-[hsl(var(--primary)/0.03)] font-medium",
                                                isSelected && "bg-[hsl(var(--primary)/0.08)]"
                                            )}
                                        >
                                            {/* Checkbox */}
                                            <td className="p-3.5 pl-5 text-center">
                                                <button
                                                    type="button"
                                                    onClick={() => handleToggleSelect(notif.id)}
                                                    className="text-[hsl(var(--muted-foreground))] hover:text-[#2D4A8C] transition cursor-pointer"
                                                >
                                                    {isSelected ? <CheckSquare size={16} className="text-[#2D4A8C]" /> : <Square size={16} />}
                                                </button>
                                            </td>

                                            {/* Read/Unread Envelope */}
                                            <td className="p-3.5 text-center">
                                                <button
                                                    type="button"
                                                    onClick={(e) => handleMarkAsRead(notif.id, e)}
                                                    title={notif.isRead ? 'Telah dibaca' : 'Belum dibaca - Klik untuk tandai'}
                                                    className="cursor-pointer"
                                                >
                                                    <Mail
                                                        size={16}
                                                        className={notif.isRead ? "text-ink-3" : "text-warn fill-warn/20"}
                                                    />
                                                </button>
                                            </td>

                                            {/* Application Badge */}
                                            <td className="p-3.5 font-bold">
                                                <span className={cn("px-2.5 py-1 rounded-lg text-xs border inline-block font-sans", appPill.color)}>
                                                    {appPill.label}
                                                </span>
                                            </td>

                                            {/* Message Content (Formatted like Legacy Santos ASPX) */}
                                            <td className="p-3.5 space-y-1">
                                                <div className="font-bold text-[hsl(var(--foreground))] text-xs">
                                                    {notif.title}
                                                </div>
                                                <div className="text-[hsl(var(--muted-foreground))] whitespace-pre-line text-xs leading-relaxed font-sans">
                                                    {notif.message}
                                                </div>
                                                {notif.referenceId && (
                                                    <div className="text-xs font-mono text-[#2D4A8C] font-semibold">
                                                        Ref ID: #{notif.referenceId}
                                                    </div>
                                                )}
                                            </td>

                                            {/* Timestamp */}
                                            <td className="p-3.5 text-[hsl(var(--muted-foreground))] font-mono text-xs whitespace-nowrap">
                                                {formatDate(notif.createdAt)}
                                            </td>

                                            {/* Action Button: View details */}
                                            <td className="p-3.5 pr-5 text-center">
                                                <button
                                                    type="button"
                                                    onClick={() => handleViewDetails(notif)}
                                                    title="Buka rincian tiket / dokumen"
                                                    className="p-1.5 rounded-lg bg-[hsl(var(--muted)/0.5)] hover:bg-[#2D4A8C] hover:text-white text-[hsl(var(--foreground))] transition cursor-pointer"
                                                >
                                                    <ExternalLink size={14} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Footer Pagination */}
                <div className="p-4 border-t border-line flex items-center justify-between text-xs text-[hsl(var(--muted-foreground))]">
                    <span>
                        Menampilkan {filteredNotifications.length} dari {total} total notifikasi
                    </span>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            disabled={currentPage <= 1}
                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                            className="p-1.5 rounded-lg border border-line hover:bg-[hsl(var(--muted))] disabled:opacity-40 transition cursor-pointer"
                        >
                            <ChevronLeft size={14} />
                        </button>
                        <span className="font-mono font-bold text-[hsl(var(--foreground))] px-2">
                            {currentPage} / {totalPages}
                        </span>
                        <button
                            type="button"
                            disabled={currentPage >= totalPages}
                            onClick={() => setCurrentPage((p) => p + 1)}
                            className="p-1.5 rounded-lg border border-line hover:bg-[hsl(var(--muted))] disabled:opacity-40 transition cursor-pointer"
                        >
                            <ChevronRight size={14} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default NotificationHistoryPage;
