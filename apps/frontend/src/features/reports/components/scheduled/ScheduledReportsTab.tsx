import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Clock, Plus, FileSpreadsheet, Users, BarChart3, Play, History, Pencil, Trash2,
    Calendar, CalendarPlus, AlertCircle, Loader2, Mail, Send,
} from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { MgStat, MgSwitch } from '@/components/management/MgmtParts';
import { ResBub, ResEmpty, ResSearch, ResSkeletonRows, ResRow, ResTable } from '@/components/resources/ResourceParts';
import { DashSeg } from '@/features/dashboard/components/DashboardParts';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import {
    ScheduledReportConfig,
    ReportType,
    ScheduleType,
} from './types';
import { reportTeamLabel } from '../../reportTeams';
import { ScheduledReportModal } from './ScheduledReportModal';
import { ScheduledExecutionHistoryModal } from './ScheduledExecutionHistoryModal';
import { formatDistanceToNow, format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

interface ScheduledReportsTabProps {
    canManage: boolean;
    currentSiteId?: string;
}

/** Mockup reports.html Scheduled: name, type & team, schedule, site, recipients, switch, last run, actions. */
const SCHED_COLS = 'minmax(200px,1.5fr) minmax(150px,1fr) minmax(150px,1fr) 70px 80px 56px 150px 128px';

export const ScheduledReportsTab: React.FC<ScheduledReportsTabProps> = ({
    canManage,
    currentSiteId,
}) => {
    const queryClient = useQueryClient();

    // Modals state
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editingConfig, setEditingConfig] = useState<ScheduledReportConfig | null>(null);
    const [historyModalConfig, setHistoryModalConfig] = useState<ScheduledReportConfig | null>(null);

    // Delete confirmation state
    const [configToDelete, setConfigToDelete] = useState<ScheduledReportConfig | null>(null);

    // Filters state
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'PAUSED'>('ALL');
    const [typeFilter, setTypeFilter] = useState<ReportType | 'ALL'>('ALL');

    // Triggering state tracker for individual configs
    const [triggeringId, setTriggeringId] = useState<string | null>(null);

    // Fetch Scheduled Configs
    const {
        data: configsData,
        isLoading,
        isError,
    } = useQuery<{ success: boolean; data: ScheduledReportConfig[] }>({
        queryKey: ['reports', 'scheduled'],
        queryFn: async () => {
            const response = await api.get('/reports/scheduled');
            return response.data;
        },
        staleTime: 30000,
    });

    const scheduledConfigs = configsData?.data || [];

    // Fetch Sites for resolving site names if needed
    const { data: sitesData = [] } = useQuery<Array<{ id: string; code: string; name: string }>>({
        queryKey: ['sites-active'],
        queryFn: async () => {
            const res = await api.get('/sites/active');
            return res.data;
        },
        staleTime: 5 * 60 * 1000,
    });

    const siteMap = useMemo(() => {
        const map = new Map<string, { code: string; name: string }>();
        sitesData.forEach((s) => map.set(s.id, s));
        return map;
    }, [sitesData]);

    // Mutations
    const createMutation = useMutation({
        mutationFn: async (payload: any) => {
            const res = await api.post('/reports/scheduled', payload);
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['reports', 'scheduled'] });
            toast.success('Scheduled report created successfully');
            setIsCreateModalOpen(false);
            setEditingConfig(null);
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.message || 'Failed to create scheduled report');
        },
    });

    const updateMutation = useMutation({
        mutationFn: async ({ id, payload }: { id: string; payload: any }) => {
            const res = await api.patch(`/reports/scheduled/${id}`, payload);
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['reports', 'scheduled'] });
            toast.success('Scheduled report updated successfully');
            setIsCreateModalOpen(false);
            setEditingConfig(null);
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.message || 'Failed to update scheduled report');
        },
    });

    const toggleMutation = useMutation({
        mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
            const res = await api.patch(`/reports/scheduled/${id}/toggle`, { isActive });
            return res.data;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['reports', 'scheduled'] });
            toast.success(`Scheduled report ${variables.isActive ? 'activated' : 'paused'}`);
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.message || 'Failed to toggle status');
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await api.delete(`/reports/scheduled/${id}`);
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['reports', 'scheduled'] });
            toast.success('Scheduled report deleted');
            setConfigToDelete(null);
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.message || 'Failed to delete scheduled report');
        },
    });

    const triggerMutation = useMutation({
        mutationFn: async (id: string) => {
            setTriggeringId(id);
            const res = await api.post(`/reports/scheduled/${id}/trigger`);
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['reports', 'scheduled'] });
            queryClient.invalidateQueries({ queryKey: ['reports', 'scheduled', 'executions'] });
            toast.success('Report dispatched. Check execution history shortly.');
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.message || 'Failed to trigger report dispatch');
        },
        onSettled: () => {
            setTriggeringId(null);
        },
    });

    // Stats calculations
    const totalCount = scheduledConfigs.length;
    const activeCount = scheduledConfigs.filter((c) => c.isActive).length;
    const dailyCount = scheduledConfigs.filter((c) => c.schedule === 'DAILY').length;
    const weeklyCount = scheduledConfigs.filter((c) => c.schedule === 'WEEKLY').length;
    const monthlyCount = scheduledConfigs.filter((c) => c.schedule === 'MONTHLY').length;

    // Filtered configs
    const filteredConfigs = useMemo(() => {
        return scheduledConfigs.filter((c) => {
            if (statusFilter === 'ACTIVE' && !c.isActive) return false;
            if (statusFilter === 'PAUSED' && c.isActive) return false;
            if (typeFilter !== 'ALL' && c.reportType !== typeFilter) return false;

            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const site = siteMap.get(c.siteId);
                const matchesName = c.name.toLowerCase().includes(q);
                const matchesSite = site ? site.name.toLowerCase().includes(q) || site.code.toLowerCase().includes(q) : false;
                const matchesType = c.reportType.toLowerCase().includes(q);
                if (!matchesName && !matchesSite && !matchesType) return false;
            }

            return true;
        });
    }, [scheduledConfigs, statusFilter, typeFilter, searchQuery, siteMap]);

    // Helpers
    const handleOpenCreate = () => {
        setEditingConfig(null);
        setIsCreateModalOpen(true);
    };

    const handleOpenEdit = (config: ScheduledReportConfig) => {
        setEditingConfig(config);
        setIsCreateModalOpen(true);
    };

    const handleSaveConfig = (payload: any) => {
        if (editingConfig) {
            updateMutation.mutate({ id: editingConfig.id, payload });
        } else {
            createMutation.mutate(payload);
        }
    };

    const getReportTypeBadge = (type: ReportType) => {
        switch (type) {
            case 'MONTHLY_SUMMARY':
                return {
                    label: 'Monthly Summary',
                    icon: FileSpreadsheet,
                    color: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800/80',
                };
            case 'AGENT_PERFORMANCE':
                return {
                    label: 'Agent Performance',
                    icon: Users,
                    color: 'text-[#2d4a8c] dark:text-[#a9bdf0] bg-[#2d4a8c]/8 dark:bg-[#2d4a8c]/25 border-[#2d4a8c]/20',
                };
            case 'TICKET_VOLUME':
                return {
                    label: 'Ticket Volume',
                    icon: BarChart3,
                    color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800/80',
                };
            default:
                return {
                    label: type,
                    icon: Clock,
                    color: 'text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700',
                };
        }
    };

    const SCHEDULE_LABEL: Record<string, string> = { DAILY: 'Setiap hari', WEEKLY: 'Setiap Senin', MONTHLY: 'Setiap tanggal 1' };

    return (
        <div>
            <section className="res-stats is-four" aria-label="Ringkasan jadwal">
                <MgStat icon={Clock} tone="blue" label="Active Schedules" value={<>{activeCount}<small className="text-sm font-medium text-[var(--td-text-3)]"> / {totalCount}</small></>} sub="Automated recurring report jobs" />
                <MgStat icon={Calendar} tone="sky" label="Daily Schedules" value={dailyCount} zero={dailyCount === 0} sub="Dispatched every day" />
                <MgStat icon={Send} tone="navy" label="Weekly Schedules" value={weeklyCount} zero={weeklyCount === 0} sub="Dispatched Mondays" />
                <MgStat icon={Mail} tone="green" label="Monthly Schedules" value={monthlyCount} zero={monthlyCount === 0} sub="Dispatched 1st of month" />
            </section>

            <ResTable label="Scheduled Reports" cols={SCHED_COLS} colsMobile="minmax(0,1fr) auto"
                tools={(
                    <>
                        <h3>Scheduled Reports</h3>
                        <span className="res-spacer" />
                        {canManage && <Button variant="soft" onClick={handleOpenCreate}><CalendarPlus aria-hidden="true" />New Schedule</Button>}
                    </>
                )}
                subTools={(
                    <>
                        <ResSearch id="sched-search" value={searchQuery} onChange={setSearchQuery} placeholder="Search schedules by name, site, or report type..." label="Cari jadwal" />
                        <DashSeg aria-label="Status jadwal" value={statusFilter} onChange={setStatusFilter} options={[
                            { value: 'ALL', label: 'All Status' }, { value: 'ACTIVE', label: 'Active' }, { value: 'PAUSED', label: 'Paused' },
                        ]} />
                    </>
                )}
                head={!isLoading && !isError && filteredConfigs.length > 0 ? (
                    <><span>Nama</span><span>Jenis &amp; tim</span><span>Jadwal</span><span>Site</span><span>Penerima</span><span>Aktif</span><span>Eksekusi terakhir</span><span className="is-right">Aksi</span></>
                ) : undefined}>
                {isLoading ? <ResSkeletonRows rows={3} /> : isError ? (
                    <ResEmpty icon={AlertCircle} title="Gagal memuat">Failed to load scheduled reports. Please refresh the page.</ResEmpty>
                ) : filteredConfigs.length === 0 ? (
                    <ResEmpty icon={Clock} title={searchQuery || statusFilter !== 'ALL' ? 'No schedules match your filters' : 'No Scheduled Reports Configured'}
                        cta={canManage && !searchQuery && statusFilter === 'ALL' ? <Button variant="primary" onClick={handleOpenCreate}><Plus aria-hidden="true" />Create First Schedule</Button> : undefined}>
                        {searchQuery || statusFilter !== 'ALL'
                            ? 'Try changing or clearing your search keywords or status filter.'
                            : 'Set up recurring email reports to keep management and site agents updated automatically.'}
                    </ResEmpty>
                ) : filteredConfigs.map((cfg) => {
                    const typeInfo = getReportTypeBadge(cfg.reportType);
                    const siteInfo = siteMap.get(cfg.siteId);
                    const isTriggering = triggeringId === cfg.id;
                    const teamLabel = reportTeamLabel(cfg.targetTeam ?? (cfg.targetAgentCategory === 'REGULAR' ? 'OPS_SUPPORT' : cfg.targetAgentCategory === 'ORACLE' ? 'ORACLE_DEV' : null));
                    return (
                        <ResRow key={cfg.id} className="is-static">
                            <div className="res-tk">
                                <span className="res-tk-title">{cfg.name}</span>
                                <span className="res-tk-id" style={{ fontFamily: 'var(--font-sans)' }}>{typeInfo.label} · {SCHEDULE_LABEL[cfg.schedule] ?? cfg.schedule}, {cfg.sendTime}</span>
                            </div>
                            <span className="res-cell res-hide-m">{typeInfo.label} · {teamLabel}</span>
                            <span className="res-cell res-hide-m" title="WIB (Asia/Jakarta)">{SCHEDULE_LABEL[cfg.schedule] ?? cfg.schedule}, <span className="font-mono">{cfg.sendTime}</span> WIB</span>
                            <span className="res-hide-m">{siteInfo || cfg.site ? <ResBub color="var(--dash-gray)" mono plain title={siteInfo?.name ?? cfg.site?.name}>{siteInfo?.code ?? cfg.site?.code ?? cfg.site?.name}</ResBub> : <span className="res-muted">Site Isolated</span>}</span>
                            <span className="res-cell res-hide-m">{cfg.recipientUserIds.length} agent{cfg.recipientUserIds.length !== 1 ? 's' : ''}</span>
                            <span>
                                <MgSwitch checked={cfg.isActive} label={`Aktifkan ${cfg.name}`} disabled={!canManage || toggleMutation.isPending}
                                    onChange={(checked) => { if (canManage) toggleMutation.mutate({ id: cfg.id, isActive: checked }); }} />
                            </span>
                            <span className="res-hide-m">
                                {cfg.lastRunAt ? (
                                    <ResBub color="var(--dash-green)" ink="var(--dash-ink-green)" title={formatDistanceToNow(new Date(cfg.lastRunAt), { addSuffix: true, locale: idLocale })}>
                                        {format(new Date(cfg.lastRunAt), 'd MMM yyyy, HH.mm', { locale: idLocale })}
                                    </ResBub>
                                ) : !cfg.isActive ? <ResBub color="var(--dash-gray)">Dijeda</ResBub> : <span className="res-muted">Never executed</span>}
                            </span>
                            <span className="res-acts res-wide-m" role="group" aria-label={`Aksi ${cfg.name}`}>
                                <button type="button" className="res-icon-btn" onClick={() => setHistoryModalConfig(cfg)} title="View Execution History" aria-label={`Riwayat eksekusi ${cfg.name}`}><History aria-hidden="true" /></button>
                                {canManage && (
                                    <>
                                        <button type="button" className="res-icon-btn" onClick={() => triggerMutation.mutate(cfg.id)} disabled={isTriggering || triggerMutation.isPending}
                                            title="Trigger & Dispatch Now" aria-label={`Kirim sekarang ${cfg.name}`} aria-busy={isTriggering || undefined}>
                                            {isTriggering ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Play aria-hidden="true" />}
                                        </button>
                                        <button type="button" className="res-icon-btn" onClick={() => handleOpenEdit(cfg)} title="Edit Schedule" aria-label={`Edit ${cfg.name}`}><Pencil aria-hidden="true" /></button>
                                        <button type="button" className="res-icon-btn is-danger" onClick={() => setConfigToDelete(cfg)} title="Delete Schedule" aria-label={`Hapus ${cfg.name}`}><Trash2 aria-hidden="true" /></button>
                                    </>
                                )}
                            </span>
                        </ResRow>
                    );
                })}
            </ResTable>

            {/* Create / Edit Modal */}
            <ScheduledReportModal
                isOpen={isCreateModalOpen}
                onClose={() => {
                    setIsCreateModalOpen(false);
                    setEditingConfig(null);
                }}
                editingConfig={editingConfig}
                currentSiteId={currentSiteId}
                onSave={handleSaveConfig}
                isSaving={createMutation.isPending || updateMutation.isPending}
            />

            {/* Execution History Modal */}
            {historyModalConfig && (
                <ScheduledExecutionHistoryModal
                    config={historyModalConfig}
                    onClose={() => setHistoryModalConfig(null)}
                />
            )}

            {/* Delete Confirmation Dialog */}
            <ConfirmationDialog
                isOpen={!!configToDelete}
                title="Delete Scheduled Report"
                description={`Are you sure you want to delete "${configToDelete?.name}"? Scheduled email dispatches will be stopped immediately.`}
                confirmText="Delete Schedule"
                cancelText="Cancel"
                variant="destructive"
                onConfirm={() => {
                    if (configToDelete) {
                        deleteMutation.mutate(configToDelete.id);
                    }
                }}
                onCancel={() => setConfigToDelete(null)}
                isLoading={deleteMutation.isPending}
            />
        </div>
    );
};
