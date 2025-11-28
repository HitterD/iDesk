import { useCallback } from 'react';
import axios, { AxiosError } from 'axios';
import { toast } from 'sonner';

interface ApiErrorResponse {
    message: string | string[];
    error?: string;
    statusCode?: number;
}

/**
 * Custom hook for handling API errors consistently
 * Extracts error message from various API response formats
 */
export function useApiError() {
    return useCallback((error: unknown, fallbackMessage = 'An error occurred') => {
        let message = fallbackMessage;

        if (axios.isAxiosError(error)) {
            const axiosError = error as AxiosError<ApiErrorResponse>;
            const data = axiosError.response?.data;

            if (data?.message) {
                message = Array.isArray(data.message) 
                    ? data.message.join(', ') 
                    : data.message;
            } else if (data?.error) {
                message = data.error;
            } else if (axiosError.message) {
                message = axiosError.message;
            }

            // Handle specific HTTP status codes
            const status = axiosError.response?.status;
            if (status === 401) {
                message = 'Session expired. Please log in again.';
            } else if (status === 403) {
                message = 'You do not have permission to perform this action.';
            } else if (status === 404) {
                message = 'The requested resource was not found.';
            } else if (status === 429) {
                message = 'Too many requests. Please try again later.';
            } else if (status && status >= 500) {
                message = 'Server error. Please try again later.';
            }
        } else if (error instanceof Error) {
            message = error.message;
        }

        toast.error(message);
        return message;
    }, []);
}

/**
 * Extract error message without showing toast
 */
export function extractApiError(error: unknown, fallbackMessage = 'An error occurred'): string {
    let message = fallbackMessage;

    if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<ApiErrorResponse>;
        const data = axiosError.response?.data;

        if (data?.message) {
            message = Array.isArray(data.message) 
                ? data.message.join(', ') 
                : data.message;
        } else if (data?.error) {
            message = data.error;
        } else if (axiosError.message) {
            message = axiosError.message;
        }
    } else if (error instanceof Error) {
        message = error.message;
    }

    return message;
}

/**
 * Hook for handling mutations with automatic error handling
 */
export function useMutationWithError<TData, TVariables>(
    mutationFn: (variables: TVariables) => Promise<TData>,
    options?: {
        onSuccess?: (data: TData) => void;
        onError?: (error: unknown) => void;
        successMessage?: string;
        errorMessage?: string;
    }
) {
    const handleError = useApiError();

    return {
        mutate: async (variables: TVariables): Promise<TData | null> => {
            try {
                const data = await mutationFn(variables);
                if (options?.successMessage) {
                    toast.success(options.successMessage);
                }
                options?.onSuccess?.(data);
                return data;
            } catch (error) {
                handleError(error, options?.errorMessage);
                options?.onError?.(error);
                return null;
            }
        },
    };
}
