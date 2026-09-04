import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter as Router } from 'react-router-dom';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { Toaster } from 'sonner';
import { ScreenReaderProvider } from './components/ui/ScreenReaderAnnounce';
import { LazyMotion } from 'framer-motion';
import { queryClient } from './lib/queryClient';
import AppRoutes from './routes/AppRoutes';

// Lazy load Framer Motion features to drastically reduce main bundle size
const loadFramerFeatures = () => import('./lib/animations').then(res => res.default);

function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <ScreenReaderProvider>
                <LazyMotion features={loadFramerFeatures}>
                    <Router>
                        <ErrorBoundary>
                            <Toaster />
                            <AppRoutes />
                        </ErrorBoundary>
                    </Router>
                </LazyMotion>
            </ScreenReaderProvider>
        </QueryClientProvider>
    );
}

export default App;
