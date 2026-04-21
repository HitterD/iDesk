import { useInfiniteQuery } from '@tanstack/react-query';
import { CommentsApi } from '../api/comments.api';

export const useComments = (requestId: string | undefined) =>
    useInfiniteQuery({
        queryKey: ['comments', requestId],
        initialPageParam: 1,
        enabled: !!requestId,
        queryFn: ({ pageParam }) => CommentsApi.list(requestId!, pageParam),
        getNextPageParam: (last) => {
            const m = last.meta; if (!m) return undefined;
            const loaded = m.page * m.pageSize;
            return loaded < m.total ? m.page + 1 : undefined;
        },
        staleTime: 10_000,
    });
