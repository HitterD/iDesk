import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { FeatureErrorBoundary } from './components/ui/FeatureErrorBoundary';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { Toaster } from 'sonner';
import { LoadingScreen } from './components/ui/LoadingScreen';
import { ScreenReaderProvider } from './components/ui/ScreenReaderAnnounce';

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
const ClientNotificationCenter = lazy(() => import('./features/client/pages/ClientNotificationCenter').then(m => ({ default: m.ClientNotificationCenter })));
const AutomationRulesPage = lazy(() => import('./features/automation/pages/AutomationRulesPage').then(m => ({ default: m.AutomationRulesPage })));
const ManagerDashboard = lazy(() => import('./features/manager/pages/ManagerDashboard').then(m => ({ default: m.ManagerDashboard })));
const ManagerReportsPage = lazy(() => import('./features/manager/pages/ManagerReportsPage').then(m => ({ default: m.ManagerReportsPage })));
const ManagerTicketsPage = lazy(() => import('./features/manager/pages/ManagerTicketsPage').then(m => ({ default: m.ManagerTicketsPage })));
const ManagerLayout = lazy(() => import('./components/layout/ManagerLayout').then(m => ({ default: m.ManagerLayout })));

// Admin Feature Pages
const AuditLogPage = lazy(() => import('./features/admin/pages/AuditLogPage').then(m => ({ default: m.AuditLogPage })));
const SystemHealthPage = lazy(() => import('./features/admin/pages/SystemHealthPage').then(m => ({ default: m.SystemHealthPage })));

// Zoom Booking Calendar
const ZoomCalendarPage = lazy(() => import('./features/zoom-booking/pages/ZoomCalendarPage').then(m => ({ default: m.ZoomCalendarPage })));
const ZoomSettingsPage = lazy(() => import('./features/zoom-booking/pages/ZoomSettingsPage').then(m => ({ default: m.ZoomSettingsPage })));

// Loading fallback component
const PageLoader = () => (
    <LoadingScreen message="Loading..." />
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
            <ScreenReaderProvider>
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
                                        <ProtectedRoute allowedRoles={['ADMIN', 'MANAGER']}>
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
                                        <ProtectedRoute allowedRoles={['ADMIN', 'MANAGER']}>
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
                                <Route
                                    path="automation"
                                    element={
                                        <ProtectedRoute allowedRoles={['ADMIN']}>
                                            <FeatureErrorBoundary featureName="Automation Rules">
                                                <Suspense fallback={<PageLoader />}>
                                                    <AutomationRulesPage />
                                                </Suspense>
                                            </FeatureErrorBoundary>
                                        </ProtectedRoute>
                                    }
                                />
                                <Route path="kb" element={<FeatureErrorBoundary featureName="Knowledge Base"><Suspense fallback={<PageLoader />}><BentoKnowledgeBasePage /></Suspense></FeatureErrorBoundary>} />
                                <Route path="kb/manage" element={<FeatureErrorBoundary featureName="Manage Articles"><Suspense fallback={<PageLoader />}><BentoManageArticlesPage /></Suspense></FeatureErrorBoundary>} />
                                <Route path="kb/create" element={<FeatureErrorBoundary featureName="Create Article"><Suspense fallback={<PageLoader />}><BentoCreateArticlePage /></Suspense></FeatureErrorBoundary>} />
                                <Route path="kb/articles/:id" element={<FeatureErrorBoundary featureName="Article Detail"><Suspense fallback={<PageLoader />}><BentoArticleDetailPage /></Suspense></FeatureErrorBoundary>} />
                                <Route path="kb/articles/:id/edit" element={<FeatureErrorBoundary featureName="Edit Article"><Suspense fallback={<PageLoader />}><BentoEditArticlePage /></Suspense></FeatureErrorBoundary>} />

                                {/* Admin-only Feature Pages */}
                                <Route
                                    path="audit-logs"
                                    element={
                                        <ProtectedRoute allowedRoles={['ADMIN']}>
                                            <FeatureErrorBoundary featureName="Audit Logs">
                                                <Suspense fallback={<PageLoader />}>
                                                    <AuditLogPage />
                                                </Suspense>
                                            </FeatureErrorBoundary>
                                        </ProtectedRoute>
                                    }
                                />
                                <Route
                                    path="system-health"
                                    element={
                                        <ProtectedRoute allowedRoles={['ADMIN']}>
                                            <FeatureErrorBoundary featureName="System Health">
                                                <Suspense fallback={<PageLoader />}>
                                                    <SystemHealthPage />
                                                </Suspense>
                                            </FeatureErrorBoundary>
                                        </ProtectedRoute>
                                    }
                                />

                                {/* Zoom Booking Calendar */}
                                <Route path="zoom-calendar" element={
                                    <FeatureErrorBoundary featureName="Zoom Calendar">
                                        <Suspense fallback={<PageLoader />}>
                                            <ZoomCalendarPage />
                                        </Suspense>
                                    </FeatureErrorBoundary>
                                } />

                                {/* Zoom Settings (Admin Only) */}
                                <Route path="zoom-settings" element={
                                    <ProtectedRoute allowedRoles={['ADMIN']}>
                                        <FeatureErrorBoundary featureName="Zoom Settings">
                                            <Suspense fallback={<PageLoader />}>
                                                <ZoomSettingsPage />
                                            </Suspense>
                                        </FeatureErrorBoundary>
                                    </ProtectedRoute>
                                } />

                                <Route index element={<Navigate to="/dashboard" replace />} />
                            </Route>

                            {/* Manager Routes - Separate portal with own layout */}
                            <Route
                                path="/manager"
                                element={
                                    <ProtectedRoute allowedRoles={['MANAGER']}>
                                        <Suspense fallback={<PageLoader />}>
                                            <ManagerLayout />
                                        </Suspense>
                                    </ProtectedRoute>
                                }
                            >
                                <Route index element={<Navigate to="/manager/dashboard" replace />} />
                                <Route path="dashboard" element={
                                    <FeatureErrorBoundary featureName="Manager Dashboard">
                                        <Suspense fallback={<PageLoader />}>
                                            <ManagerDashboard />
                                        </Suspense>
                                    </FeatureErrorBoundary>
                                } />
                                <Route path="tickets" element={
                                    <FeatureErrorBoundary featureName="Manager Tickets">
                                        <Suspense fallback={<PageLoader />}>
                                            <ManagerTicketsPage />
                                        </Suspense>
                                    </FeatureErrorBoundary>
                                } />
                                <Route path="reports" element={
                                    <FeatureErrorBoundary featureName="Manager Reports">
                                        <Suspense fallback={<PageLoader />}>
                                            <ManagerReportsPage />
                                        </Suspense>
                                    </FeatureErrorBoundary>
                                } />
                                <Route path="kb" element={
                                    <FeatureErrorBoundary featureName="Knowledge Base">
                                        <Suspense fallback={<PageLoader />}>
                                            <BentoKnowledgeBasePage />
                                        </Suspense>
                                    </FeatureErrorBoundary>
                                } />
                                <Route path="kb/articles/:id" element={
                                    <FeatureErrorBoundary featureName="Article Detail">
                                        <Suspense fallback={<PageLoader />}>
                                            <BentoArticleDetailPage />
                                        </Suspense>
                                    </FeatureErrorBoundary>
                                } />
                                <Route path="zoom-calendar" element={
                                    <FeatureErrorBoundary featureName="Zoom Calendar">
                                        <Suspense fallback={<PageLoader />}>
                                            <ZoomCalendarPage />
                                        </Suspense>
                                    </FeatureErrorBoundary>
                                } />
                                <Route path="renewal" element={
                                    <FeatureErrorBoundary featureName="Renewal Reminders">
                                        <Suspense fallback={<PageLoader />}>
                                            <RenewalDashboardPage />
                                        </Suspense>
                                    </FeatureErrorBoundary>
                                } />
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
                                <Route path="notifications" element={<FeatureErrorBoundary featureName="Notifications"><Suspense fallback={<PageLoader />}><ClientNotificationCenter /></Suspense></FeatureErrorBoundary>} />
                                <Route path="zoom-calendar" element={<FeatureErrorBoundary featureName="Zoom Calendar"><Suspense fallback={<PageLoader />}><ZoomCalendarPage /></Suspense></FeatureErrorBoundary>} />
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
            </ScreenReaderProvider>
        </QueryClientProvider>
    );
}

export default App;
