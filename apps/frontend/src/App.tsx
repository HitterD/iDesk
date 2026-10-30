import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter as Router } from 'react-router-dom';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { Toaster } from 'sonner';
import { ScreenReaderProvider } from './components/ui/ScreenReaderAnnounce';
import { LazyMotion, MotionConfig } from 'framer-motion';
import { queryClient } from './lib/queryClient';
import AppRoutes from './routes/AppRoutes';
import { useReloadOnAppUpdate } from './hooks/useReloadOnAppUpdate';

function AppUpdateWatcher() {
    useReloadOnAppUpdate();
    return null;
}

// Lazy load Framer Motion features to drastically reduce main bundle size
const loadFramerFeatures = () => import('./lib/animations').then(res => res.default);

function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <ScreenReaderProvider>
                <LazyMotion features={loadFramerFeatures}>
                    {/* Framer motion honours prefers-reduced-motion like the CSS tokens do. */}
                    <MotionConfig reducedMotion="user">
                    <Router>
                        <AppUpdateWatcher />
                        <ErrorBoundary>
                            <Toaster />
                            <AppRoutes />
                        </ErrorBoundary>
                    </Router>
                    </MotionConfig>
                </LazyMotion>
            </ScreenReaderProvider>
        </QueryClientProvider>
    );
}

export default App;
