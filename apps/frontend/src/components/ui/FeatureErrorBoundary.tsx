import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
    children: ReactNode;
    featureName?: string;
    fallback?: ReactNode;
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

/**
 * Feature-level error boundary for graceful degradation
 * Use this to wrap individual features so one feature's error doesn't crash the whole app
 */
export class FeatureErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error(`[${this.props.featureName || 'Feature'}] Error:`, error, errorInfo);

        // Call optional error handler (for logging services)
        if (this.props.onError) {
            this.props.onError(error, errorInfo);
        }
    }

    private handleRetry = () => {
        this.setState({ hasError: false, error: null });
    };

    public render() {
        if (this.state.hasError) {
            // Use custom fallback if provided
            if (this.props.fallback) {
                return this.props.fallback;
            }

            // Default error UI
            return (
                <div className="flex flex-col items-center justify-center p-8 bg-navy-light/50 rounded-lg border border-white/10 text-center">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-500/20 text-red-500 mb-4">
                        <AlertTriangle className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">
                        {this.props.featureName ? `${this.props.featureName} Error` : 'Something went wrong'}
                    </h3>
                    <p className="text-sm text-slate-400 mb-4 max-w-md">
                        This feature encountered an error. You can try refreshing or continue using other features.
                    </p>
                    <button
                        onClick={this.handleRetry}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-neon-green/20 text-neon-green font-medium rounded-lg hover:bg-neon-green/30 transition-colors"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Try Again
                    </button>
                    {import.meta.env.DEV && this.state.error && (
                        <details className="mt-4 text-left w-full">
                            <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-400">
                                Error Details (Dev Only)
                            </summary>
                            <pre className="mt-2 p-3 bg-navy-main rounded text-xs text-red-400 overflow-auto max-h-32">
                                {this.state.error.message}
                                {'\n'}
                                {this.state.error.stack}
                            </pre>
                        </details>
                    )}
                </div>
            );
        }

        return this.props.children;
    }
}
