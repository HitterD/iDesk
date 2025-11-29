import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { FeatureErrorBoundary } from './components/ui/FeatureErrorBoundary';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { Toaster } from 'sonner';
import { Loader2 } from 'lucide-react';

// Eagerly loaded (critical auth path only)
import { BentoLoginPage } from './features/auth/pages/BentoLoginPage';
import { UnauthorizedPage } from './features/auth/pages/UnauthorizedPage';

// Lazy loaded layouts (Admin/Agent vs User portals - separate bundles)
const BentoLayout = lazy(() => import('./components/layout/BentoLayout').then(m => ({ default: m.BentoLayout })));
const ClientLayout = lazy(() => import('./components/layout/ClientLayout').then(m => ({ default: m.ClientLayout })));

// Lazy loaded dashboard (heavy component)
const BentoDashboardPage = lazy(() => import('./features/dashboard/pages/BentoDashboardPage').then(m => ({ default: m.BentoDashboardPage })));

// Lazy loaded pages (code splitting for all feature modules)
const BentoTicketKanban = lazy(() => import('./features/ticket-board/components/BentoTicketKanban').then(m => ({ default: m.BentoTicketKanban })));
const BentoTicketListPage = lazy(() => import('./features/ticket-board/pages/BentoTicketListPage').then(m => ({ default: m.BentoTicketListPage })));
const BentoTicketDetailPage = lazy(() => import('./features/ticket-board/pages/BentoTicketDetailPage').then(m => ({ default: m.BentoTicketDetailPage })));
const BentoSettingsPage = lazy(() => import('./features/settings/pages/BentoSettingsPage').then(m => ({ default: m.BentoSettingsPage })));
const BentoAdminAgentsPage = lazy(() => import('./features/admin/pages/BentoAdminAgentsPage').then(m => ({ default: m.BentoAdminAgentsPage })));
const BentoMyTicketsPage = lazy(() => import('./features/client/pages/BentoMyTicketsPage').then(m => ({ default: m.BentoMyTicketsPage })));
const BentoCreateTicketPage = lazy(() => import('./features/client/pages/BentoCreateTicketPage').then(m => ({ default: m.BentoCreateTicketPage })));
const ClientTicketDetailPage = lazy(() => import('./features/client/pages/ClientTicketDetailPage').then(m => ({ default: m.ClientTicketDetailPage })));
const ClientKnowledgeBasePage = lazy(() => import('./features/client/pages/ClientKnowledgeBasePage').then(m => ({ default: m.ClientKnowledgeBasePage })));
const ClientArticleDetailPage = lazy(() => import('./features/client/pages/ClientArticleDetailPage').then(m => ({ default: m.ClientArticleDetailPage })));
const ClientProfilePage = lazy(() => import('./features/client/pages/ClientProfilePage').then(m => ({ default: m.ClientProfilePage })));
const BentoReportsPage = lazy(() => import('./features/reports/pages/BentoReportsPage').then(m => ({ default: m.BentoReportsPage })));
const BentoKnowledgeBasePage = lazy(() => import('./features/knowledge-base/pages/BentoKnowledgeBasePage').then(m => ({ default: m.BentoKnowledgeBasePage })));
const BentoArticleDetailPage = lazy(() => import('./features/knowledge-base/pages/BentoArticleDetailPage').then(m => ({ default: m.BentoArticleDetailPage })));
const BentoCreateArticlePage = lazy(() => import('./features/knowledge-base/pages/BentoCreateArticlePage').then(m => ({ default: m.BentoCreateArticlePage })));
const BentoEditArticlePage = lazy(() => import('./features/knowledge-base/pages/BentoEditArticlePage').then(m => ({ default: m.BentoEditArticlePage })));
const BentoManageArticlesPage = lazy(() => import('./features/knowledge-base/pages/BentoManageArticlesPage').then(m => ({ default: m.BentoManageArticlesPage })));
const BentoSlaSettingsPage = lazy(() => import('./features/admin/pages/BentoSlaSettingsPage').then(m => ({ default: m.BentoSlaSettingsPage })));
const BentoFeedbackPage = lazy(() => import('./features/public/pages/BentoFeedbackPage').then(m => ({ default: m.BentoFeedbackPage })));
const RenewalDashboardPage = lazy(() => import('./features/renewal/pages/RenewalDashboardPage').then(m => ({ default: m.RenewalDashboardPage })));
const NotificationCenterPage = lazy(() => import('./features/notifications/pages/NotificationCenterPage').then(m => ({ default: m.NotificationCenterPage })));

// Loading fallback component
const PageLoader = () => (
    <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-neon-green" />
    </div>
);

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 5000, // Data is fresh for 5 seconds (reduced from 30s for real-time feel)
            gcTime: 5 * 60 * 1000, // Cache for 5 minutes (formerly cacheTime)
            refetchOnWindowFocus: true, // Refetch when user returns to tab
            refetchOnReconnect: true,
            retry: 1, // Only retry once
            retryDelay: 1000,
        },
    },
});

function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <ErrorBoundary>
                <Toaster />
                <Router>
                    <Routes>
                        {/* Public Routes */}
                        <Route path="/login" element={<BentoLoginPage />} />
                        <Route path="/unauthorized" element={<UnauthorizedPage />} />
                        <Route path="/feedback/:token" element={<Suspense fallback={<PageLoader />}><BentoFeedbackPage /></Suspense>} />

                        {/* Admin/Agent Routes - Lazy loaded portal */}
                        <Route
                            path="/"
                            element={
                                <ProtectedRoute allowedRoles={['ADMIN', 'AGENT']}>
                                    <Suspense fallback={<PageLoader />}>
                                        <BentoLayout />
                                    </Suspense>
                                </ProtectedRoute>
                            }
                        >
                            <Route path="dashboard" element={
                                <FeatureErrorBoundary featureName="Dashboard">
                                    <Suspense fallback={<PageLoader />}>
                                        <BentoDashboardPage />
                                    </Suspense>
                                </FeatureErrorBoundary>
                            } />
                            <Route path="kanban" element={
                                <FeatureErrorBoundary featureName="Kanban Board">
                                    <Suspense fallback={<PageLoader />}>
                                        <BentoTicketKanban />
                                    </Suspense>
                                </FeatureErrorBoundary>
                            } />
                            <Route path="tickets/list" element={
                                <FeatureErrorBoundary featureName="Ticket List">
                                    <Suspense fallback={<PageLoader />}>
                                        <BentoTicketListPage />
                                    </Suspense>
                                </FeatureErrorBoundary>
                            } />
                            <Route path="tickets/:id" element={
                                <FeatureErrorBoundary featureName="Ticket Detail">
                                    <Suspense fallback={<PageLoader />}>
                                        <BentoTicketDetailPage />
                                    </Suspense>
                                </FeatureErrorBoundary>
                            } />
                            <Route path="tickets/create" element={
                                <FeatureErrorBoundary featureName="Create Ticket">
                                    <Suspense fallback={<PageLoader />}>
                                        <BentoCreateTicketPage />
                                    </Suspense>
                                </FeatureErrorBoundary>
                            } />
                            <Route path="settings" element={
                                <FeatureErrorBoundary featureName="Settings">
                                    <Suspense fallback={<PageLoader />}>
                                        <BentoSettingsPage />
                                    </Suspense>
                                </FeatureErrorBoundary>
                            } />
                            <Route
                                path="agents"
                                element={
                                    <ProtectedRoute allowedRoles={['ADMIN']}>
                                        <FeatureErrorBoundary featureName="Agent Management">
                                            <Suspense fallback={<PageLoader />}>
                                                <BentoAdminAgentsPage />
                                            </Suspense>
                                        </FeatureErrorBoundary>
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="reports"
                                element={
                                    <ProtectedRoute allowedRoles={['ADMIN']}>
                                        <FeatureErrorBoundary featureName="Reports">
                                            <Suspense fallback={<PageLoader />}>
                                                <BentoReportsPage />
                                            </Suspense>
                                        </FeatureErrorBoundary>
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="sla"
                                element={
                                    <ProtectedRoute allowedRoles={['ADMIN']}>
                                        <FeatureErrorBoundary featureName="SLA Settings">
                                            <Suspense fallback={<PageLoader />}>
                                                <BentoSlaSettingsPage />
                                            </Suspense>
                                        </FeatureErrorBoundary>
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="renewal"
                                element={
                                    <ProtectedRoute allowedRoles={['ADMIN']}>
                                        <FeatureErrorBoundary featureName="Renewal Reminders">
                                            <Suspense fallback={<PageLoader />}>
                                                <RenewalDashboardPage />
                                            </Suspense>
                                        </FeatureErrorBoundary>
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="notifications"
                                element={
                                    <FeatureErrorBoundary featureName="Notification Center">
                                        <Suspense fallback={<PageLoader />}>
                                            <NotificationCenterPage />
                                        </Suspense>
                                    </FeatureErrorBoundary>
                                }
                            />
                            <Route path="kb" element={<FeatureErrorBoundary featureName="Knowledge Base"><Suspense fallback={<PageLoader />}><BentoKnowledgeBasePage /></Suspense></FeatureErrorBoundary>} />
                            <Route path="kb/manage" element={<FeatureErrorBoundary featureName="Manage Articles"><Suspense fallback={<PageLoader />}><BentoManageArticlesPage /></Suspense></FeatureErrorBoundary>} />
                            <Route path="kb/create" element={<FeatureErrorBoundary featureName="Create Article"><Suspense fallback={<PageLoader />}><BentoCreateArticlePage /></Suspense></FeatureErrorBoundary>} />
                            <Route path="kb/articles/:id" element={<FeatureErrorBoundary featureName="Article Detail"><Suspense fallback={<PageLoader />}><BentoArticleDetailPage /></Suspense></FeatureErrorBoundary>} />
                            <Route path="kb/articles/:id/edit" element={<FeatureErrorBoundary featureName="Edit Article"><Suspense fallback={<PageLoader />}><BentoEditArticlePage /></Suspense></FeatureErrorBoundary>} />
                            <Route index element={<Navigate to="/dashboard" replace />} />
                        </Route>

                        {/* Client Routes - Lazy loaded portal (separate bundle from Admin) */}
                        <Route
                            path="/client"
                            element={
                                <ProtectedRoute allowedRoles={['USER']}>
                                    <Suspense fallback={<PageLoader />}>
                                        <ClientLayout />
                                    </Suspense>
                                </ProtectedRoute>
                            }
                        >
                            <Route path="my-tickets" element={<FeatureErrorBoundary featureName="My Tickets"><Suspense fallback={<PageLoader />}><BentoMyTicketsPage /></Suspense></FeatureErrorBoundary>} />
                            <Route path="create" element={<FeatureErrorBoundary featureName="Create Ticket"><Suspense fallback={<PageLoader />}><BentoCreateTicketPage /></Suspense></FeatureErrorBoundary>} />
                            <Route path="tickets/:id" element={<FeatureErrorBoundary featureName="Ticket Detail"><Suspense fallback={<PageLoader />}><ClientTicketDetailPage /></Suspense></FeatureErrorBoundary>} />
                            <Route path="kb" element={<FeatureErrorBoundary featureName="Knowledge Base"><Suspense fallback={<PageLoader />}><ClientKnowledgeBasePage /></Suspense></FeatureErrorBoundary>} />
                            <Route path="kb/articles/:id" element={<FeatureErrorBoundary featureName="Article Detail"><Suspense fallback={<PageLoader />}><ClientArticleDetailPage /></Suspense></FeatureErrorBoundary>} />
                            <Route path="profile" element={<FeatureErrorBoundary featureName="Profile"><Suspense fallback={<PageLoader />}><ClientProfilePage /></Suspense></FeatureErrorBoundary>} />
                            <Route index element={<Navigate to="/client/my-tickets" replace />} />
                        </Route>

                        {/* Fallback */}
                        <Route path="*" element={<Navigate to="/dashboard" replace />} />
                    </Routes>
                </Router>
            </ErrorBoundary>
        </QueryClientProvider>
    );
}

export default App;
