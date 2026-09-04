import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../lib/api';
import { toast } from 'sonner';

export interface SavedReply {
    id: string;
    title: string;
    content: string;
    category?: string;
    shortcut?: string | null;
    userId?: string | null;
    createdAt?: string;
    updatedAt?: string;
}

export interface CreateSavedReplyPayload {
    title: string;
    content: string;
    category?: string;
    shortcut?: string;
    isGlobal?: boolean;
}

export interface UpdateSavedReplyPayload {
    title?: string;
    content?: string;
    category?: string;
    shortcut?: string;
}

export const SAVED_REPLIES_QUERY_KEY = ['saved-replies'];

export const useSavedReplies = () => {
    return useQuery({
        queryKey: SAVED_REPLIES_QUERY_KEY,
        queryFn: async () => {
            const res = await api.get<SavedReply[]>('/saved-replies');
            return res.data;
        },
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
};

export const useCreateSavedReply = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (payload: CreateSavedReplyPayload) => {
            const res = await api.post<SavedReply>('/saved-replies', payload);
            return res.data;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: SAVED_REPLIES_QUERY_KEY });
            toast.success(`Template "${data.title}" berhasil disimpan`);
        },
        onError: (err: any) => {
            const msg = err?.response?.data?.message || 'Gagal menyimpan template quick reply';
            toast.error(msg);
        },
    });
};

export const useUpdateSavedReply = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, payload }: { id: string; payload: UpdateSavedReplyPayload }) => {
            const res = await api.patch<SavedReply>(`/saved-replies/${id}`, payload);
            return res.data;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: SAVED_REPLIES_QUERY_KEY });
            toast.success(`Template "${data.title}" berhasil diperbarui`);
        },
        onError: (err: any) => {
            const msg = err?.response?.data?.message || 'Gagal memperbarui template quick reply';
            toast.error(msg);
        },
    });
};

export const useDeleteSavedReply = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: string) => {
            const res = await api.delete<{ success: boolean }>(`/saved-replies/${id}`);
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: SAVED_REPLIES_QUERY_KEY });
            toast.success('Template quick reply berhasil dihapus');
        },
        onError: (err: any) => {
            const msg = err?.response?.data?.message || 'Gagal menghapus template quick reply';
            toast.error(msg);
        },
    });
};

export const useResetSavedReplies = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async () => {
            const res = await api.post<SavedReply[]>('/saved-replies/reset-defaults', {});
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: SAVED_REPLIES_QUERY_KEY });
            toast.success('Template berhasil di-reset ke template bawaan sistem');
        },
        onError: (err: any) => {
            const msg = err?.response?.data?.message || 'Gagal mereset template quick reply';
            toast.error(msg);
        },
    });
};
