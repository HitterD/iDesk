import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

export interface ActiveParticipantUser {
    id: string;
    fullName: string;
    email: string;
    role?: string;
    avatarUrl?: string | null;
    department?: {
        id: string;
        name: string;
    };
}

export function useActiveUsersForParticipants() {
    return useQuery<ActiveParticipantUser[]>({
        queryKey: ['users', 'approvers-for-participants'],
        queryFn: async () => {
            const res = await api.get('/users/approvers');
            return Array.isArray(res.data) ? res.data : [];
        },
        staleTime: 5 * 60 * 1000,
    });
}
