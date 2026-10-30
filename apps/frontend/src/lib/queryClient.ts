import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 5000,
            gcTime: 5 * 60 * 1000,
            refetchOnWindowFocus: true,
            refetchOnReconnect: true,
            // Don't retry rate-limited (429) queries; it only prolongs the lockout.
            retry: (failureCount, error) =>
                (error as { response?: { status?: number } })?.response?.status !== 429 && failureCount < 1,
            retryDelay: 1000,
        },
    },
});

export default queryClient;
