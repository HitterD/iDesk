import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { HardDrive, RefreshCw, Users, Activity, Star, AlertCircle, RefreshCcw } from 'lucide-react';
import { SiteSelector } from '@/components/site/SiteSelector';
import { workloadApi, AgentWorkloadDto } from '@/lib/api/workload.api';
import { toast } from 'sonner';
import { PriorityWeightsDialog } from '../components/PriorityWeightsDialog';

export const AdminWorkloadDashboard = () => {
    const [agents, setAgents] = useState<AgentWorkloadDto[]>([]);
    const [loading, setLoading] = useState(true);
    const [recalculating, setRecalculating] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [selectedSites, setSelectedSites] = useState<string[]>([]);
    // Default to a specific site for testing if multiple select isn't available
    const activeSiteId = selectedSites.length > 0 ? selectedSites[0] : '';

    useEffect(() => {
        if (activeSiteId) {
            fetchWorkloads();
        } else {
            setAgents([]);
            setLoading(false);
        }
    }, [activeSiteId]);

    const fetchWorkloads = async () => {
        if (!activeSiteId) return;
        setLoading(true);
        setError(null);
        try {
            const response = await workloadApi.getAllAgentWorkloads(activeSiteId);
            setAgents(response.data);
        } catch (err: any) {
            console.error('Failed to fetch workloads:', err);
            const message = err.response?.data?.message || 'Gagal memuat data workload';
            setError(message);
            toast.error(message);
        } finally {
            setLoading(false);
        }
    };

    const handleRecalculate = async (agentId: string) => {
        if (!activeSiteId) return;
        setRecalculating(agentId);
        try {
            await workloadApi.recalculateAgentWorkload(agentId, activeSiteId);
            toast.success('Workload recalculated successfully');
            fetchWorkloads();
        } catch (err: any) {
            console.error('Failed to recalculate:', err);
            toast.error(err.response?.data?.message || 'Gagal menghitung ulang workload');
        } finally {
            setRecalculating(null);
        }
    };

    const getRoleBadge = (role: string) => {
        switch (role) {
            case 'ADMIN': return <Badge variant="destructive">Admin</Badge>;
            case 'AGENT_ADMIN': return <Badge variant="secondary">Admin Agent</Badge>;
            case 'AGENT_ORACLE': return <Badge className="bg-blue-600">Oracle Agent</Badge>;
            case 'AGENT_OPERATIONAL_SUPPORT': return <Badge className="bg-green-600">Ops Support</Badge>;
            default: return <Badge variant="outline">{role}</Badge>;
        }
    };

    if (error && !agents.length) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] p-8 bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl">
                <div className="w-12 h-12 rounded-lg bg-red-50 dark:bg-red-900/10 flex items-center justify-center mb-4 border border-red-200 dark:border-red-900/50">
                    <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Gagal Memuat Dashboard</h2>
                <p className="text-sm text-slate-500 text-center max-w-md mb-6">{error}</p>
                <Button onClick={fetchWorkloads} variant="outline" className="rounded-xl border-[hsl(var(--border))]">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Coba Lagi
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in-up">
            {/* Header Area */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
                        Pusat Komando Beban Kerja
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Monitor dan orkestrasi distribusi penugasan agen secara real-time.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <div className="w-[280px]">
                        <SiteSelector
                            selectedSiteIds={selectedSites}
                            onSelectionChange={setSelectedSites}
                            mode="single"
                        />
                    </div>
                    <PriorityWeightsDialog />
                    <Button
                        variant="outline"
                        onClick={fetchWorkloads}
                        disabled={!activeSiteId || loading}
                        className="rounded-xl font-medium bg-[hsl(var(--card))] border-[hsl(var(--border))] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    >
                        <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Segarkan
                    </Button>
                </div>
            </div>

            {!activeSiteId ? (
                <div className="bg-[hsl(var(--card))] border border-dashed border-[hsl(var(--border))] p-16 rounded-xl text-center flex flex-col items-center justify-center">
                    <div className="w-12 h-12 bg-slate-50 dark:bg-slate-900/50 rounded-lg flex items-center justify-center mb-4 border border-[hsl(var(--border))]">
                        <HardDrive className="w-6 h-6 text-slate-400" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-2">Belum Ada Site Terpilih</h3>
                    <p className="text-sm text-slate-500 max-w-md">
                        Pilih satu lokasi operasional (Site) di sudut kanan atas untuk mulai menganalisis metrik beban kerja agen secara mendalam.
                    </p>
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Executive Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl p-5 flex flex-col justify-between">
                            <div className="flex items-center justify-between mb-4">
                                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Agen Aktif</span>
                                <Users className="h-4 w-4 text-slate-400" />
                            </div>
                            <div>
                                <div className="text-3xl font-semibold text-slate-800 dark:text-white">
                                    {agents.length}
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                    dalam operasional
                                </p>
                            </div>
                        </div>

                        <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl p-5 flex flex-col justify-between">
                            <div className="flex items-center justify-between mb-4">
                                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Bobot Aktif</span>
                                <Activity className="h-4 w-4 text-slate-400" />
                            </div>
                            <div>
                                <div className="text-3xl font-semibold text-slate-800 dark:text-white">
                                    {agents.reduce((acc, a) => acc + (a.totalPoints || 0), 0)}
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                    akumulasi skor beban
                                </p>
                            </div>
                        </div>

                        <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl p-5 flex flex-col justify-between">
                            <div className="flex items-center justify-between mb-4">
                                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Tiket Sedang Dikerjakan</span>
                                <HardDrive className="h-4 w-4 text-slate-400" />
                            </div>
                            <div>
                                <div className="text-3xl font-semibold text-slate-800 dark:text-white">
                                    {agents.reduce((acc, a) => acc + (a.activeTicketsCount || 0), 0)}
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                    berstatus In Progress / To Do
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Grand Agent Table */}
                    <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl overflow-hidden">
                        <div className="px-5 py-4 border-b border-[hsl(var(--border))] flex items-center justify-between">
                            <h3 className="font-semibold text-base flex items-center gap-2 text-slate-800 dark:text-white">
                                Distribusi Beban Agen
                            </h3>
                        </div>
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-slate-50/50 dark:bg-slate-800/30">
                                    <TableRow className="border-[hsl(var(--border))] hover:bg-transparent">
                                        <TableHead className="w-[250px] text-[11px] font-semibold text-slate-500 uppercase tracking-wider h-10">Agen Operasional</TableHead>
                                        <TableHead className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider h-10">Fungsi Peran</TableHead>
                                        <TableHead className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider text-center h-10">Poin Beban</TableHead>
                                        <TableHead className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider text-center h-10">Skor Evaluasi</TableHead>
                                        <TableHead className="w-[300px] text-[11px] font-semibold text-slate-500 uppercase tracking-wider h-10">Tiket Aktif</TableHead>
                                        <TableHead className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider h-10">Penugasan Terakhir</TableHead>
                                        <TableHead className="text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wider h-10">Aksi</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {agents.length === 0 && !loading && (
                                        <TableRow>
                                            <TableCell colSpan={7} className="h-48 text-center text-muted-foreground">
                                                <div className="flex flex-col items-center gap-2">
                                                    <Users className="h-8 w-8 text-slate-300" />
                                                    <p>Tidak ada agen operasional aktif di site ini.</p>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                    {loading && agents.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={7} className="h-48 text-center">
                                                <RefreshCw className="h-8 w-8 animate-spin mx-auto text-primary/50" />
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        agents.sort((a, b) => (a.totalPoints || 0) - (b.totalPoints || 0)).map((agent) => (
                                            <TableRow key={agent.agentId} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors border-[hsl(var(--border))]">
                                                <TableCell className="py-3">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-md bg-slate-100 dark:bg-slate-800 flex items-center justify-center border border-[hsl(var(--border))] flex-shrink-0 text-slate-600 dark:text-slate-300 font-bold text-xs">
                                                            {agent.agentName?.charAt(0) || 'A'}
                                                        </div>
                                                        <div>
                                                            <div className="font-semibold text-sm text-slate-800 dark:text-white truncate max-w-[180px]">
                                                                {agent.agentName}
                                                            </div>
                                                            <div className="text-xs text-slate-500 truncate max-w-[180px]">
                                                                {agent.email}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className="font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-[hsl(var(--border))]">
                                                        {agent.role.replace('AGENT_', '').replace(/_/g, ' ')}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex justify-center">
                                                        <span className="font-mono text-sm font-semibold text-slate-800 dark:text-slate-200">
                                                            {agent.totalPoints || 0}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex justify-center">
                                                        <span className="font-mono text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                                                            <Star className="w-3 h-3 text-slate-400" />
                                                            {agent.appraisalPoints || 0}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="py-3">
                                                    {agent.activeTickets && agent.activeTickets.length > 0 ? (
                                                        <div className="space-y-1.5">
                                                            <Badge variant="outline" className="font-medium bg-[hsl(var(--card))] text-slate-600 dark:text-slate-400 border-[hsl(var(--border))] text-[10px] px-1.5 py-0 h-5">
                                                                {agent.activeTickets.length} Aktif
                                                            </Badge>
                                                            <div className="flex flex-col gap-1 max-h-24 overflow-y-auto pr-2 custom-scrollbar">
                                                                {agent.activeTickets.map(t => (
                                                                    <div key={t.id} className="text-[10px] border border-[hsl(var(--border))] rounded p-1.5 bg-[hsl(var(--card))] flex items-center gap-2">
                                                                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${t.priority === 'CRITICAL' ? 'bg-red-500' : t.priority === 'HIGH' ? 'bg-orange-500' : 'bg-slate-500'}`} />
                                                                        <div className="flex-1 min-w-0">
                                                                            <div className="font-medium text-[11px] truncate text-slate-800 dark:text-slate-200">{t.ticketNumber}</div>
                                                                            <div className="text-[10px] text-slate-500 truncate" title={t.title}>{t.title}</div>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground italic flex items-center gap-1">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                                                            Standby / Kosong
                                                        </span>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                                        {agent.lastAssignedAt ? (
                                                            <div className="flex flex-col">
                                                                <span>{new Date(agent.lastAssignedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                                <span className="text-[10px] text-muted-foreground">{new Date(agent.lastAssignedAt).toLocaleDateString()}</span>
                                                            </div>
                                                        ) : (
                                                            <Badge variant="secondary" className="opacity-50">Belum Ada</Badge>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleRecalculate(agent.agentId)}
                                                        disabled={recalculating === agent.agentId}
                                                        title="Sinkronisasi poin beban"
                                                        className="hover:bg-slate-100 dark:hover:bg-slate-800 h-8 w-8 text-slate-400 hover:text-slate-600 rounded-md"
                                                    >
                                                        <RefreshCcw className={`h-4 w-4 ${recalculating === agent.agentId ? 'animate-spin' : ''}`} />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminWorkloadDashboard;
