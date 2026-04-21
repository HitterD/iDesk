import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { HardwareRequestApi, completeProcurement } from '../api/hardware-request.api';
import { CommentsApi } from '../api/comments.api';
import type { HardwareRequest, HardwareRequestComment } from '../types';

export function useHardwareMutations(requestId?: string) {
    const qc = useQueryClient();
    const invalidateDetail = () => { if (requestId) qc.invalidateQueries({ queryKey: ['hardware-requests', 'detail', requestId] }); };
    const invalidateList = () => qc.invalidateQueries({ queryKey: ['hardware-requests', 'list'] });

    const handle = <T>(p: Promise<T>, okMsg: string) =>
        p.then(v => { toast.success(okMsg); invalidateDetail(); invalidateList(); return v; })
         .catch(err => { toast.error(err?.message ?? 'Gagal'); throw err; });

    return {
        submitMut: useMutation({ mutationFn: (id: string) => handle(HardwareRequestApi.submit(id), 'Request disubmit') }),
        cancelMut: useMutation({ mutationFn: (id: string) => handle(HardwareRequestApi.cancel(id), 'Request dibatalkan') }),
        reviewMut: useMutation({ mutationFn: (id: string) => handle(HardwareRequestApi.review(id), 'Review dimulai') }),
        approveMut: useMutation({ mutationFn: (id: string) => handle(HardwareRequestApi.approve(id), 'Request disetujui') }),
        rejectMut: useMutation({ mutationFn: ({ id, reason }: { id: string; reason: string }) => handle(HardwareRequestApi.reject(id, reason), 'Request ditolak') }),
        completeInstallMut: useMutation({ mutationFn: (id: string) => handle(HardwareRequestApi.completeInstallation(id), 'Instalasi Selesai') }),
        completeProcMut: useMutation({ mutationFn: (id: string) => handle(completeProcurement(id, {}), 'Procurement selesai') }),
        updateItemMut: useMutation({
            mutationFn: ({ itemId, payload }: { itemId: string; payload: Parameters<typeof HardwareRequestApi.updateItem>[2] }) =>
                HardwareRequestApi.updateItem(requestId!, itemId, payload),
            onSuccess: () => invalidateDetail(),
        }),

        addCommentMut: useMutation({
            mutationFn: (body: string) => CommentsApi.create(requestId!, { body }),
            onMutate: async (body: string) => {
                await qc.cancelQueries({ queryKey: ['comments', requestId] });
                const prev = qc.getQueryData(['comments', requestId]);
                const tempId = `temp-${Date.now()}`;
                qc.setQueryData(['comments', requestId], (old: any) => {
                    if (!old) return old;
                    const optimistic: HardwareRequestComment = {
                        id: tempId, requestId: requestId!, authorId: 'me',
                        body, attachments: [], createdAt: new Date().toISOString(),
                        editedAt: null, deletedAt: null, author: undefined,
                    };
                    const first = old.pages[0] ?? { rows: [], meta: { total: 0, page: 1, pageSize: 50 } };
                    return { ...old, pages: [{ ...first, rows: [optimistic, ...first.rows] }, ...old.pages.slice(1)] };
                });
                return { prev };
            },
            onError: (err: any, _body, ctx) => {
                toast.error(err?.message ?? 'Gagal komentar');
                if (ctx?.prev) qc.setQueryData(['comments', requestId], ctx.prev);
            },
            onSuccess: () => qc.invalidateQueries({ queryKey: ['comments', requestId] }),
        }),
    };
}
