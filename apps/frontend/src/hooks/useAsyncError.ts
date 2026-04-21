import { useState, useCallback } from 'react';

/**
 * Hook to propagate async errors to the nearest error boundary.
 * Useful for handling errors in event handlers and useEffect callbacks
 * that would otherwise not be caught by React error boundaries.
 * 
 * @example
 * const throwError = useAsyncError();
 * 
 * const handleClick = async () => {
 *   try {
 *     await someAsyncOperation();
 *   } catch (error) {
 *     throwError(error); // This will be caught by ErrorBoundary
 *   }
 * };
 */
export function useAsyncError() {
    const [, setError] = useState<Error>();

    return useCallback((error: unknown) => {
        setError(() => {
            if (error instanceof Error) {
                throw error;
            }
            throw new Error(String(error));
        });
    }, []);
}

/**
 * Creates an error that can be thrown to trigger error boundary
 */
export function createBoundaryError(message: string, code?: string): Error {
    const error = new Error(message);
    (error as any).code = code;
    return error;
}

export default useAsyncError;
