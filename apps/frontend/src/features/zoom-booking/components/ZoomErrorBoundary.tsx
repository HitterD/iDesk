import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
    onRetry?: () => void;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary component for Zoom Calendar feature
 * Catches JavaScript errors and displays a fallback UI
 */
export class ZoomErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error: Error): Partial<State> {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('ZoomErrorBoundary caught an error:', error, errorInfo);
        this.setState({ errorInfo });
    }

    handleRetry = () => {
        this.setState({ hasError: false, error: null, errorInfo: null });
        this.props.onRetry?.();
    };

    handleGoHome = () => {
        window.location.href = '/dashboard';
    };

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center">
                    <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
                        <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
                    </div>

                    <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">
                        Terjadi Kesalahan
                    </h2>

                    <p className="text-slate-600 dark:text-slate-400 mb-6 max-w-md">
                        Maaf, terjadi kesalahan pada Zoom Calendar. Silakan coba muat ulang halaman.
                    </p>

                    {process.env.NODE_ENV === 'development' && this.state.error && (
                        <div className="mb-6 p-4 bg-slate-100 dark:bg-slate-800 rounded-lg text-left text-sm max-w-lg overflow-auto">
                            <p className="font-mono text-red-600 dark:text-red-400 mb-2">
                                {this.state.error.message}
                            </p>
                            <pre className="text-xs text-slate-500 dark:text-slate-400 whitespace-pre-wrap">
                                {this.state.errorInfo?.componentStack}
                            </pre>
                        </div>
                    )}

                    <div className="flex gap-3">
                        <Button
                            variant="outline"
                            onClick={this.handleGoHome}
                            className="gap-2"
                        >
                            <Home className="w-4 h-4" />
                            Dashboard
                        </Button>
                        <Button
                            onClick={this.handleRetry}
                            className="gap-2"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Coba Lagi
                        </Button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ZoomErrorBoundary;
