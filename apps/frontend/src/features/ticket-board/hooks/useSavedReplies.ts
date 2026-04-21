import { useQuery } from '@tanstack/react-query';
import api from '../../../lib/api';

export interface SavedReply {
    id: string;
    title: string;
    content: string;
    userId: string | null;
}

export const useSavedReplies = () => {
    return useQuery({
        queryKey: ['saved-replies'],
        queryFn: async () => {
            const res = await api.get<SavedReply[]>('/saved-replies');
            return res.data;
        },
    });
};
