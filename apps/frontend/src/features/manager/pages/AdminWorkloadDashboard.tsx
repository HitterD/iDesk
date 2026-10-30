import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { SiteTabs } from '@/components/site/SiteTabs';
import { workloadApi, AgentWorkloadDto } from '@/lib/api/workload.api';
import { toast } from 'sonner';
import { PriorityWeightsDialog } from '../components/PriorityWeightsDialog';
import { AgentPersonalWorkloadCard } from '../components/AgentPersonalWorkloadCard';
import { WorkloadTable, type FilterStatus, type SortOption } from '../components/WorkloadTable';
import { ResEmpty, ResHead } from '@/components/resources/ResourceParts';
import { MgStat } from '@/components/management/MgmtParts';
import { useAuth } from '@/stores/useAuth';
import { CircleDot, Gauge, RefreshCw, Users, Weight, TriangleAlert } from 'lucide-react';

export const AdminWorkloadDashboard: React.FC = () => {
    const { user } = useAuth();

    const isAdmin = user?.role === 'ADMIN';
    const isManager = user?.role === 'MANAGER';
    /** ADMIN syncs and opens dashboards; MANAGER only opens dashboards. */
    const showActions = isAdmin || isManager;
    const isAgentOps = user?.role === 'AGENT_OPERATIONAL_SUPPORT' || user?.role === 'AGENT' || user?.role === 'AGENT_ADMIN';

    const [agents, setAgents] = useState<AgentWorkloadDto[]>([]);
    const [loading, setLoading] = useState(true);
    const [recalculating, setRecalculating] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    
    // Everyone starts on their own site; cross-site roles without one get the first site from SiteTabs.
    const [activeSiteId, setActiveSiteId] = useState<string>(user?.siteId ?? '');

    // Filter & Search states
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<FilterStatus>('ALL');
    const [sortBy, setSortBy] = useState<SortOption>('POINTS_ASC');

    // The user may arrive after the first render; adopt their site if nothing is selected yet.
    useEffect(() => {
        if (user?.siteId && !activeSiteId) {
            setActiveSiteId(user.siteId);
        }
    }, [user?.siteId, activeSiteId]);

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
        // Waiting-vendor tickets stay with their PIC but are not workload, so they are counted apart.
        const totalTickets = agents.reduce((acc, a) => acc + (a.activeTicketsCount || 0), 0);
        const waitingVendorTickets = agents.reduce((acc, a) => acc + (a.waitingVendorCount || 0), 0);
        
        // Find minimum points for assignment priority identification
        const minPoints = totalAgents > 0 ? Math.min(...agents.map(a => a.totalPoints || 0)) : 0;

        return {
            totalAgents,
            standbyAgents,
            activeAgents,
            totalPoints,
            avgPoints,
            totalTickets,
            waitingVendorTickets,
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
                // Workload tickets only, matching the summary card (waiting vendor is not workload).
                const ticketsA = a.activeTicketsCount || 0;
                const ticketsB = b.activeTicketsCount || 0;

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

    const agentView = isAgentOps && !isAdmin;

    if (error && !agents.length) {
        return (
            <div className="res-page">
                <ResEmpty icon={TriangleAlert} title="Gagal memuat" cta={<Button variant="soft" onClick={fetchWorkloads}>Coba lagi</Button>}>
                    {error}
                </ResEmpty>
            </div>
        );
    }

    return (
        <div className="res-page mg-page">
            <ResHead icon={Gauge} tone="navy"
                title={agentView ? 'Workload Operasional' : 'Workload Tim Agen'}
                description={agentView
                    ? 'Ringkasan kapasitas beban kerja Anda & distribusi antrean rekan tim di site'
                    : 'Distribusi dan pemantauan beban kerja agen harian per site'}
                actions={(
                    <>
                        {/* Site switch only for cross-site roles (Admin & Manager) */}
                        {(isAdmin || isManager) && <SiteTabs selectedSiteId={activeSiteId} onSelectionChange={setActiveSiteId} />}
                        {/* Priority weights configuration is strictly for ADMIN */}
                        {isAdmin && <PriorityWeightsDialog />}
                        <Button variant="soft" size="icon" onClick={fetchWorkloads} disabled={!activeSiteId || loading} loading={loading}
                            aria-label="Segarkan data workload" title="Segarkan data workload">
                            {!loading && <RefreshCw aria-hidden="true" />}
                        </Button>
                    </>
                )} />

            {/* Personal workload card for operational agents */}
            {isAgentOps && (
                <div className="mb-3">
                    <AgentPersonalWorkloadCard workload={myPersonalWorkload} siteName={agents[0]?.siteName} loading={loading} />
                </div>
            )}

            {(isAdmin || isManager) && (
                <section className="res-stats is-three" aria-label="Ringkasan beban">
                    <MgStat icon={Users} tone="navy" label="Total Agen Terdaftar" value={metrics.totalAgents} isLoading={loading && !agents.length}
                        sub={`${metrics.standbyAgents} standby · ${metrics.activeAgents} aktif bertugas`} />
                    <MgStat icon={Weight} tone="amber" label="Total Akumulasi Poin" value={metrics.totalPoints} isLoading={loading && !agents.length}
                        sub={`rata-rata ${metrics.avgPoints} poin per agen`} />
                    <MgStat icon={CircleDot} tone="blue" label="Tiket Aktif Dalam Proses" value={metrics.totalTickets} isLoading={loading && !agents.length}
                        sub={metrics.waitingVendorTickets > 0
                            ? `+${metrics.waitingVendorTickets} tunggu vendor, tidak dihitung`
                            : 'dialokasikan di seluruh agen site'} />
                </section>
            )}

            <WorkloadTable
                agents={agents}
                rows={filteredAgents}
                loading={loading}
                metrics={metrics}
                currentUserId={user?.id}
                showActions={showActions}
                isAdmin={isAdmin}
                recalculating={recalculating}
                onRecalculate={handleRecalculate}
                searchTerm={searchTerm}
                onSearch={setSearchTerm}
                statusFilter={statusFilter}
                onStatus={setStatusFilter}
                sortBy={sortBy}
                onSort={setSortBy}
            />
        </div>
    );
};

export default AdminWorkloadDashboard;
