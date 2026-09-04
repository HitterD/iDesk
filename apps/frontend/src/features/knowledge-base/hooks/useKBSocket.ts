import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSocket } from '@/lib/socket';

interface ArticleViewPayload {
    articleId: string;
    viewCount: number;
    viewer?: {
        id: string;
        userId?: string;
        fullName: string;
        avatarUrl?: string;
        jobTitle?: string;
        role?: string;
        lastViewedAt: string | Date;
    };
}

interface ArticleHelpfulPayload {
    articleId: string;
    helpfulCount: number;
}

export const useKBSocket = (currentArticleId?: string) => {
    const { socket, isConnected } = useSocket();
    const queryClient = useQueryClient();

    useEffect(() => {
        if (!socket) return;

        // Handler for real-time view updates
        const handleArticleViewed = (payload: ArticleViewPayload) => {
            const { articleId, viewCount, viewer } = payload;

            // 1. Update single article query if open
            queryClient.setQueryData(['kb-article', articleId], (oldData: any) => {
                if (!oldData) return oldData;
                return { ...oldData, viewCount };
            });

            // 2. Update viewers query if viewer info is present
            if (viewer) {
                queryClient.setQueryData(['kb-viewers', articleId], (oldData: any) => {
                    if (!oldData) {
                        return { totalViewers: 1, recentViewers: [viewer] };
                    }
                    const existingList = oldData.recentViewers || [];
                    const filtered = existingList.filter((v: any) =>
                        v.userId ? v.userId !== viewer.userId : v.id !== viewer.id
                    );
                    return {
                        totalViewers: Math.max(oldData.totalViewers || 0, filtered.length + 1),
                        recentViewers: [viewer, ...filtered],
                    };
                });
            }

            // 3. Update all article list queries in cache
            queryClient.setQueriesData({ queryKey: ['kb-articles'] }, (oldList: any) => {
                if (!Array.isArray(oldList)) return oldList;
                return oldList.map((art: any) =>
                    art.id === articleId ? { ...art, viewCount } : art
                );
            });
        };

        // Handler for real-time helpful updates
        const handleArticleHelpful = (payload: ArticleHelpfulPayload) => {
            const { articleId, helpfulCount } = payload;

            queryClient.setQueryData(['kb-article', articleId], (oldData: any) => {
                if (!oldData) return oldData;
                return { ...oldData, helpfulCount };
            });

            queryClient.setQueriesData({ queryKey: ['kb-articles'] }, (oldList: any) => {
                if (!Array.isArray(oldList)) return oldList;
                return oldList.map((art: any) =>
                    art.id === articleId ? { ...art, helpfulCount } : art
                );
            });
        };

        socket.on('kb:article:viewed', handleArticleViewed);
        socket.on('kb:article:helpful', handleArticleHelpful);

        return () => {
            socket.off('kb:article:viewed', handleArticleViewed);
            socket.off('kb:article:helpful', handleArticleHelpful);
        };
    }, [socket, queryClient, currentArticleId]);

    return { isConnected };
};
