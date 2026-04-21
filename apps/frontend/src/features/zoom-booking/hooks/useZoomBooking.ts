import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type {
    ZoomAccount,
    ZoomBooking,
    ZoomSettings,
    ZoomPublicSettings,
    CalendarDay,
    CreateBookingDto,
    CancelBookingDto
} from '../types';

// ==================== ACCOUNTS ====================

/**
 * Fetch all active Zoom accounts
 */
export function useZoomAccounts() {
    return useQuery<ZoomAccount[]>({
        queryKey: ['zoom-accounts'],
        queryFn: async () => {
            const response = await api.get('/zoom-booking/accounts');
            return response.data;
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
}

// ==================== CALENDAR ====================

/**
 * Fetch calendar data for a Zoom account
 */
export function useZoomCalendar(
    zoomAccountId: string | undefined,
    startDate: string,
    endDate: string
) {
    return useQuery<CalendarDay[]>({
        queryKey: ['zoom-calendar', zoomAccountId, startDate, endDate],
        queryFn: async () => {
            const params = new URLSearchParams({
                zoomAccountId: zoomAccountId!,
                startDate,
                endDate,
            });
            const response = await api.get(`/zoom-booking/calendar?${params}`);
            return response.data;
        },
        enabled: !!zoomAccountId && !!startDate && !!endDate,
        staleTime: 30000, // 30 seconds
    });
}

// ==================== BOOKINGS ====================

/**
 * Create a new booking with optimistic update
 */
export function useCreateBooking() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (dto: CreateBookingDto) => {
            const response = await api.post('/zoom-booking', dto);
            return response.data;
        },
        onMutate: async (newBooking) => {
            // Cancel any outgoing refetches so they don't overwrite our optimistic update
            await queryClient.cancelQueries({ queryKey: ['zoom-calendar'] });

            // Snapshot the previous value
            const previousCalendar = queryClient.getQueriesData({ queryKey: ['zoom-calendar'] });

            // Optimistically update calendar data for immediate UI feedback
            queryClient.setQueriesData<CalendarDay[]>({ queryKey: ['zoom-calendar'] }, (old) => {
                if (!old) return old;

                return old.map(day => {
                    if (day.date === newBooking.bookingDate) {
                        return {
                            ...day,
                            slots: day.slots.map(slot => {
                                const slotTime = slot.time;

                                // Calculate end time string
                                const [h, m] = newBooking.startTime.split(':').map(Number);
                                const totalMins = h * 60 + m + newBooking.durationMinutes;
                                const endH = Math.floor(totalMins / 60);
                                const endM = totalMins % 60;
                                const endStr = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;

                                // If the current slot overlaps with the new booking
                                if (slotTime >= newBooking.startTime && slotTime < endStr) {
                                    return {
                                        ...slot,
                                        status: 'my_booking',
                                        booking: {
                                            id: `optimistic-${Date.now()}`,
                                            title: newBooking.title,
                                            bookedBy: 'Booking...', // Immediate feedback
                                            durationMinutes: newBooking.durationMinutes,
                                            startTime: newBooking.startTime,
                                            endTime: endStr
                                        }
                                    };
                                }
                                return slot;
                            })
                        };
                    }
                    return day;
                });
            });

            return { previousCalendar };
        },
        onError: (_error, _newBooking, context) => {
            // If mutation fails, restore previously cached data
            if (context?.previousCalendar) {
                context.previousCalendar.forEach(([queryKey, data]) => {
                    queryClient.setQueryData(queryKey, data);
                });
            }
        },
        onSettled: () => {
            // Always refetch after error or success to ensure fresh data
            queryClient.invalidateQueries({ queryKey: ['zoom-calendar'] });
            queryClient.invalidateQueries({ queryKey: ['my-zoom-bookings'] });
            queryClient.invalidateQueries({ queryKey: ['my-upcoming-zoom-bookings'] });
        },
    });
}

/**
 * Fetch user's own bookings
 */
export function useMyBookings() {
    return useQuery<ZoomBooking[]>({
        queryKey: ['my-zoom-bookings'],
        queryFn: async () => {
            const response = await api.get('/zoom-booking/my-bookings');
            return response.data;
        },
    });
}

/**
 * Fetch current user's upcoming bookings (Optimized)
 */
export function useMyUpcomingBookings() {
    return useQuery<ZoomBooking[]>({
        queryKey: ['my-upcoming-zoom-bookings'],
        queryFn: async () => {
            const response = await api.get('/zoom-booking/my-upcoming');
            return response.data;
        },
        refetchInterval: 60000, // Refresh every minute
    });
}

/**
 * Fetch single booking details
 */
export function useBookingDetails(bookingId: string | undefined) {
    return useQuery<ZoomBooking>({
        queryKey: ['zoom-booking', bookingId],
        queryFn: async () => {
            const response = await api.get(`/zoom-booking/${bookingId}`);
            return response.data;
        },
        enabled: !!bookingId,
    });
}

/**
 * Fetch available duration options
 */
export function useDurationOptions() {
    return useQuery<number[]>({
        queryKey: ['zoom-durations'],
        queryFn: async () => {
            const response = await api.get('/zoom-booking/settings/durations');
            return response.data;
        },
        staleTime: 10 * 60 * 1000, // 10 minutes
    });
}

// ==================== ADMIN ====================

/**
 * Fetch all Zoom accounts (including inactive) - Admin only
 */
export function useAllZoomAccounts() {
    return useQuery<ZoomAccount[]>({
        queryKey: ['admin-zoom-accounts'],
        queryFn: async () => {
            const response = await api.get('/admin/zoom/accounts');
            return response.data;
        },
    });
}

/**
 * Fetch Zoom settings - Admin only
 */
export function useZoomSettings() {
    return useQuery<ZoomSettings>({
        queryKey: ['zoom-settings'],
        queryFn: async () => {
            const response = await api.get('/admin/zoom/settings');
            return response.data;
        },
    });
}

/**
 * Fetch public calendar settings - Available to all authenticated users
 * Use this in components shared across roles (e.g., BookingModal)
 */
export function usePublicZoomSettings() {
    return useQuery<ZoomPublicSettings>({
        queryKey: ['zoom-public-settings'],
        queryFn: async () => {
            const response = await api.get('/zoom-booking/settings');
            return response.data;
        },
        staleTime: 5 * 60 * 1000, // 5 minutes - settings don't change often
    });
}

/**
 * Update Zoom settings - Admin only
 */
export function useUpdateZoomSettings() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: Partial<ZoomSettings>) => {
            const response = await api.put('/admin/zoom/settings', data);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['zoom-settings'] });
            queryClient.invalidateQueries({ queryKey: ['zoom-durations'] });
            queryClient.invalidateQueries({ queryKey: ['zoom-calendar'] }); // Refresh calendar with new time range
        },
    });
}

/**
 * Fetch all bookings with filters - Admin only
 */
export function useAllBookings(filters?: {
    page?: number;
    limit?: number;
    zoomAccountId?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
}) {
    return useQuery<{ data: ZoomBooking[]; total: number }>({
        queryKey: ['admin-zoom-bookings', filters],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (filters?.page) params.append('page', String(filters.page));
            if (filters?.limit) params.append('limit', String(filters.limit));
            if (filters?.zoomAccountId) params.append('zoomAccountId', filters.zoomAccountId);
            if (filters?.status) params.append('status', filters.status);
            if (filters?.startDate) params.append('startDate', filters.startDate);
            if (filters?.endDate) params.append('endDate', filters.endDate);

            const response = await api.get(`/admin/zoom/bookings?${params}`);
            return response.data;
        },
    });
}

/**
 * Cancel a booking - Admin only
 */
export function useCancelBooking() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ bookingId, dto }: { bookingId: string; dto: CancelBookingDto }) => {
            const response = await api.post(`/admin/zoom/bookings/${bookingId}/cancel`, dto);
            return response.data;
        },
        onMutate: async ({ bookingId }) => {
            // Cancel any outgoing refetches
            await queryClient.cancelQueries({ queryKey: ['zoom-calendar'] });
            
            // Snapshot the previous value
            const previousCalendar = queryClient.getQueriesData({ queryKey: ['zoom-calendar'] });
            
            // Optimistically update calendar data immediately
            queryClient.setQueriesData<CalendarDay[]>({ queryKey: ['zoom-calendar'] }, (old) => {
                if (!old) return old;
                return old.map(day => ({
                    ...day,
                    slots: day.slots.map(slot => {
                        if (slot.booking?.id === bookingId || slot.booking?.id === `optimistic-${bookingId}`) {
                            return { ...slot, status: 'available', booking: undefined };
                        }
                        return slot;
                    })
                }));
            });
            
            return { previousCalendar };
        },
        onError: (_error, _variables, context) => {
            // Rollback on error
            if (context?.previousCalendar) {
                context.previousCalendar.forEach(([queryKey, data]) => {
                    queryClient.setQueryData(queryKey, data);
                });
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['zoom-calendar'] });
            queryClient.invalidateQueries({ queryKey: ['admin-zoom-bookings'] });
            queryClient.invalidateQueries({ queryKey: ['my-zoom-bookings'] });
        },
    });
}

/**
 * Retry creating Zoom meeting for PENDING booking - Admin only
 */
export function useRetryZoomMeeting() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (bookingId: string) => {
            const response = await api.post(`/admin/zoom/bookings/${bookingId}/retry`);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['zoom-calendar'] });
            queryClient.invalidateQueries({ queryKey: ['admin-zoom-bookings'] });
            queryClient.invalidateQueries({ queryKey: ['my-zoom-bookings'] });
            queryClient.invalidateQueries({ queryKey: ['my-upcoming-zoom-bookings'] });
        },
    });
}

/**
 * Reschedule a booking - update date/time
 */
export function useRescheduleBooking() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ bookingId, data }: {
            bookingId: string;
            data: { bookingDate: string; startTime: string; durationMinutes?: number }
        }) => {
            const response = await api.post(`/admin/zoom/bookings/${bookingId}/reschedule`, data);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['zoom-calendar'] });
            queryClient.invalidateQueries({ queryKey: ['admin-zoom-bookings'] });
            queryClient.invalidateQueries({ queryKey: ['my-zoom-bookings'] });
            queryClient.invalidateQueries({ queryKey: ['booking-details'] });
        },
    });
}

/**
 * Reschedule own booking (for regular users) - calls user endpoint
 */
export function useRescheduleOwnBooking() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ bookingId, data }: {
            bookingId: string;
            data: { bookingDate: string; startTime: string; durationMinutes?: number }
        }) => {
            const response = await api.post(`/zoom-booking/${bookingId}/reschedule`, data);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['zoom-calendar'] });
            queryClient.invalidateQueries({ queryKey: ['my-zoom-bookings'] });
            queryClient.invalidateQueries({ queryKey: ['booking-details'] });
        },
    });
}

/**
 * Cancel own booking (for regular users) - calls user endpoint
 */
export function useCancelOwnBooking() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ bookingId, dto }: { bookingId: string; dto: CancelBookingDto }) => {
            const response = await api.post(`/zoom-booking/${bookingId}/cancel`, dto);
            return response.data;
        },
        onMutate: async ({ bookingId }) => {
            // Cancel any outgoing refetches
            await queryClient.cancelQueries({ queryKey: ['zoom-calendar'] });
            
            // Snapshot the previous value
            const previousCalendar = queryClient.getQueriesData({ queryKey: ['zoom-calendar'] });
            
            // Optimistically update calendar data immediately
            queryClient.setQueriesData<CalendarDay[]>({ queryKey: ['zoom-calendar'] }, (old) => {
                if (!old) return old;
                return old.map(day => ({
                    ...day,
                    slots: day.slots.map(slot => {
                        if (slot.booking?.id === bookingId || slot.booking?.id === `optimistic-${bookingId}`) {
                            return { ...slot, status: 'available', booking: undefined };
                        }
                        return slot;
                    })
                }));
            });
            
            return { previousCalendar };
        },
        onError: (_error, _variables, context) => {
            // Rollback on error
            if (context?.previousCalendar) {
                context.previousCalendar.forEach(([queryKey, data]) => {
                    queryClient.setQueryData(queryKey, data);
                });
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['zoom-calendar'] });
            queryClient.invalidateQueries({ queryKey: ['my-zoom-bookings'] });
            queryClient.invalidateQueries({ queryKey: ['my-upcoming-zoom-bookings'] });
            queryClient.invalidateQueries({ queryKey: ['booking-details'] });
        },
    });
}

/**
 * Create a Zoom account - Admin only
 */
export function useCreateZoomAccount() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: Partial<ZoomAccount>) => {
            const response = await api.post('/admin/zoom/accounts', data);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['zoom-accounts'] });
            queryClient.invalidateQueries({ queryKey: ['admin-zoom-accounts'] });
        },
    });
}

/**
 * Update a Zoom account - Admin only
 */
export function useUpdateZoomAccount() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, data }: { id: string; data: Partial<ZoomAccount> }) => {
            const response = await api.put(`/admin/zoom/accounts/${id}`, data);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['zoom-accounts'] });
            queryClient.invalidateQueries({ queryKey: ['admin-zoom-accounts'] });
        },
    });
}

/**
 * Sync meetings from Zoom API - Admin only
 */
export function useSyncMeetings() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async () => {
            const response = await api.post('/admin/zoom/sync-meetings');
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['zoom-calendar'] });
            queryClient.invalidateQueries({ queryKey: ['admin-zoom-bookings'] });
            queryClient.invalidateQueries({ queryKey: ['my-zoom-bookings'] });
            queryClient.invalidateQueries({ queryKey: ['my-upcoming-zoom-bookings'] });
        },
    });
}

/**
 * Initialize default 10 Zoom accounts - Admin only
 */
export function useInitializeZoomAccounts() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (emails: string[]) => {
            const response = await api.post('/admin/zoom/accounts/initialize', { emails });
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['zoom-accounts'] });
            queryClient.invalidateQueries({ queryKey: ['admin-zoom-accounts'] });
        },
    });
}

// ==================== AUDIT LOGS ====================

interface AuditLog {
    id: string;
    action: string;
    entityType: string;
    entityId?: string;
    details?: string;
    performedBy?: {
        id: string;
        fullName: string;
        email: string;
    };
    createdAt: string;
}

/**
 * Fetch Zoom audit logs - Admin only
 */
export function useZoomAuditLogs(filters?: {
    page?: number;
    limit?: number;
    action?: string;
    startDate?: string;
    endDate?: string;
}) {
    return useQuery<{ data: AuditLog[]; total: number; totalPages: number }>({
        queryKey: ['zoom-audit-logs', filters],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (filters?.page) params.append('page', String(filters.page));
            if (filters?.limit) params.append('limit', String(filters.limit));
            if (filters?.action) params.append('action', filters.action);
            if (filters?.startDate) params.append('startDate', filters.startDate);
            if (filters?.endDate) params.append('endDate', filters.endDate);

            const response = await api.get(`/admin/zoom/audit-logs?${params}`);
            return response.data;
        },
    });
}

/**
 * Add blocked date - Admin only
 */
export function useAddBlockedDate() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (date: string) => {
            const response = await api.post('/admin/zoom/settings/blocked-dates', { date });
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['zoom-settings'] });
        },
    });
}

/**
 * Remove blocked date - Admin only
 */
export function useRemoveBlockedDate() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (date: string) => {
            const response = await api.delete(`/admin/zoom/settings/blocked-dates/${date}`);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['zoom-settings'] });
        },
    });
}

