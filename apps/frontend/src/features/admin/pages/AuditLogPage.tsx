import React, { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Shield, RefreshCw, Calendar, X, ChevronRight, Rows3, GitCommitVertical, FileSearch, Cpu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { ResBub, ResEmpty, ResHead, ResPager, ResSearch, ResSkeletonRows, ResRow, ResTable } from '@/components/resources/ResourceParts';
import { DashAvatar } from '@/features/dashboard/components/DashboardParts';
import '@/components/management/management.css';
import api from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { AuditStatsCards } from '../components/AuditStatsCards';
import { AuditExportButton } from '../components/AuditExportButton';
import { AuditUserFilter } from '../components/AuditUserFilter';
import { AuditTimelineView } from '../components/AuditTimelineView';
import { AuditActionFilter } from '../components/AuditActionFilter';
import { AuditEntityFilter } from '../components/AuditEntityFilter';
import { AuditDateRangePicker } from '../components/AuditDateRangePicker';
import { AuditAction, ENTITY_TYPE_LABELS } from '../../../types/audit.types';
import { useDebounce } from '@/hooks/useDebounce';

interface AuditLog {
    id: string;
    userId: string;
    user?: {
        fullName: string;
        email: string;
    };
    action: AuditAction;
    entityType: string;
    entityId: string | null;
    oldValue: Record<string, any> | null;
    newValue: Record<string, any> | null;
    ipAddress: string | null;
    description: string | null;
    createdAt: string;
}

interface AuditResponse {
    data: AuditLog[];
    meta: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    };
}

/** Mockup audit-logs.html action hues (no purple); label copy from production. */
const ACTION_CONFIG: Record<string, { label: string; hue: string }> = {
    CREATE_TICKET: { label: 'Ticket Created', hue: 'var(--dash-green)' },
    UPDATE_TICKET: { label: 'Ticket Updated', hue: 'var(--dash-blue)' },
    DELETE_TICKET: { label: 'Ticket Deleted', hue: 'var(--dash-red)' },
    ASSIGN_TICKET: { label: 'Ticket Assigned', hue: 'var(--dash-teal)' },
    STATUS_CHANGE: { label: 'Status Changed', hue: 'var(--dash-navy)' },
    PRIORITY_CHANGE: { label: 'Priority Changed', hue: 'var(--dash-orange)' },
    TICKET_REPLY: { label: 'Ticket Reply', hue: 'var(--dash-blue)' },
    TICKET_MERGE: { label: 'Tickets Merged', hue: 'var(--dash-teal)' },
    BULK_UPDATE: { label: 'Bulk Update', hue: 'var(--dash-gray)' },
    USER_LOGIN: { label: 'User Login', hue: 'var(--dash-gray)' },
    USER_LOGOUT: { label: 'User Logout', hue: 'var(--dash-gray)' },
    USER_CREATE: { label: 'User Created', hue: 'var(--dash-green)' },
    USER_UPDATE: { label: 'User Updated', hue: 'var(--dash-brown)' },
    SETTINGS_CHANGE: { label: 'Settings Changed', hue: 'var(--dash-red)' },
    ARTICLE_CREATE: { label: 'Article Created', hue: 'var(--dash-green)' },
    ARTICLE_UPDATE: { label: 'Article Updated', hue: 'var(--dash-brown)' },
    ARTICLE_DELETE: { label: 'Article Deleted', hue: 'var(--dash-red)' },
};
const AUDIT_COLS = '22px 150px minmax(170px,1fr) 150px minmax(170px,1fr) minmax(220px,1.8fr) 110px';

export const AuditLogPage: React.FC = () => {
    const [page, setPage] = useState(1);
    const [actionFilter, setActionFilter] = useState<string>('');
    const [entityFilter, setEntityFilter] = useState<string>('');
    const [userIdFilter, setUserIdFilter] = useState<string | undefined>(undefined);
    const [searchQuery, setSearchQuery] = useState('');
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    const [viewMode, setViewMode] = useState<'table' | 'timeline'>('table');
    const limit = 25;

    // Debounce search query for server-side search
    const debouncedSearch = useDebounce(searchQuery, 300);

    // Fetch audit logs with server-side search
    const { data: auditData, isLoading, isFetching, refetch } = useQuery<AuditResponse>({
        queryKey: ['audit-logs', page, actionFilter, entityFilter, userIdFilter, debouncedSearch, startDate, endDate],
        queryFn: async () => {
            const params = new URLSearchParams();
            params.set('page', page.toString());
            params.set('limit', limit.toString());
            if (actionFilter) params.set('action', actionFilter);
            if (entityFilter) params.set('entityType', entityFilter);
            if (userIdFilter) params.set('userId', userIdFilter);
            if (debouncedSearch) params.set('searchQuery', debouncedSearch);
            if (startDate) params.set('startDate', new Date(startDate).toISOString());
            if (endDate) params.set('endDate', new Date(endDate + 'T23:59:59').toISOString());
            const res = await api.get(`/audit?${params.toString()}`);
            return res.data;
        },
    });

    const logs = auditData?.data || [];
    const meta = auditData?.meta;

    // Clear all filters
    const clearFilters = useCallback(() => {
        setSearchQuery('');
        setActionFilter('');
        setEntityFilter('');
        setUserIdFilter(undefined);
        setStartDate('');
        setEndDate('');
        setPage(1);
    }, []);

    const hasActiveFilters = searchQuery || actionFilter || entityFilter || userIdFilter || startDate || endDate;

    // Count active filters for badge
    const activeFilterCount = useMemo(() => {
        let count = 0;
        if (actionFilter) count++;
        if (entityFilter) count++;
        if (userIdFilter) count++;
        if (startDate || endDate) count++;
        return count;
    }, [actionFilter, entityFilter, userIdFilter, startDate, endDate]);

    const toggleExpand = (id: string) => {
        setExpandedRows((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const entityLink = (log: AuditLog): string | null => {
        switch (log.entityType.toLowerCase()) {
            case 'ticket': return `/tickets/${log.entityId}`;
            case 'user': return '/agents';
            case 'article': return `/kb/articles/${log.entityId}`;
            default: return null;
        }
    };
    const fmtJson = (v: Record<string, unknown> | null) => (v ? JSON.stringify(v, null, 2) : '—');

    return (
        <div className="res-page mg-page">
            <ResHead icon={Shield} tone="slate" title="Audit Logs" description="Lacak semua aktivitas dan perubahan sistem"
                actions={(
                    <>
                        <Button variant="soft" onClick={() => refetch()} loading={isFetching} aria-label="Refresh">{!isFetching && <RefreshCw aria-hidden="true" />}Refresh</Button>
                        <AuditExportButton filters={{ action: actionFilter, entityType: entityFilter, startDate, endDate }} />
                    </>
                )} />

            <AuditStatsCards />

            <div className="res-filters">
                <ResSearch id="audit-search" value={searchQuery} onChange={setSearchQuery} placeholder="Cari user, entity ID, deskripsi..." label="Cari audit log" />
                <AuditActionFilter value={actionFilter} onChange={(a) => { setActionFilter(a); setPage(1); }} />
                <AuditEntityFilter value={entityFilter} onChange={(e) => { setEntityFilter(e); setPage(1); }} />
                <AuditUserFilter value={userIdFilter} onChange={(u) => { setUserIdFilter(u); setPage(1); }} />
                <AuditDateRangePicker startDate={startDate} endDate={endDate}
                    onStartDateChange={(d) => { setStartDate(d); setPage(1); }} onEndDateChange={(d) => { setEndDate(d); setPage(1); }} />
                <SegmentedControl aria-label="Tampilan" className="dash-seg" value={viewMode} onValueChange={setViewMode} options={[
                    { value: 'table', label: 'Tabel', icon: Rows3 },
                    { value: 'timeline', label: 'Timeline', icon: GitCommitVertical },
                ]} />
                {hasActiveFilters && (
                    <button type="button" className="res-reset" onClick={clearFilters}>
                        <X aria-hidden="true" />Reset{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
                    </button>
                )}
            </div>

            {viewMode === 'timeline' && (
                startDate ? (
                    <section className="dash-panel dash-feed" aria-label="Timeline"><AuditTimelineView date={startDate} /></section>
                ) : (
                    <div className="res-table"><ResEmpty icon={Calendar} title="Pilih tanggal">Pilih tanggal mulai untuk melihat timeline.</ResEmpty></div>
                )
            )}

            {viewMode === 'table' && (
                <ResTable label="Audit log" cols={AUDIT_COLS} colsMobile="22px minmax(0,1fr) auto"
                    head={logs.length > 0 ? <><span /><span>Timestamp</span><span>User</span><span>Action</span><span>Entity</span><span>Description</span><span>IP Address</span></> : undefined}
                    foot={(
                        <>
                            <span>{meta ? `Menampilkan ${meta.total === 0 ? 0 : (meta.page - 1) * meta.limit + 1}–${Math.min(meta.page * meta.limit, meta.total)} dari ${meta.total} log` : ''}</span>
                            <span className="res-foot-right">
                                <span className="res-muted">Klik baris untuk melihat perubahan nilai</span>
                                {meta && <ResPager page={page} totalPages={meta.totalPages} onChange={setPage} />}
                            </span>
                        </>
                    )}>
                    {isLoading ? <ResSkeletonRows rows={8} /> : logs.length === 0 ? (
                        <ResEmpty icon={FileSearch} title="Tidak ada audit log">Coba ubah filter atau kata kunci.</ResEmpty>
                    ) : logs.map((log) => {
                        const open = expandedRows.has(log.id);
                        const hasDiff = Boolean(log.oldValue || log.newValue);
                        const cfg = ACTION_CONFIG[log.action];
                        const link = log.entityId ? entityLink(log) : null;
                        const detailId = `audit-detail-${log.id}`;
                        const name = log.user?.fullName || 'System';
                        return (
                            <React.Fragment key={log.id}>
                                {/* Mouse: anywhere on the row toggles; keyboard/AT: the disclosure button in the first cell. */}
                                <ResRow className={cn('is-link', open && 'is-open')} onClick={() => toggleExpand(log.id)}>
                                    <button type="button" className="res-row-toggle grid place-items-center" aria-expanded={open} aria-controls={detailId}
                                        aria-label={`${open ? 'Tutup' : 'Buka'} detail log ${cfg?.label ?? log.action}`}
                                        onClick={(e) => { e.stopPropagation(); toggleExpand(log.id); }}>
                                        <ChevronRight className="res-chev" aria-hidden="true" />
                                    </button>
                                    <span className="res-date text-left">{formatDate(log.createdAt)}</span>
                                    <div className="queue-person res-hide-m">
                                        {log.user ? <DashAvatar name={name} /> : <span className="dash-avatar" style={{ ['--c' as string]: 'var(--dash-gray)' }}><Cpu className="w-3.5 h-3.5" aria-hidden="true" /></span>}
                                        <div className="min-w-0"><b>{name}</b>{log.user?.email && <small>{log.user.email}</small>}</div>
                                    </div>
                                    <span><ResBub color={cfg?.hue ?? 'var(--dash-gray)'}>{cfg?.label ?? log.action}</ResBub></span>
                                    <span className="res-cell res-hide-m">
                                        <b className="capitalize">{ENTITY_TYPE_LABELS[log.entityType] ?? log.entityType}</b>{' '}
                                        {log.entityId && (link ? (
                                            <Link to={link} onClick={(e) => e.stopPropagation()} className="font-mono text-[11.5px] text-[hsl(var(--idesk-sapphire))] hover:underline">#{log.entityId.slice(0, 8)}</Link>
                                        ) : <span className="font-mono text-[11.5px] res-muted">#{log.entityId.slice(0, 8)}</span>)}
                                    </span>
                                    <span className="res-cell res-hide-m" title={log.description ?? undefined}>{log.description || '—'}</span>
                                    <span className="res-cell is-mono res-hide-m">{log.ipAddress || '—'}</span>
                                </ResRow>
                                {open && (
                                    <div role="row" className="res-row-detail res-row-drawer pt-3">
                                        <div role="cell" aria-colspan={7}>
                                        <section id={detailId} aria-label={`Detail ${cfg?.label ?? log.action}`}>
                                        {hasDiff && (
                                            <div className="mg-diff mb-2">
                                                <div><small>Sebelum</small>{fmtJson(log.oldValue)}</div>
                                                <div><small>Sesudah</small>{fmtJson(log.newValue)}</div>
                                            </div>
                                        )}
                                        <p className="m-0 text-xs text-[hsl(var(--idesk-text-secondary))]"><b className="text-[hsl(var(--idesk-text))]">Full Description:</b> {log.description || 'No description provided.'}</p>
                                        </section>
                                        </div>
                                    </div>
                                )}
                            </React.Fragment>
                        );
                    })}
                </ResTable>
            )}
        </div>
    );
};

export default AuditLogPage;
