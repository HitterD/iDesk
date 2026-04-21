import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error?: Error;
}

/**
 * Error Boundary for Agent Cards
 * Prevents a single card error from breaking the entire grid
 */
export class AgentCardErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('AgentCard Error:', error, errorInfo);
    }

    handleRetry = () => {
        this.setState({ hasError: false, error: undefined });
    };

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="glass-card p-4 rounded-2xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
                    <div className="flex items-center gap-3 text-red-600 dark:text-red-400 mb-3">
                        <AlertCircle className="w-5 h-5" />
                        <span className="font-medium text-sm">Error loading card</span>
                    </div>
                    <p className="text-xs text-red-500 dark:text-red-400 mb-3">
                        {this.state.error?.message || 'Something went wrong'}
                    </p>
                    <button
                        onClick={this.handleRetry}
                        className="flex items-center gap-1.5 text-xs text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                    >
                        <RefreshCw className="w-3 h-3" />
                        Try again
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

export default AgentCardErrorBoundary;
