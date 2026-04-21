import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

export enum ScheduleStatus {
    PENDING = 'PENDING',
    APPROVED = 'APPROVED',
    RESCHEDULED = 'RESCHEDULED',
    COMPLETED = 'COMPLETED',
    CANCELLED = 'CANCELLED',
}

export interface InstallationSchedule {
    id: string;
    ticketId?: string;
    ictBudgetRequestId?: string;
    itemName?: string;
    itemIndex?: number;
    requesterId: string;
    requester?: {
        id: string;
        fullName: string;
        email?: string;
    };
    scheduledDate: string;
    scheduledTimeSlot: string;
    status: ScheduleStatus;
    processedById?: string;
    processedBy?: {
        id: string;
        fullName: string;
    };
    processedAt?: string;
    rescheduleReason?: string;
    suggestedDate?: string;
    suggestedTimeSlot?: string;
    notes?: string;
    createdAt: string;
    updatedAt: string;
}

export interface AvailableSlotsResponse {
    date: string;
    slots: {
        timeSlot: string;
        availableCapacity: number;
        maxCapacity: number;
        isAvailable: boolean;
    }[];
}

// Fetch all schedules
export const useSchedules = (filters?: { status?: ScheduleStatus; date?: string; requesterId?: string }) => {
    return useQuery<InstallationSchedule[]>({
        queryKey: ['installation-schedules', filters],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (filters?.status) params.append('status', filters.status);
            if (filters?.date) params.append('date', filters.date);
            if (filters?.requesterId) params.append('requesterId', filters.requesterId);
            
            const res = await api.get(`/installation-schedule?${params.toString()}`);
            return res.data;
        },
    });
};

// Fetch schedules by ICT Budget Request ID
export const useSchedulesByBudget = (budgetId: string) => {
    return useQuery<InstallationSchedule[]>({
        queryKey: ['installation-schedules-budget', budgetId],
        queryFn: async () => {
            const res = await api.get(`/installation-schedule/budget/${budgetId}`);
            return res.data;
        },
        enabled: !!budgetId,
    });
};

// Fetch available slots for a specific date
export const useAvailableSlots = (date: string) => {
    return useQuery<AvailableSlotsResponse>({
        queryKey: ['installation-schedule-slots', date],
        queryFn: async () => {
            const res = await api.get(`/installation-schedule/available-slots?date=${date}`);
            return res.data;
        },
        enabled: !!date,
    });
};

// Submit a new schedule
export const useCreateSchedule = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (data: Partial<InstallationSchedule>) => {
            const res = await api.post('/installation-schedule', data);
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['installation-schedules'] });
            queryClient.invalidateQueries({ queryKey: ['installation-schedule-slots'] });
        },
    });
};

// Approve a schedule
export const useApproveSchedule = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, notes }: { id: string; notes?: string }) => {
            const res = await api.post(`/installation-schedule/${id}/approve`, { notes });
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['installation-schedules'] });
        },
    });
};

// Complete a schedule
export const useCompleteSchedule = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, notes }: { id: string; notes?: string }) => {
            const res = await api.post(`/installation-schedule/${id}/complete`, { notes });
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['installation-schedules'] });
        },
    });
};
