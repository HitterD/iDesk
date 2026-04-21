/**
 * Workload API
 * Type-safe API client for admin/manager workload operations
 */

import api from '../api';

export interface AgentWorkloadDto {
    agentId: string;
    agentName: string;
    email: string;
    role: string;
    totalPoints: number;
    appraisalPoints: number;
    lastAssignedAt: string | null;
    siteId: string;
    siteCode: string;
    siteName: string;
    activeTicketsCount: number;
    activeTickets: Array<{
        id: string;
        ticketNumber: string;
        title: string;
        priority: string;
        status: string;
        category: string;
    }>;
}

export const workloadApi = {
    /**
     * Get all agent workloads for a site
     */
    getAllAgentWorkloads: (siteId: string, date?: string) => {
        const params = new URLSearchParams();
        params.append('siteId', siteId);
        if (date) params.append('date', date);
        return api.get<AgentWorkloadDto[]>(`/workload/agents?${params.toString()}`);
    },

    /**
     * Recalculate an agent's workload manually
     */
    recalculateAgentWorkload: (agentId: string, siteId: string) => {
        return api.post(`/workload/agents/${agentId}/recalculate?siteId=${siteId}`);
    },

    /**
     * Get workload summary
     */
    getWorkloadSummary: (siteId?: string) => {
        const params = new URLSearchParams();
        if (siteId) params.append('siteId', siteId);
        return api.get<any>(`/workload/summary?${params.toString()}`);
    },

    /**
     * Get all priority weights
     */
    getPriorityWeights: () => {
        return api.get<Record<string, number>>('/workload/priority-weights');
    },

    /**
     * Update a priority weight
     */
    updatePriorityWeight: (priority: string, data: { points: number }) => {
        return api.patch(`/workload/priority-weights/${priority}`, data);
    }
};

export default workloadApi;
