import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter as Router } from 'react-router-dom';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { Toaster } from 'sonner';
import { ScreenReaderProvider } from './components/ui/ScreenReaderAnnounce';
import { LazyMotion } from 'framer-motion';
import AppRoutes from './routes/AppRoutes';

// Lazy load Framer Motion features to drastically reduce main bundle size
const loadFramerFeatures = () => import('./lib/animations').then(res => res.default);

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 5000,
            gcTime: 5 * 60 * 1000,
            refetchOnWindowFocus: true,
            refetchOnReconnect: true,
            retry: 1,
            retryDelay: 1000,
        },
    },
});

function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <ScreenReaderProvider>
                <LazyMotion features={loadFramerFeatures} strict>
                    <ErrorBoundary>
                        <Toaster />
                        <Router>
                            <AppRoutes />
                        </Router>
                    </ErrorBoundary>
                </LazyMotion>
            </ScreenReaderProvider>
        </QueryClientProvider>
    );
}

export default App;
