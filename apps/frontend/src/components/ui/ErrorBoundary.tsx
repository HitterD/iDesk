import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
    };

    public static getDerivedStateFromError(_: Error): State {
        return { hasError: true };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex items-center justify-center bg-navy-main text-white p-4">
                    <div className="text-center max-w-md">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-500/20 text-red-500 mb-6">
                            <AlertTriangle className="w-8 h-8" />
                        </div>
                        <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
                        <p className="text-slate-400 mb-6">
                            We encountered an unexpected error. Please try refreshing the page.
                        </p>
                        <button
                            onClick={() => window.location.reload()}
                            className="px-6 py-2 bg-neon-green text-navy-main font-bold rounded-lg hover:bg-neon-green/90 transition-colors"
                        >
                            Refresh Page
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
