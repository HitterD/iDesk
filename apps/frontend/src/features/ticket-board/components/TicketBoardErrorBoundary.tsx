import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, ChevronLeft } from 'lucide-react';
import { logger } from '@/lib/logger';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary for the Ticket Board feature
 * Catches JavaScript errors anywhere in the child component tree
 * and displays a graceful fallback UI instead of crashing the whole app
 */
export class TicketBoardErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
        };
    }

    static getDerivedStateFromError(error: Error): Partial<State> {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        // Log the error for debugging
        logger.error('TicketBoard Error Boundary caught an error:', {
            error: error.message,
            stack: error.stack,
            componentStack: errorInfo.componentStack,
        });

        this.setState({ errorInfo });

        // Call optional error handler
        this.props.onError?.(error, errorInfo);
    }

    handleRetry = (): void => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null,
        });
    };

    handleGoHome = (): void => {
        window.location.href = '/';
    };

    handleGoBack = (): void => {
        window.history.back();
    };

    render(): ReactNode {
        if (this.state.hasError) {
            // Custom fallback if provided
            if (this.props.fallback) {
                return this.props.fallback;
            }

            // Default error UI
            return (
                <div className="min-h-[400px] flex items-center justify-center p-8">
                    <div className="max-w-md w-full text-center">
                        {/* Error Icon */}
                        <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-red-100 to-red-50 dark:from-red-900/30 dark:to-red-900/20 flex items-center justify-center mb-6 shadow-lg shadow-red-200/30 dark:shadow-red-900/20">
                            <AlertTriangle className="w-8 h-8 text-red-500" />
                        </div>

                        {/* Error Title */}
                        <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">
                            Something went wrong
                        </h2>

                        {/* Error Description */}
                        <p className="text-slate-500 dark:text-slate-400 mb-6">
                            We encountered an unexpected error while loading the tickets.
                            This has been logged and our team will look into it.
                        </p>

                        {/* Error Details (collapsible in dev) */}
                        {process.env.NODE_ENV === 'development' && this.state.error && (
                            <details className="mb-6 text-left">
                                <summary className="cursor-pointer text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                                    Show error details
                                </summary>
                                <div className="mt-2 p-3 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-auto max-h-40">
                                    <pre className="text-xs text-red-600 dark:text-red-400 whitespace-pre-wrap">
                                        {this.state.error.message}
                                    </pre>
                                    {this.state.error.stack && (
                                        <pre className="text-xs text-slate-500 mt-2 whitespace-pre-wrap">
                                            {this.state.error.stack}
                                        </pre>
                                    )}
                                </div>
                            </details>
                        )}

                        {/* Action Buttons */}
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                            <button
                                onClick={this.handleRetry}
                                className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-primary to-primary/90 text-slate-900 rounded-xl font-medium hover:from-primary/90 hover:to-primary/80 transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30"
                            >
                                <RefreshCw className="w-4 h-4" />
                                Try Again
                            </button>
                            <button
                                onClick={this.handleGoBack}
                                className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 glass-card hover:bg-white/50 dark:hover:bg-slate-800/50 text-slate-600 dark:text-slate-300 font-medium rounded-xl transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out"
                            >
                                <ChevronLeft className="w-4 h-4" />
                                Go Back
                            </button>
                            <button
                                onClick={this.handleGoHome}
                                className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 glass-card hover:bg-white/50 dark:hover:bg-slate-800/50 text-slate-600 dark:text-slate-300 font-medium rounded-xl transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out"
                            >
                                <Home className="w-4 h-4" />
                                Home
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default TicketBoardErrorBoundary;
