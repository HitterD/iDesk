import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { TooltipProvider } from '@/components/ui/tooltip';
import { SiteTabs } from '@/components/site/SiteTabs';
import { workloadApi, AgentWorkloadDto } from '@/lib/api/workload.api';
import { toast } from 'sonner';
import { PriorityWeightsDialog } from '../components/PriorityWeightsDialog';
import { AgentPersonalWorkloadCard } from '../components/AgentPersonalWorkloadCard';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { useAuth } from '@/stores/useAuth';
import { formatDistanceToNow, format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { RefreshCw, Users, Shield, Zap } from 'lucide-react';

type FilterStatus = 'ALL' | 'STANDBY' | 'ACTIVE';
type SortOption = 'POINTS_ASC' | 'POINTS_DESC' | 'NAME_ASC' | 'TICKETS_DESC';

export const AdminWorkloadDashboard: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();

    const isAdmin = user?.role === 'ADMIN';
    const isManager = user?.role === 'MANAGER';
    const isAgentOps = user?.role === 'AGENT_OPERATIONAL_SUPPORT' || user?.role === 'AGENT' || user?.role === 'AGENT_ADMIN';

    const [agents, setAgents] = useState<AgentWorkloadDto[]>([]);
    const [loading, setLoading] = useState(true);
    const [recalculating, setRecalculating] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    
    // For non-cross-site roles (agents), default immediately to user's site
    const [activeSiteId, setActiveSiteId] = useState<string>(
        !isAdmin && !isManager && user?.siteId ? user.siteId : ''
    );

    // Filter & Search states
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<FilterStatus>('ALL');
    const [sortBy, setSortBy] = useState<SortOption>('POINTS_ASC');

    // If non-admin/non-manager logs in and activeSiteId was not yet set from user.siteId
    useEffect(() => {
        if (!isAdmin && !isManager && user?.siteId && !activeSiteId) {
            setActiveSiteId(user.siteId);
        }
    }, [isAdmin, isManager, user?.siteId, activeSiteId]);

    useEffect(() => {
        if (activeSiteId) {
            fetchWorkloads();
        }
    }, [activeSiteId]);

    const fetchWorkloads = async () => {
        if (!activeSiteId) return;
        setLoading(true);
        setError(null);
        try {
            const response = await workloadApi.getAllAgentWorkloads(activeSiteId);
            setAgents(response.data || []);
        } catch (err: any) {
            console.error('Failed to fetch workloads:', err);
            const message = err.response?.data?.message || 'Gagal memuat data workload agen';
            setError(message);
            toast.error(message);
        } finally {
            setLoading(false);
        }
    };

    const handleRecalculate = async (agentId: string) => {
        if (!activeSiteId || !isAdmin) return;
        setRecalculating(agentId);
        try {
            await workloadApi.recalculateAgentWorkload(agentId, activeSiteId);
            toast.success('Poin beban berhasil disinkronisasi ulang');
            fetchWorkloads();
        } catch (err: any) {
            console.error('Failed to recalculate:', err);
            toast.error(err.response?.data?.message || 'Gagal menghitung ulang beban agen');
        } finally {
            setRecalculating(null);
        }
    };

    // Personal workload of the logged-in agent (if agent)
    const myPersonalWorkload = useMemo(() => {
        if (!user?.id) return null;
        return agents.find(a => a.agentId === user.id) || null;
    }, [agents, user?.id]);

    // Calculate aggregated metrics
    const metrics = useMemo(() => {
        const totalAgents = agents.length;
        const standbyAgents = agents.filter(a => (a.totalPoints || 0) === 0).length;
        const activeAgents = totalAgents - standbyAgents;
        const totalPoints = agents.reduce((acc, a) => acc + (a.totalPoints || 0), 0);
        const avgPoints = totalAgents > 0 ? (totalPoints / totalAgents).toFixed(1) : '0';
        const totalTickets = agents.reduce((acc, a) => acc + (a.activeTicketsCount || a.activeTickets?.length || 0), 0);
        
        // Find minimum points for assignment priority identification
        const minPoints = totalAgents > 0 ? Math.min(...agents.map(a => a.totalPoints || 0)) : 0;

        return {
            totalAgents,
            standbyAgents,
            activeAgents,
            totalPoints,
            avgPoints,
            totalTickets,
            minPoints
        };
    }, [agents]);

    // Filter and sort agents
    const filteredAgents = useMemo(() => {
        return agents
            .filter(agent => {
                // Search filter
                if (searchTerm.trim()) {
                    const q = searchTerm.toLowerCase();
                    const matchName = agent.agentName?.toLowerCase().includes(q);
                    const matchEmail = agent.email?.toLowerCase().includes(q);
                    const matchRole = agent.role?.toLowerCase().includes(q);
                    if (!matchName && !matchEmail && !matchRole) return false;
                }

                // Status filter
                if (statusFilter === 'STANDBY') {
                    return (agent.totalPoints || 0) === 0;
                }
                if (statusFilter === 'ACTIVE') {
                    return (agent.totalPoints || 0) > 0;
                }
                return true;
            })
            .sort((a, b) => {
                const pointsA = a.totalPoints || 0;
                const pointsB = b.totalPoints || 0;
                const ticketsA = a.activeTicketsCount || a.activeTickets?.length || 0;
                const ticketsB = b.activeTicketsCount || b.activeTickets?.length || 0;

                switch (sortBy) {
                    case 'POINTS_ASC':
                        return pointsA - pointsB;
                    case 'POINTS_DESC':
                        return pointsB - pointsA;
                    case 'NAME_ASC':
                        return (a.agentName || '').localeCompare(b.agentName || '');
                    case 'TICKETS_DESC':
                        return ticketsB - ticketsA;
                    default:
                        return pointsA - pointsB;
                }
            });
    }, [agents, searchTerm, statusFilter, sortBy]);

    const getRoleBadge = (role: string) => {
        switch (role) {
            case 'ADMIN':
                return (
                    <Badge variant="outline" className="bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 border-red-200 dark:border-red-800/40 font-medium text-xs px-2 py-0.5">
                        Admin
                    </Badge>
                );
            case 'AGENT_ADMIN':
                return (
                    <Badge variant="outline" className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700 font-medium text-xs px-2 py-0.5">
                        Admin Agent
                    </Badge>
                );
            case 'AGENT_ORACLE':
                return (
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-800/40 font-medium text-xs px-2 py-0.5">
                        Oracle Specialist
                    </Badge>
                );
            case 'AGENT_OPERATIONAL_SUPPORT':
                return (
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/40 font-medium text-xs px-2 py-0.5">
                        Operational Support
                    </Badge>
                );
            default:
                return (
                    <Badge variant="outline" className="text-slate-600 dark:text-slate-400 font-medium text-xs px-2 py-0.5">
                        {role.replace('AGENT_', '').replace(/_/g, ' ')}
                    </Badge>
                );
        }
    };

    const getWorkloadStatus = (points: number) => {
        if (points === 0) {
            return {
                label: 'Standby',
                color: 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/40',
                dotColor: 'bg-emerald-500',
                progressColor: 'bg-emerald-500',
                percentage: 0,
            };
        }
        if (points <= 3) {
            return {
                label: 'Optimal',
                color: 'text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800/40',
                dotColor: 'bg-blue-500',
                progressColor: 'bg-blue-500',
                percentage: Math.min(100, Math.round((points / 8) * 100)),
            };
        }
        if (points <= 6) {
            return {
                label: 'Padat',
                color: 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/40',
                dotColor: 'bg-amber-500',
                progressColor: 'bg-amber-500',
                percentage: Math.min(100, Math.round((points / 8) * 100)),
            };
        }
        return {
            label: 'Tinggi',
            color: 'text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/40',
            dotColor: 'bg-rose-500',
            progressColor: 'bg-rose-500',
            percentage: 100,
        };
    };

    const getPriorityDot = (priority: string) => {
        switch (priority?.toUpperCase()) {
            case 'CRITICAL':
                return 'bg-red-500 ring-2 ring-red-200 dark:ring-red-950';
            case 'HIGH':
                return 'bg-orange-500 ring-2 ring-orange-200 dark:ring-orange-950';
            case 'MEDIUM':
                return 'bg-amber-500 ring-2 ring-amber-200 dark:ring-amber-950';
            default:
                return 'bg-slate-400 ring-2 ring-slate-200 dark:ring-slate-800';
        }
    };

    if (error && !agents.length) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[420px] p-8 bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl text-center">
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">Gagal memuat</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mb-4">{error}</p>
                <Button onClick={fetchWorkloads} variant="outline" className="rounded-lg">
                    Coba lagi
                </Button>
            </div>
        );
    }

    return (
        <TooltipProvider>
            <div className="space-y-6 animate-fade-in-up pb-10">
                {/* Header Section */}
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                            {isAgentOps && !isAdmin ? 'Workload Operasional' : 'Workload Tim Agen'}
                        </h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                            {isAgentOps && !isAdmin
                                ? 'Ringkasan kapasitas beban kerja Anda & distribusi antrean rekan tim di site'
                                : 'Distribusi dan pemantauan beban kerja agen harian per site'}
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {/* SiteTabs is only for Cross-Site roles (Admin & Manager) */}
                        {(isAdmin || isManager) && (
                            <SiteTabs
                                selectedSiteId={activeSiteId}
                                onSelectionChange={setActiveSiteId}
                            />
                        )}

                        {/* Priority weights configuration is strictly for ADMIN */}
                        {isAdmin && <PriorityWeightsDialog />}

                        <Button
                            variant="outline"
                            onClick={fetchWorkloads}
                            disabled={!activeSiteId || loading}
                            className="rounded-xl h-9 px-4 text-xs font-medium gap-1.5 shadow-xs"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                            Segarkan
                        </Button>
                    </div>
                </div>

                {/* Personal Workload Hero Section (Shown for Agent Operational Support / Non-Admin logged-in Agent) */}
                {isAgentOps && (
                    <AgentPersonalWorkloadCard
                        workload={myPersonalWorkload}
                        siteName={agents[0]?.siteName}
                        loading={loading}
                    />
                )}

                {/* Metrics Cards (Shown for Admin / Manager, or supplementary stats for Agents) */}
                {(isAdmin || isManager) && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Agen */}
                        <div className="rounded-3xl border border-[hsl(var(--border))] bg-white/40 dark:bg-white/5 p-1.5 shadow-xs">
                            <div className="bg-[hsl(var(--card))] rounded-[20px] p-6">
                                <div className="font-mono text-4xl font-semibold tabular-nums text-slate-900 dark:text-white">
                                    {metrics.totalAgents}
                                </div>
                                <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">Total Agen Terdaftar</div>
                                <div className="mt-4 flex gap-3 text-xs">
                                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">{metrics.standbyAgents} standby</span>
                                    <span className="text-blue-600 dark:text-blue-400 font-medium">{metrics.activeAgents} aktif bertugas</span>
                                </div>
                            </div>
                        </div>

                        {/* Poin */}
                        <div className="rounded-3xl border border-[hsl(var(--border))] bg-white/40 dark:bg-white/5 p-1.5 shadow-xs">
                            <div className="bg-[hsl(var(--card))] rounded-[20px] p-6">
                                <div className="font-mono text-4xl font-semibold tabular-nums text-slate-900 dark:text-white">
                                    {metrics.totalPoints}
                                </div>
                                <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">Total Akumulasi Poin</div>
                                <div className="mt-4 text-xs text-slate-500 dark:text-slate-400">
                                    rata-rata {metrics.avgPoints} poin per agen
                                </div>
                            </div>
                        </div>

                        {/* Tiket */}
                        <div className="rounded-3xl border border-[hsl(var(--border))] bg-white/40 dark:bg-white/5 p-1.5 shadow-xs">
                            <div className="bg-[hsl(var(--card))] rounded-[20px] p-6">
                                <div className="font-mono text-4xl font-semibold tabular-nums text-slate-900 dark:text-white">
                                    {metrics.totalTickets}
                                </div>
                                <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">Tiket Aktif Dalam Proses</div>
                                <div className="mt-4 text-xs text-slate-500 dark:text-slate-400">
                                    dialokasikan di seluruh agen site
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Team Workload Table Section */}
                <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl shadow-xs overflow-hidden">
                    {/* Table Header Section Title (For Agent View) */}
                    {isAgentOps && (
                        <div className="px-6 py-4 border-b border-[hsl(var(--border))] bg-slate-50/70 dark:bg-slate-900/40 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Users className="w-4 h-4 text-primary" />
                                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                                    Distribusi Beban Rekan Tim Se-Site ({agents.length} Agen)
                                </h2>
                            </div>
                            <span className="text-xs text-slate-500">
                                {metrics.standbyAgents} Standby • {metrics.activeAgents} Bertugas
                            </span>
                        </div>
                    )}

                    {/* Table Toolbar (Search, Filter, Sort) */}
                    <div className="p-4 border-b border-[hsl(var(--border))] bg-slate-50/40 dark:bg-slate-900/20 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                        {/* Search & Filter pills */}
                        <div className="flex flex-wrap items-center gap-2.5 flex-1">
                            <div className="relative w-full sm:w-64">
                                <Input
                                    type="text"
                                    placeholder="Cari nama / email agen..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="h-9 text-xs rounded-xl bg-[hsl(var(--card))] border-[hsl(var(--border))] focus-visible:ring-primary pl-3"
                                />
                            </div>

                            {/* Status Filter Buttons */}
                            <div className="flex items-center bg-slate-200/60 dark:bg-slate-800/60 p-1 rounded-xl text-xs">
                                <button
                                    onClick={() => setStatusFilter('ALL')}
                                    className={`px-3 py-1 rounded-lg font-medium transition-colors duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] ${statusFilter === 'ALL' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'}`}
                                >
                                    Semua ({agents.length})
                                </button>
                                <button
                                    onClick={() => setStatusFilter('STANDBY')}
                                    className={`px-3 py-1 rounded-lg font-medium transition-colors duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] ${statusFilter === 'STANDBY' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'}`}
                                >
                                    Standby ({metrics.standbyAgents})
                                </button>
                                <button
                                    onClick={() => setStatusFilter('ACTIVE')}
                                    className={`px-3 py-1 rounded-lg font-medium transition-colors duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] ${statusFilter === 'ACTIVE' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'}`}
                                >
                                    Bertugas ({metrics.activeAgents})
                                </button>
                            </div>
                        </div>

                        {/* Sort selector */}
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500 font-medium">Urutkan</span>
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value as SortOption)}
                                className="h-9 text-xs font-medium rounded-xl bg-[hsl(var(--card))] border border-[hsl(var(--border))] text-slate-700 dark:text-slate-300 px-3 outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
                            >
                                <option value="POINTS_ASC">Poin terendah</option>
                                <option value="POINTS_DESC">Poin tertinggi</option>
                                <option value="TICKETS_DESC">Tiket terbanyak</option>
                                <option value="NAME_ASC">Nama A-Z</option>
                            </select>
                        </div>
                    </div>

                    {/* Table view */}
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-slate-50/60 dark:bg-slate-800/40">
                                <TableRow className="border-[hsl(var(--border))] hover:bg-transparent">
                                    <TableHead className="w-[280px] text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider h-11 pl-6">
                                        Agen Operasional
                                    </TableHead>
                                    <TableHead className="w-[160px] text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider h-11">
                                        Peran
                                    </TableHead>
                                    <TableHead className="w-[220px] text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider h-11">
                                        Beban Kerja & Kapasitas
                                    </TableHead>
                                    <TableHead className="w-[100px] text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-center h-11">
                                        Evaluasi
                                    </TableHead>
                                    <TableHead className="min-w-[260px] text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider h-11">
                                        Tiket Sedang Ditangani
                                    </TableHead>
                                    <TableHead className="w-[180px] text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider h-11">
                                        Penugasan Terakhir
                                    </TableHead>
                                    {isAdmin && (
                                        <TableHead className="text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider h-11 pr-6">
                                            Aksi
                                        </TableHead>
                                    )}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading && agents.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={isAdmin ? 7 : 6} className="h-64 text-center text-sm text-slate-500">
                                            <div className="flex flex-col items-center justify-center gap-2">
                                                <RefreshCw className="w-5 h-5 animate-spin text-primary opacity-60" />
                                                <span>Memuat data beban kerja...</span>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : filteredAgents.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={isAdmin ? 7 : 6} className="h-56 text-center text-slate-500">
                                            <div className="flex flex-col items-center justify-center gap-2.5 max-w-sm mx-auto">
                                                <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                                                    <Users className="w-6 h-6" />
                                                </div>
                                                <div className="font-semibold text-sm text-slate-800 dark:text-slate-200">
                                                    Tidak ada data agen yang cocok
                                                </div>
                                                <p className="text-xs text-slate-500">
                                                    {searchTerm ? 'Coba ubah kata kunci pencarian Anda.' : 'Belum ada agen operasional terdaftar di site ini.'}
                                                </p>
                                                {searchTerm && (
                                                    <button onClick={() => setSearchTerm('')} className="text-xs mt-2 underline text-slate-500 hover:text-slate-700">
                                                        reset filter
                                                    </button>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredAgents.map((agent) => {
                                        const points = agent.totalPoints || 0;
                                        const status = getWorkloadStatus(points);
                                        const isMinWorkload = points === metrics.minPoints && metrics.totalAgents > 1;
                                        const isMe = user?.id === agent.agentId;
                                        const tickets = agent.activeTickets || [];
                                        const displayTickets = tickets.slice(0, 2);
                                        const remainingCount = tickets.length - displayTickets.length;

                                        return (
                                            <TableRow
                                                key={agent.agentId}
                                                className={`group transition-colors duration-150 ease-[cubic-bezier(0.32,0.72,0,1)] border-[hsl(var(--border))] ${
                                                    isMe
                                                        ? 'bg-primary/[0.03] hover:bg-primary/[0.06] dark:bg-primary/[0.05]'
                                                        : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/40'
                                                }`}
                                            >
                                                {/* Agent Information */}
                                                <TableCell className="py-3.5 pl-6">
                                                    <div className="flex items-center gap-3">
                                                        <UserAvatar
                                                            user={{
                                                                id: agent.agentId,
                                                                fullName: agent.agentName,
                                                            }}
                                                            size="md"
                                                            className={`ring-2 ${isMe ? 'ring-primary/40' : 'ring-[hsl(var(--border))]'}`}
                                                        />
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-semibold text-sm text-slate-900 dark:text-white leading-tight">
                                                                    {agent.agentName}
                                                                </span>
                                                                {isMe && (
                                                                    <Badge variant="secondary" className="text-[10px] font-bold px-1.5 py-0 bg-primary/10 text-primary border-none">
                                                                        Saya
                                                                    </Badge>
                                                                )}
                                                                {isMinWorkload && (
                                                                    <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                                                                        next
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate max-w-[220px]">
                                                                {agent.email}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </TableCell>

                                                {/* Role */}
                                                <TableCell className="py-3.5">
                                                    {getRoleBadge(agent.role)}
                                                </TableCell>

                                                {/* Workload Points & Capacity Meter */}
                                                <TableCell className="py-3.5">
                                                    <div className="space-y-1.5 pr-4">
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="font-mono font-bold text-base text-slate-900 dark:text-white leading-none">
                                                                    {points}
                                                                </span>
                                                                <span className="text-xs text-slate-400 font-medium">pts</span>
                                                            </div>
                                                            <Badge
                                                                variant="outline"
                                                                className={`text-xs font-semibold px-2 py-0 h-4.5 border ${status.color}`}
                                                            >
                                                                <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${status.dotColor}`} />
                                                                {status.label}
                                                            </Badge>
                                                        </div>
                                                        {/* Mini Capacity Indicator Bar */}
                                                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                                            <div
                                                                className={`h-full rounded-full origin-left transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${status.progressColor}`}
                                                                style={{ transform: `scaleX(${Math.max(points === 0 ? 0 : 0.15, status.percentage / 100)})` }}
                                                            />
                                                        </div>
                                                    </div>
                                                </TableCell>

                                                {/* Appraisal */}
                                                <TableCell className="py-3.5 text-center">
                                                    <span className="font-mono text-sm text-slate-600 dark:text-slate-400">
                                                        {agent.appraisalPoints || 0}
                                                    </span>
                                                </TableCell>

                                                {/* Active Tickets */}
                                                <TableCell className="py-3.5">
                                                    {tickets.length === 0 ? (
                                                        <div className="inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium px-2.5 py-1 rounded-lg bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200/50 dark:border-emerald-800/30">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                            Standby (0 Tiket)
                                                        </div>
                                                    ) : (
                                                        <div className="space-y-1.5">
                                                            <div className="flex flex-wrap items-center gap-1.5">
                                                                {displayTickets.map((t) => (
                                                                    <button
                                                                        key={t.id}
                                                                        onClick={() => navigate(`/tickets/${t.id}`)}
                                                                        title={`${t.ticketNumber}: ${t.title}`}
                                                                        className="group/t inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white dark:bg-slate-800/90 border border-[hsl(var(--border))] hover:border-primary/50 text-xs text-slate-700 dark:text-slate-300 hover:text-primary transition-[border-color,color] duration-150 ease-[cubic-bezier(0.32,0.72,0,1)] shadow-xs max-w-[200px]"
                                                                    >
                                                                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${getPriorityDot(t.priority)}`} />
                                                                        <span className="font-mono font-medium text-xs truncate">
                                                                            {t.ticketNumber}
                                                                        </span>
                                                                        <span className="opacity-0 group-hover/t:opacity-100 text-primary">↗</span>
                                                                    </button>
                                                                ))}

                                                                {/* Popover for overflow tickets */}
                                                                {remainingCount > 0 && (
                                                                    <Popover>
                                                                        <PopoverTrigger asChild>
                                                                            <button className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-semibold border border-[hsl(var(--border))] hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                                                                                +{remainingCount} lainnya
                                                                            </button>
                                                                        </PopoverTrigger>
                                                                        <PopoverContent className="w-80 p-3 rounded-xl shadow-lg border-[hsl(var(--border))] bg-[hsl(var(--card))]">
                                                                            <div className="flex items-center justify-between pb-2 mb-2 border-b border-[hsl(var(--border))]">
                                                                                <span className="text-xs font-semibold text-slate-800 dark:text-white">
                                                                                    Tiket Aktif: {agent.agentName}
                                                                                </span>
                                                                                <Badge variant="outline" className="text-xs h-4">
                                                                                    {tickets.length} Tiket
                                                                                </Badge>
                                                                            </div>
                                                                            <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                                                                                {tickets.map((t) => (
                                                                                    <div
                                                                                        key={t.id}
                                                                                        onClick={() => navigate(`/tickets/${t.id}`)}
                                                                                        className="p-2 rounded-lg border border-[hsl(var(--border))] hover:border-primary/40 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                                                                                    >
                                                                                        <div className="flex items-center justify-between gap-1 mb-0.5">
                                                                                            <span className="font-mono text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                                                                                                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${getPriorityDot(t.priority)}`} />
                                                                                                                                {t.ticketNumber}
                                                                                            </span>
                                                                                            <span className="text-xs uppercase font-semibold text-slate-500">
                                                                                                {t.priority}
                                                                                            </span>
                                                                                        </div>
                                                                                        <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-1">
                                                                                            {t.title}
                                                                                        </p>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        </PopoverContent>
                                                                    </Popover>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </TableCell>

                                                {/* Last Assigned */}
                                                <TableCell className="py-3.5">
                                                    {agent.lastAssignedAt ? (
                                                        <div className="flex flex-col cursor-default">
                                                            <span className="text-xs text-slate-700 dark:text-slate-300">
                                                                {formatDistanceToNow(new Date(agent.lastAssignedAt), {
                                                                    addSuffix: true,
                                                                    locale: idLocale,
                                                                })}
                                                            </span>
                                                            <span className="text-xs text-slate-400 font-mono mt-0.5">
                                                                {format(new Date(agent.lastAssignedAt), 'dd/MM HH:mm')}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-slate-400">—</span>
                                                    )}
                                                </TableCell>

                                                {/* Actions (ADMIN Only) */}
                                                {isAdmin && (
                                                    <TableCell className="py-3.5 pr-6 text-right">
                                                        <button
                                                            onClick={() => handleRecalculate(agent.agentId)}
                                                            disabled={recalculating === agent.agentId}
                                                            title="Sinkronisasi ulang beban agen dari tiket aktif"
                                                            className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white disabled:opacity-40 px-2.5 py-1 rounded-lg border border-[hsl(var(--border))] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shadow-2xs"
                                                        >
                                                            {recalculating === agent.agentId ? '…' : 'Sync'}
                                                        </button>
                                                    </TableCell>
                                                )}
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Table Footer with Summary Count */}
                    <div className="px-6 py-3 border-t border-[hsl(var(--border))] bg-slate-50/30 dark:bg-slate-900/10 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                        <div>
                            Menampilkan <strong className="text-slate-800 dark:text-slate-200">{filteredAgents.length}</strong> dari <strong className="text-slate-800 dark:text-slate-200">{agents.length}</strong> total agen operasional
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                Standby: {metrics.standbyAgents}
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-blue-500" />
                                Optimal: {agents.filter(a => (a.totalPoints || 0) > 0 && (a.totalPoints || 0) <= 3).length}
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-amber-500" />
                                Padat: {agents.filter(a => (a.totalPoints || 0) > 3).length}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </TooltipProvider>
    );
};

export default AdminWorkloadDashboard;
