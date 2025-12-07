import React, { Component, ErrorInfo, ReactNode } from 'react';
import { QueryErrorResetBoundary } from '@tanstack/react-query';
import { AlertTriangle, RefreshCw, WifiOff, ServerCrash, Ban } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
    className?: string;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorType: 'network' | 'server' | 'forbidden' | 'unknown';
}

/**
 * Error boundary specifically designed for React Query errors.
 * Provides retry functionality and categorized error messages.
 */
class QueryErrorBoundaryInner extends Component<Props & { reset: () => void }, State> {
    public state: State = {
        hasError: false,
        error: null,
        errorType: 'unknown',
    };

    public static getDerivedStateFromError(error: Error): State {
        const errorType = QueryErrorBoundaryInner.categorizeError(error);
        return { hasError: true, error, errorType };
    }

    private static categorizeError(error: Error): State['errorType'] {
        const message = error.message.toLowerCase();
        const code = (error as any).code;

        // Network errors
        if (
            message.includes('network') ||
            message.includes('fetch') ||
            message.includes('econnrefused') ||
            code === 'ERR_NETWORK'
        ) {
            return 'network';
        }

        // Server errors (5xx)
        if (
            message.includes('500') ||
            message.includes('502') ||
            message.includes('503') ||
            message.includes('server error')
        ) {
            return 'server';
        }

        // Forbidden/Auth errors
        if (
            message.includes('403') ||
            message.includes('forbidden') ||
            message.includes('unauthorized')
        ) {
            return 'forbidden';
        }

        return 'unknown';
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('[QueryErrorBoundary] Error:', error, errorInfo);
        this.props.onError?.(error, errorInfo);
    }

    private handleRetry = () => {
        this.props.reset();
        this.setState({ hasError: false, error: null, errorType: 'unknown' });
    };

    public render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className={cn(
                    "flex flex-col items-center justify-center p-8 rounded-xl",
                    "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700",
                    "shadow-sm",
                    this.props.className
                )}>
                    {this.renderErrorContent()}
                </div>
            );
        }

        return this.props.children;
    }

    private renderErrorContent() {
        const { errorType, error } = this.state;

        const configs = {
            network: {
                icon: WifiOff,
                title: 'Connection Problem',
                description: 'Unable to connect to the server. Please check your internet connection.',
                iconColor: 'text-amber-500',
                bgColor: 'bg-amber-50 dark:bg-amber-900/20',
            },
            server: {
                icon: ServerCrash,
                title: 'Server Error',
                description: 'The server encountered an error. Our team has been notified.',
                iconColor: 'text-red-500',
                bgColor: 'bg-red-50 dark:bg-red-900/20',
            },
            forbidden: {
                icon: Ban,
                title: 'Access Denied',
                description: 'You don\'t have permission to access this resource.',
                iconColor: 'text-purple-500',
                bgColor: 'bg-purple-50 dark:bg-purple-900/20',
            },
            unknown: {
                icon: AlertTriangle,
                title: 'Something Went Wrong',
                description: 'An unexpected error occurred. Please try again.',
                iconColor: 'text-slate-500',
                bgColor: 'bg-slate-50 dark:bg-slate-800',
            },
        };

        const config = configs[errorType];
        const Icon = config.icon;

        return (
            <>
                <div className={cn(
                    "w-16 h-16 rounded-full flex items-center justify-center mb-4",
                    config.bgColor
                )}>
                    <Icon className={cn("w-8 h-8", config.iconColor)} />
                </div>

                <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-2">
                    {config.title}
                </h3>

                <p className="text-sm text-slate-500 dark:text-slate-400 text-center max-w-sm mb-6">
                    {config.description}
                </p>

                {import.meta.env.DEV && error && (
                    <details className="mb-4 w-full max-w-sm">
                        <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-600">
                            Error Details
                        </summary>
                        <pre className="mt-2 p-3 bg-slate-100 dark:bg-slate-800 rounded text-xs text-slate-600 dark:text-slate-300 overflow-auto max-h-24">
                            {error.message}
                        </pre>
                    </details>
                )}

                <button
                    onClick={this.handleRetry}
                    className={cn(
                        "inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium",
                        "bg-primary text-white hover:bg-primary/90",
                        "transition-colors duration-200"
                    )}
                >
                    <RefreshCw className="w-4 h-4" />
                    Try Again
                </button>
            </>
        );
    }
}

/**
 * Query Error Boundary that integrates with React Query's reset functionality.
 * Wrap around components that use React Query to provide automatic error handling.
 * 
 * @example
 * <QueryErrorBoundary>
 *   <MyComponentUsingReactQuery />
 * </QueryErrorBoundary>
 */
export const QueryErrorBoundary: React.FC<Props> = (props) => {
    return (
        <QueryErrorResetBoundary>
            {({ reset }) => (
                <QueryErrorBoundaryInner {...props} reset={reset} />
            )}
        </QueryErrorResetBoundary>
    );
};

export default QueryErrorBoundary;
