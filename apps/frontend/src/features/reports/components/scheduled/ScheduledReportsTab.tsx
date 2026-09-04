import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Clock,
    Plus,
    FileSpreadsheet,
    Users,
    BarChart3,
    Play,
    History,
    Pencil,
    Trash2,
    Search,
    Building2,
    Calendar,
    CheckCircle2,
    AlertCircle,
    Loader2,
    Filter,
    ArrowUpRight,
    Mail,
    Send
} from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import {
    ScheduledReportConfig,
    ReportType,
    ScheduleType,
    TargetAgentCategory
} from './types';
import { ScheduledReportModal } from './ScheduledReportModal';
import { ScheduledExecutionHistoryModal } from './ScheduledExecutionHistoryModal';
import { formatDistanceToNow, format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

interface ScheduledReportsTabProps {
    canManage: boolean;
    currentSiteId?: string;
}

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

    const getReportTypeBadge = (type: ReportType, targetAgentCategory?: TargetAgentCategory) => {
        switch (type) {
            case 'MONTHLY_SUMMARY':
                return {
                    label: 'Monthly Summary',
                    icon: FileSpreadsheet,
                    color: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800/80',
                };
            case 'AGENT_PERFORMANCE':
                return {
                    label: targetAgentCategory ? `Agent Perf (${targetAgentCategory})` : 'Agent Performance',
                    icon: Users,
                    color: 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/60 border-purple-200 dark:border-purple-800/80',
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

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Top Metric Strip */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Active Schedules Overview */}
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                        <span>Active Schedules</span>
                        <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                            <Clock className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="mt-3">
                        <div className="text-2xl font-extrabold text-slate-900 dark:text-white">
                            {activeCount} <span className="text-sm font-normal text-slate-400">/ {totalCount} total</span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            Automated recurring report jobs
                        </p>
                    </div>
                </div>

                {/* Daily Cadence */}
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                        <span>Daily Schedules</span>
                        <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                            <Calendar className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="mt-3">
                        <div className="text-2xl font-extrabold text-blue-600 dark:text-blue-400">
                            {dailyCount}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            Dispatched every day
                        </p>
                    </div>
                </div>

                {/* Weekly Cadence */}
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                        <span>Weekly Schedules</span>
                        <div className="w-7 h-7 rounded-lg bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                            <Send className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="mt-3">
                        <div className="text-2xl font-extrabold text-purple-600 dark:text-purple-400">
                            {weeklyCount}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            Dispatched Mondays
                        </p>
                    </div>
                </div>

                {/* Monthly Cadence */}
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                        <span>Monthly Schedules</span>
                        <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                            <Mail className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="mt-3">
                        <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
                            {monthlyCount}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            Dispatched 1st of month
                        </p>
                    </div>
                </div>
            </div>

            {/* Toolbar: Search, Filters & Actions */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
                {/* Search Bar */}
                <div className="relative flex-1 min-w-[240px]">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search schedules by name, site, or report type..."
                        className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/80 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                    />
                </div>

                {/* Filter Pills */}
                <div className="flex flex-wrap items-center gap-2">
                    {/* Status Filter */}
                    <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                        {(['ALL', 'ACTIVE', 'PAUSED'] as const).map((st) => (
                            <button
                                key={st}
                                onClick={() => setStatusFilter(st)}
                                className={cn(
                                    "px-3 py-1 text-xs rounded-lg font-semibold transition-all",
                                    statusFilter === st
                                        ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                                        : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                                )}
                            >
                                {st === 'ALL' ? 'All Status' : st === 'ACTIVE' ? 'Active' : 'Paused'}
                            </button>
                        ))}
                    </div>

                    {/* Create Button */}
                    {canManage && (
                        <button
                            onClick={handleOpenCreate}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white font-semibold text-xs hover:bg-primary/90 transition-all shadow-sm active:scale-[0.98] shrink-0"
                        >
                            <Plus className="w-4 h-4" />
                            <span>New Schedule</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Scheduled Reports List / Table */}
            {isLoading ? (
                <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                        Loading scheduled reports...
                    </span>
                </div>
            ) : isError ? (
                <div className="p-6 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 flex items-center gap-3 text-sm">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <span>Failed to load scheduled reports. Please refresh the page.</span>
                </div>
            ) : filteredConfigs.length === 0 ? (
                <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3">
                        <Clock className="w-6 h-6" />
                    </div>
                    <h4 className="text-base font-bold text-slate-800 dark:text-white">
                        {searchQuery || statusFilter !== 'ALL'
                            ? 'No schedules match your filters'
                            : 'No Scheduled Reports Configured'}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1 mb-4">
                        {searchQuery || statusFilter !== 'ALL'
                            ? 'Try changing or clearing your search keywords or status filter.'
                            : 'Set up recurring email reports to keep management and site agents updated automatically.'}
                    </p>
                    {canManage && !searchQuery && statusFilter === 'ALL' && (
                        <button
                            onClick={handleOpenCreate}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white font-semibold text-xs hover:bg-primary/90 transition-all shadow-sm"
                        >
                            <Plus className="w-4 h-4" />
                            <span>Create First Schedule</span>
                        </button>
                    )}
                </div>
            ) : (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs bg-white dark:bg-slate-900">
                            <thead>
                                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/90 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                                    <th className="px-6 py-3.5">Report & Name</th>
                                    <th className="px-4 py-3.5">Site</th>
                                    <th className="px-4 py-3.5">Frequency & Time</th>
                                    <th className="px-4 py-3.5">Recipients</th>
                                    <th className="px-4 py-3.5">Last Dispatched</th>
                                    <th className="px-4 py-3.5">Status</th>
                                    <th className="px-6 py-3.5 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 bg-white dark:bg-slate-900">
                                {filteredConfigs.map((cfg) => {
                                    const typeInfo = getReportTypeBadge(cfg.reportType, cfg.targetAgentCategory);
                                    const TypeIcon = typeInfo.icon;
                                    const siteInfo = siteMap.get(cfg.siteId);
                                    const isTriggering = triggeringId === cfg.id;

                                    return (
                                        <tr
                                            key={cfg.id}
                                            className="hover:bg-slate-50/80 dark:hover:bg-slate-800/60 transition-colors group bg-white dark:bg-slate-900"
                                        >
                                            {/* Report & Name */}
                                            <td className="px-6 py-4">
                                                <div className="flex items-start gap-3">
                                                    <div className={cn(
                                                        "w-8 h-8 rounded-xl flex items-center justify-center border shrink-0 mt-0.5",
                                                        typeInfo.color
                                                    )}>
                                                        <TypeIcon className="w-4 h-4" />
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-slate-900 dark:text-white text-sm">
                                                            {cfg.name}
                                                        </div>
                                                        <div className="flex items-center gap-1.5 mt-0.5">
                                                            <span className={cn(
                                                                "px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border",
                                                                typeInfo.color
                                                            )}>
                                                                {typeInfo.label}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Site */}
                                            <td className="px-4 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-medium">
                                                    <Building2 className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                                                    <span>{siteInfo ? `${siteInfo.code} — ${siteInfo.name}` : cfg.site?.name || 'Site Isolated'}</span>
                                                </div>
                                            </td>

                                            {/* Frequency & Time */}
                                            <td className="px-4 py-4 whitespace-nowrap">
                                                <div className="space-y-0.5">
                                                    <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                                        <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                                                        <span>{cfg.schedule} at <strong className="font-mono text-slate-900 dark:text-white">{cfg.sendTime}</strong></span>
                                                    </div>
                                                    <span className="text-[10px] text-slate-400 dark:text-slate-500 block pl-5">
                                                        WIB (Asia/Jakarta)
                                                    </span>
                                                </div>
                                            </td>

                                            {/* Recipients */}
                                            <td className="px-4 py-4 whitespace-nowrap">
                                                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium">
                                                    <Users className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                                                    <span>{cfg.recipientUserIds.length} agent{cfg.recipientUserIds.length !== 1 ? 's' : ''}</span>
                                                </div>
                                            </td>

                                            {/* Last Dispatched */}
                                            <td className="px-4 py-4 whitespace-nowrap">
                                                {cfg.lastRunAt ? (
                                                    <div className="space-y-0.5">
                                                        <div className="text-slate-800 dark:text-slate-200 font-medium flex items-center gap-1.5">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                                                            <span>{format(new Date(cfg.lastRunAt), 'dd MMM yyyy, HH:mm')}</span>
                                                        </div>
                                                        <span className="text-[10px] text-slate-400 dark:text-slate-500 block pl-3">
                                                            {formatDistanceToNow(new Date(cfg.lastRunAt), { addSuffix: true, locale: idLocale })}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-400 dark:text-slate-500 italic">Never executed</span>
                                                )}
                                            </td>

                                            {/* Status Switch */}
                                            <td className="px-4 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-2">
                                                    <Switch
                                                        checked={cfg.isActive}
                                                        onCheckedChange={(checked) => {
                                                            if (!canManage) return;
                                                            toggleMutation.mutate({ id: cfg.id, isActive: checked });
                                                        }}
                                                        disabled={!canManage || toggleMutation.isPending}
                                                        aria-label="Toggle active status"
                                                    />
                                                    <span
                                                        className={cn(
                                                            "text-[11px] font-bold uppercase tracking-wider",
                                                            cfg.isActive
                                                                ? "text-emerald-600 dark:text-emerald-400"
                                                                : "text-slate-400 dark:text-slate-500"
                                                        )}
                                                    >
                                                        {cfg.isActive ? 'Active' : 'Paused'}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* Actions */}
                                            <td className="px-6 py-4 whitespace-nowrap text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    {/* History */}
                                                    <button
                                                        onClick={() => setHistoryModalConfig(cfg)}
                                                        className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white transition-colors"
                                                        title="View Execution History"
                                                    >
                                                        <History className="w-3.5 h-3.5" />
                                                    </button>

                                                    {canManage && (
                                                        <>
                                                            {/* Trigger Now */}
                                                            <button
                                                                onClick={() => triggerMutation.mutate(cfg.id)}
                                                                disabled={isTriggering || triggerMutation.isPending}
                                                                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-primary hover:bg-primary/10 hover:border-primary/40 dark:hover:bg-primary/20 transition-colors disabled:opacity-50"
                                                                title="Trigger & Dispatch Now"
                                                            >
                                                                {isTriggering ? (
                                                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                                ) : (
                                                                    <Play className="w-3.5 h-3.5" />
                                                                )}
                                                            </button>

                                                            {/* Edit */}
                                                            <button
                                                                onClick={() => handleOpenEdit(cfg)}
                                                                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white transition-colors"
                                                                title="Edit Schedule"
                                                            >
                                                                <Pencil className="w-3.5 h-3.5" />
                                                            </button>

                                                            {/* Delete */}
                                                            <button
                                                                onClick={() => setConfigToDelete(cfg)}
                                                                className="p-1.5 rounded-lg border border-red-200 dark:border-red-900/60 bg-white dark:bg-slate-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                                                                title="Delete Schedule"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

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
