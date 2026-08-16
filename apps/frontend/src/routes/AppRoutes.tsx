import { Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { ErrorBoundary } from '../components/ui/ErrorBoundary';
import { FeatureErrorBoundary } from '../components/ui/FeatureErrorBoundary';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';
import { Toaster } from 'sonner';
import { LoadingScreen } from '../components/ui/LoadingScreen';
import { ScreenReaderProvider } from '../components/ui/ScreenReaderAnnounce';
import { LazyMotion } from 'framer-motion';
import { useSessionTimeout } from '../hooks/useSessionTimeout';

// Lazy load Framer Motion features to drastically reduce main bundle size
const loadFramerFeatures = () => import('../lib/animations').then(res => res.default);

// Eagerly loaded (critical auth path only)
import { BentoLoginPage } from '../features/auth/pages/BentoLoginPage';
import { UnauthorizedPage } from '../features/auth/pages/UnauthorizedPage';

// Lazy loaded layouts (Admin/Agent vs User portals - separate bundles)
const BentoLayout = lazy(() => import('../components/layout/BentoLayout').then(m => ({ default: m.BentoLayout })));
const ClientLayout = lazy(() => import('../components/layout/ClientLayout').then(m => ({ default: m.ClientLayout })));

const BentoDashboardPage = lazy(() => import('../features/dashboard/pages/BentoDashboardPage').then(m => ({ default: m.BentoDashboardPage })));

// Lazy loaded pages (code splitting for all feature modules)
const BentoTicketKanban = lazy(() => import('../features/ticket-board/components/BentoTicketKanban').then(m => ({ default: m.BentoTicketKanban })));
const BentoTicketListPage = lazy(() => import('../features/ticket-board/pages/BentoTicketListPage').then(m => ({ default: m.BentoTicketListPage })));
const BentoOracleK2TicketsPage = lazy(() => import('../features/ticket-board/pages/BentoOracleK2TicketsPage').then(m => ({ default: m.BentoOracleK2TicketsPage })));
const BentoTicketDetailPage = lazy(() => import('../features/ticket-board/pages/BentoTicketDetailPage').then(m => ({ default: m.BentoTicketDetailPage })));
const BentoSettingsPage = lazy(() => import('../features/settings/pages/BentoSettingsPage').then(m => ({ default: m.BentoSettingsPage })));
const BentoAdminAgentsPage = lazy(() => import('../features/admin/pages/BentoAdminAgentsPage').then(m => ({ default: m.BentoAdminAgentsPage })));
const BentoMyTicketsPage = lazy(() => import('../features/client/pages/BentoMyTicketsPage').then(m => ({ default: m.BentoMyTicketsPage })));
const BentoCreateTicketPage = lazy(() => import('../features/client/pages/BentoCreateTicketPage').then(m => ({ default: m.BentoCreateTicketPage })));
const ClientTicketDetailPage = lazy(() => import('../features/client/pages/ClientTicketDetailPage').then(m => ({ default: m.ClientTicketDetailPage })));
const ClientKnowledgeBasePage = lazy(() => import('../features/client/pages/ClientKnowledgeBasePage').then(m => ({ default: m.ClientKnowledgeBasePage })));
const ClientArticleDetailPage = lazy(() => import('../features/client/pages/ClientArticleDetailPage').then(m => ({ default: m.ClientArticleDetailPage })));
const ClientProfilePage = lazy(() => import('../features/client/pages/ClientProfilePage').then(m => ({ default: m.ClientProfilePage })));
const BentoReportsPage = lazy(() => import('../features/reports/pages/BentoReportsPage').then(m => ({ default: m.BentoReportsPage })));
const BentoKnowledgeBasePage = lazy(() => import('../features/knowledge-base/pages/BentoKnowledgeBasePage').then(m => ({ default: m.BentoKnowledgeBasePage })));
const BentoArticleDetailPage = lazy(() => import('../features/knowledge-base/pages/BentoArticleDetailPage').then(m => ({ default: m.BentoArticleDetailPage })));
const BentoCreateArticlePage = lazy(() => import('../features/knowledge-base/pages/BentoCreateArticlePage').then(m => ({ default: m.BentoCreateArticlePage })));
const BentoEditArticlePage = lazy(() => import('../features/knowledge-base/pages/BentoEditArticlePage').then(m => ({ default: m.BentoEditArticlePage })));
const BentoManageArticlesPage = lazy(() => import('../features/knowledge-base/pages/BentoManageArticlesPage').then(m => ({ default: m.BentoManageArticlesPage })));
const BentoSlaSettingsPage = lazy(() => import('../features/admin/pages/BentoSlaSettingsPage').then(m => ({ default: m.BentoSlaSettingsPage })));
const BentoFeedbackPage = lazy(() => import('../features/public/pages/BentoFeedbackPage').then(m => ({ default: m.BentoFeedbackPage })));
const BentoTvBoardPage = lazy(() => import('../features/public/pages/BentoTvBoardPage').then(m => ({ default: m.BentoTvBoardPage })));
const RenewalHubPage = lazy(() => import('../features/renewal/pages/RenewalHubPage'));
const NotificationCenterPage = lazy(() => import('../features/notifications/pages/NotificationCenterPage').then(m => ({ default: m.NotificationCenterPage })));
const ClientNotificationCenter = lazy(() => import('../features/client/pages/ClientNotificationCenter').then(m => ({ default: m.ClientNotificationCenter })));
const AutomationRulesPage = lazy(() => import('../features/automation/pages/AutomationRulesPage').then(m => ({ default: m.AutomationRulesPage })));
const ManagerDashboard = lazy(() => import('../features/manager/pages/ManagerDashboard').then(m => ({ default: m.ManagerDashboard })));
const AdminWorkloadDashboard = lazy(() => import('../features/manager/pages/AdminWorkloadDashboard').then(m => ({ default: m.AdminWorkloadDashboard })));
const ManagerReportsPage = lazy(() => import('../features/manager/pages/ManagerReportsPage').then(m => ({ default: m.ManagerReportsPage })));
const ManagerTicketsPage = lazy(() => import('../features/manager/pages/ManagerTicketsPage').then(m => ({ default: m.ManagerTicketsPage })));
const ManagerLayout = lazy(() => import('../components/layout/ManagerLayout').then(m => ({ default: m.ManagerLayout })));

// Admin Feature Pages
const AuditLogPage = lazy(() => import('../features/admin/pages/AuditLogPage').then(m => ({ default: m.AuditLogPage })));
const SystemHealthPage = lazy(() => import('../features/admin/pages/SystemHealthPage').then(m => ({ default: m.SystemHealthPage })));

// Zoom Booking Calendar
const ZoomCalendarPage = lazy(() => import('../features/zoom-booking/pages/ZoomCalendarPage').then(m => ({ default: m.ZoomCalendarPage })));
const ZoomSettingsPage = lazy(() => import('../features/zoom-booking/pages/ZoomSettingsPage').then(m => ({ default: m.ZoomSettingsPage })));
const ClientZoomBookingPage = lazy(() => import('../features/zoom-booking/pages/ClientZoomBookingPage').then(m => ({ default: m.ClientZoomBookingPage })));

// Hardware Request
const HardwareRequestsLayout = lazy(() => import('../features/hardware-request/layouts/HardwareRequestsLayout').then(m => ({ default: m.HardwareRequestsLayout })));
const HardwareRequestListPage = lazy(() => import('../features/hardware-request/pages/HardwareRequestListPage'));
const HardwareRequestCreatePage = lazy(() => import('../features/hardware-request/pages/HardwareRequestCreatePage'));
const HardwareRequestDetailPage = lazy(() => import('../features/hardware-request/pages/HardwareRequestDetailPage'));
const InstallationCalendarPage = lazy(() => import('../features/hardware-request/components/calendar/InstallationCalendarPage').then(m => ({ default: m.InstallationCalendarPage })));
const HardwareDashboardPage = lazy(() => import('../features/hardware-request/components/dashboard/HardwareDashboardPage').then(m => ({ default: m.HardwareDashboardPage })));
const CatalogAdminPage = lazy(() => import('../features/hardware-request/components/catalog/CatalogAdminPage').then(m => ({ default: m.CatalogAdminPage })));
const EformAccessListPage = lazy(() => import('../features/request-center/pages/EformAccessListPage').then(m => ({ default: m.EformAccessListPage })));
const EformAccessCreatePage = lazy(() => import('../features/request-center/pages/EformAccessCreatePage').then(m => ({ default: m.EformAccessCreatePage })));
const EformAccessDetailPage = lazy(() => import('../features/request-center/pages/EformAccessDetailPage').then(m => ({ default: m.EformAccessDetailPage })));
const EformApprovalPage = lazy(() => import('../features/request-center/pages/EformApprovalPage').then(m => ({ default: m.EformApprovalPage })));
const EformCredentialPage = lazy(() => import('../features/request-center/pages/EformCredentialPage').then(m => ({ default: m.EformCredentialPage })));
const LostItemListPage = lazy(() => import('../features/request-center/pages/LostItemListPage').then(m => ({ default: m.LostItemListPage })));
const MyLostReportsPage = lazy(() => import('../features/request-center/pages/MyLostReportsPage').then(m => ({ default: m.MyLostReportsPage })));
const LostItemDetailPage = lazy(() => import('../features/request-center/pages/LostItemDetailPage').then(m => ({ default: m.LostItemDetailPage })));
const QrLandingPage = lazy(() => import('../features/request-center/pages/QrLandingPage').then(m => ({ default: m.QrLandingPage })));
const ReportFoundItemPage = lazy(() => import('../features/request-center/pages/ReportFoundItemPage').then(m => ({ default: m.ReportFoundItemPage })));
const FoundClaimsQueuePage = lazy(() => import('../features/request-center/pages/FoundClaimsQueuePage').then(m => ({ default: m.FoundClaimsQueuePage })));

// VPN Access and Google Sync are now integrated into RenewalHubPage

// Loading fallback component
const PageLoader = () => (
    <LoadingScreen message="Loading..." />
);

import { z } from 'zod';

const AuthStorageSchema = z.object({
    state: z.object({
        user: z.object({
            role: z.string().nullable().optional()
        }).nullable().optional()
    }).nullable().optional()
}).catch({ state: { user: { role: null } } });

// Smart redirect component that routes users to their role-appropriate home page
// Prevents MANAGER/USER from being sent to /dashboard (ADMIN/AGENT portal)
const RoleBasedRedirect = () => {
    let userRole: string | null = null;
    try {
        const authData = localStorage.getItem('auth-storage');
        if (authData) {
            const parsed = JSON.parse(authData);
            const validated = AuthStorageSchema.parse(parsed);
            userRole = validated?.state?.user?.role || null;
        }
    } catch {
        userRole = null;
    }

    if (!userRole) {
        return <Navigate to="/login" replace />; // Default fallback for invalid/tampered roles
    }

    if (userRole === 'MANAGER') {
        return <Navigate to="/manager/dashboard" replace />;
    } else if (userRole === 'USER') {
        return <Navigate to="/client/my-tickets" replace />;
    } else if (userRole === 'AGENT_ORACLE') {
        return <Navigate to="/tickets/oracle-k2" replace />;
    }
    // ADMIN and AGENT go to admin/agent portal
    return <Navigate to="/dashboard" replace />;
};

interface LazyRouteProps {
    component: React.LazyExoticComponent<any> | React.ComponentType<any>;
    featureName: string;
    requiredPageAccess?: string;
    allowedRoles?: string[];
}

const LazyRoute = ({ component: Component, featureName, requiredPageAccess, allowedRoles }: LazyRouteProps) => {
    let element = (
        <FeatureErrorBoundary featureName={featureName}>
            <Suspense fallback={<PageLoader />}>
                <Component />
            </Suspense>
        </FeatureErrorBoundary>
    );

    if (requiredPageAccess || allowedRoles) {
        element = (
            <ProtectedRoute requiredPageAccess={requiredPageAccess} allowedRoles={allowedRoles}>
                {element}
            </ProtectedRoute>
        );
    }

    return element;
};

export default function AppRoutes() {
    useSessionTimeout();
    return (
        <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<BentoLoginPage />} />
            <Route path="/unauthorized" element={<UnauthorizedPage />} />
            <Route path="/feedback/:token" element={<Suspense fallback={<PageLoader />}><BentoFeedbackPage /></Suspense>} />
            <Route path="/tv/:token" element={<Suspense fallback={<PageLoader />}><BentoTvBoardPage /></Suspense>} />

            {/* Admin/Agent Routes - Lazy loaded portal */}
            <Route
                path="/"
                element={
                    <ProtectedRoute allowedRoles={['ADMIN', 'AGENT', 'AGENT_OPERATIONAL_SUPPORT', 'AGENT_ORACLE', 'AGENT_ADMIN']}>
                        <Suspense fallback={<PageLoader />}>
                            <BentoLayout />
                        </Suspense>
                    </ProtectedRoute>
                }
            >
                <Route path="dashboard" element={<LazyRoute component={BentoDashboardPage} featureName="Dashboard" />} />

                <Route path="kanban" element={<LazyRoute component={BentoTicketKanban} featureName="Kanban Board" />} />
                <Route path="tickets/list" element={<LazyRoute component={BentoTicketListPage} featureName="Ticket List" />} />
                <Route path="tickets/oracle-k2" element={<LazyRoute component={BentoOracleK2TicketsPage} featureName="Oracle K2 Request" allowedRoles={['AGENT_ORACLE', 'ADMIN']} requiredPageAccess="oracle_k2_tickets" />} />
                <Route path="tickets/:id" element={<LazyRoute component={BentoTicketDetailPage} featureName="Ticket Detail" />} />
                <Route path="tickets/create" element={<LazyRoute component={BentoCreateTicketPage} featureName="Create Ticket" />} />
                <Route path="settings" element={<LazyRoute component={BentoSettingsPage} featureName="Settings" requiredPageAccess="settings" />} />
                <Route path="agents" element={<LazyRoute component={BentoAdminAgentsPage} featureName="Agent Management" allowedRoles={['ADMIN']} />} />
                <Route path="reports" element={<LazyRoute component={BentoReportsPage} featureName="Reports" requiredPageAccess="reports" />} />
                <Route path="sla" element={<LazyRoute component={BentoSlaSettingsPage} featureName="SLA Settings" allowedRoles={['ADMIN']} />} />
                <Route path="renewal" element={<LazyRoute component={RenewalHubPage} featureName="Renewal Hub" requiredPageAccess="renewal" />} />
                <Route path="notifications" element={<LazyRoute component={NotificationCenterPage} featureName="Notification Center" requiredPageAccess="notifications" />} />
                <Route path="automation" element={<LazyRoute component={AutomationRulesPage} featureName="Automation Rules" allowedRoles={['ADMIN']} />} />
                
                <Route path="kb" element={<LazyRoute component={BentoKnowledgeBasePage} featureName="Knowledge Base" requiredPageAccess="knowledge_base" />} />
                <Route path="kb/manage" element={<LazyRoute component={BentoManageArticlesPage} featureName="Manage Articles" requiredPageAccess="knowledge_base" />} />
                <Route path="kb/create" element={<LazyRoute component={BentoCreateArticlePage} featureName="Create Article" requiredPageAccess="knowledge_base" />} />
                <Route path="kb/articles/:id" element={<LazyRoute component={BentoArticleDetailPage} featureName="Article Detail" requiredPageAccess="knowledge_base" />} />
                <Route path="kb/articles/:id/edit" element={<LazyRoute component={BentoEditArticlePage} featureName="Edit Article" requiredPageAccess="knowledge_base" />} />

                {/* Request Center */}
                <Route path="hardware-requests" element={<LazyRoute component={HardwareRequestsLayout} featureName="Hardware Requests" requiredPageAccess="hardware_requests" />}>
                    <Route index element={<LazyRoute component={HardwareRequestListPage} featureName="Hardware Requests" requiredPageAccess="hardware_requests" />} />
                    <Route path="dashboard" element={<LazyRoute component={HardwareDashboardPage} featureName="Hardware Dashboard" requiredPageAccess="hardware_requests" />} />
                    <Route path="calendar" element={<LazyRoute component={InstallationCalendarPage} featureName="Installation Calendar" requiredPageAccess="hardware_requests" />} />
                    <Route path="catalog" element={<LazyRoute component={CatalogAdminPage} featureName="Catalog Admin" requiredPageAccess="hardware_requests" />} />
                </Route>
                <Route path="hardware-requests/new" element={<LazyRoute component={HardwareRequestCreatePage} featureName="New Hardware Request" requiredPageAccess="hardware_requests" />} />
                <Route path="hardware-requests/:id" element={<LazyRoute component={HardwareRequestDetailPage} featureName="Hardware Request Detail" requiredPageAccess="hardware_requests" />} />
                <Route path="eform-access" element={<LazyRoute component={EformAccessListPage} featureName="E-Form Access" requiredPageAccess="eform_access" />} />
                <Route path="eform-access/new" element={<LazyRoute component={EformAccessCreatePage} featureName="New E-Form Access" requiredPageAccess="eform_access" />} />
                <Route path="eform-access/:id" element={<LazyRoute component={EformAccessDetailPage} featureName="E-Form Access Detail" requiredPageAccess="eform_access" />} />
                <Route path="eform-access/:id/approve" element={<LazyRoute component={EformApprovalPage} featureName="E-Form Approval" requiredPageAccess="eform_access" />} />
                <Route path="eform-access/:id/credentials" element={<LazyRoute component={EformCredentialPage} featureName="E-Form Credentials" requiredPageAccess="eform_access" />} />
                <Route path="lost-items" element={<LazyRoute component={LostItemListPage} featureName="Lost Items" requiredPageAccess="lost_items" />} />
                <Route path="lost-items/:id" element={<LazyRoute component={LostItemDetailPage} featureName="Lost Items Detail" requiredPageAccess="lost_items" />} />
                <Route path="lost-items/my" element={<LazyRoute component={MyLostReportsPage} featureName="My Lost Reports" requiredPageAccess="lost_items" />} />
                <Route path="found" element={<LazyRoute component={ReportFoundItemPage} featureName="Report Found Item" requiredPageAccess="lost_items" />} />

                {/* Admin-only Feature Pages */}
                <Route path="workloads" element={<LazyRoute component={AdminWorkloadDashboard} featureName="Agent Workloads" allowedRoles={['ADMIN']} />} />
                <Route path="audit-logs" element={<LazyRoute component={AuditLogPage} featureName="Audit Logs" allowedRoles={['ADMIN']} />} />
                <Route path="system-health" element={<LazyRoute component={SystemHealthPage} featureName="System Health" allowedRoles={['ADMIN']} />} />

                {/* Zoom Booking Calendar */}
                <Route path="zoom-calendar" element={<LazyRoute component={ZoomCalendarPage} featureName="Zoom Calendar" requiredPageAccess="zoom_calendar" />} />
                <Route path="zoom-settings" element={<LazyRoute component={ZoomSettingsPage} featureName="Zoom Settings" allowedRoles={['ADMIN']} />} />

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
                <Route path="dashboard" element={<LazyRoute component={ManagerDashboard} featureName="Manager Dashboard" />} />
                <Route path="workloads" element={<LazyRoute component={AdminWorkloadDashboard} featureName="Admin Workload Dashboard" />} />
                <Route path="tickets" element={<LazyRoute component={ManagerTicketsPage} featureName="Manager Tickets" />} />
                <Route path="reports" element={<LazyRoute component={ManagerReportsPage} featureName="Manager Reports" requiredPageAccess="reports" />} />
                <Route path="kb" element={<LazyRoute component={BentoKnowledgeBasePage} featureName="Knowledge Base" requiredPageAccess="knowledge_base" />} />
                <Route path="kb/articles/:id" element={<LazyRoute component={BentoArticleDetailPage} featureName="Article Detail" requiredPageAccess="knowledge_base" />} />

                {/* Request Center */}
                <Route path="hardware-requests" element={<LazyRoute component={HardwareRequestsLayout} featureName="Hardware Requests" requiredPageAccess="hardware_requests" />}>
                    <Route index element={<LazyRoute component={HardwareRequestListPage} featureName="Hardware Requests" requiredPageAccess="hardware_requests" />} />
                    <Route path="dashboard" element={<LazyRoute component={HardwareDashboardPage} featureName="Hardware Dashboard" requiredPageAccess="hardware_requests" />} />
                    <Route path="calendar" element={<LazyRoute component={InstallationCalendarPage} featureName="Installation Calendar" requiredPageAccess="hardware_requests" />} />
                    <Route path="catalog" element={<LazyRoute component={CatalogAdminPage} featureName="Catalog Admin" requiredPageAccess="hardware_requests" />} />
                </Route>
                <Route path="hardware-requests/new" element={<LazyRoute component={HardwareRequestCreatePage} featureName="New Hardware Request" requiredPageAccess="hardware_requests" />} />
                <Route path="hardware-requests/:id" element={<LazyRoute component={HardwareRequestDetailPage} featureName="Hardware Request Detail" requiredPageAccess="hardware_requests" />} />
                <Route path="eform-access" element={<LazyRoute component={EformAccessListPage} featureName="E-Form Access" requiredPageAccess="eform_access" />} />
                <Route path="eform-access/new" element={<LazyRoute component={EformAccessCreatePage} featureName="New E-Form Access" requiredPageAccess="eform_access" />} />
                <Route path="eform-access/:id" element={<LazyRoute component={EformAccessDetailPage} featureName="E-Form Access Detail" requiredPageAccess="eform_access" />} />
                <Route path="eform-access/:id/approve" element={<LazyRoute component={EformApprovalPage} featureName="E-Form Approval" requiredPageAccess="eform_access" />} />
                <Route path="eform-access/:id/credentials" element={<LazyRoute component={EformCredentialPage} featureName="E-Form Credentials" requiredPageAccess="eform_access" />} />
                <Route path="lost-items" element={<LazyRoute component={LostItemListPage} featureName="Lost Items" requiredPageAccess="lost_items" />} />
                <Route path="lost-items/:id" element={<LazyRoute component={LostItemDetailPage} featureName="Lost Items Detail" requiredPageAccess="lost_items" />} />
                <Route path="lost-items/my" element={<LazyRoute component={MyLostReportsPage} featureName="My Lost Reports" requiredPageAccess="lost_items" />} />
                <Route path="found" element={<LazyRoute component={ReportFoundItemPage} featureName="Report Found Item" requiredPageAccess="lost_items" />} />
                <Route path="lost-items/claims" element={<LazyRoute component={FoundClaimsQueuePage} featureName="Found Claims Queue" requiredPageAccess="lost_items" />} />

                <Route path="zoom-calendar" element={<LazyRoute component={ZoomCalendarPage} featureName="Zoom Calendar" requiredPageAccess="zoom_calendar" />} />
                <Route path="renewal" element={<LazyRoute component={RenewalHubPage} featureName="Renewal Hub" requiredPageAccess="renewal" />} />
            </Route>

            {/* Client Routes - Lazy loaded portal */}
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
                <Route path="my-tickets" element={<LazyRoute component={BentoMyTicketsPage} featureName="My Tickets" />} />
                <Route path="create" element={<LazyRoute component={BentoCreateTicketPage} featureName="Create Ticket" />} />
                <Route path="tickets/:id" element={<LazyRoute component={ClientTicketDetailPage} featureName="Ticket Detail" />} />
                <Route path="notifications" element={<LazyRoute component={ClientNotificationCenter} featureName="Notifications" requiredPageAccess="notifications" />} />
                <Route path="zoom-calendar" element={<LazyRoute component={ClientZoomBookingPage} featureName="Zoom Calendar" requiredPageAccess="zoom_calendar" />} />
                <Route path="kb" element={<LazyRoute component={ClientKnowledgeBasePage} featureName="Knowledge Base" requiredPageAccess="knowledge_base" />} />
                <Route path="kb/articles/:id" element={<LazyRoute component={ClientArticleDetailPage} featureName="Article Detail" requiredPageAccess="knowledge_base" />} />

                {/* Request Center */}
                <Route path="hardware-requests" element={<LazyRoute component={HardwareRequestsLayout} featureName="Hardware Requests" requiredPageAccess="hardware_requests" />}>
                    <Route index element={<LazyRoute component={HardwareRequestListPage} featureName="Hardware Requests" requiredPageAccess="hardware_requests" />} />
                    <Route path="dashboard" element={<LazyRoute component={HardwareDashboardPage} featureName="Hardware Dashboard" requiredPageAccess="hardware_requests" />} />
                    <Route path="calendar" element={<LazyRoute component={InstallationCalendarPage} featureName="Installation Calendar" requiredPageAccess="hardware_requests" />} />
                    <Route path="catalog" element={<LazyRoute component={CatalogAdminPage} featureName="Catalog Admin" requiredPageAccess="hardware_requests" />} />
                </Route>
                <Route path="hardware-requests/new" element={<LazyRoute component={HardwareRequestCreatePage} featureName="New Hardware Request" requiredPageAccess="hardware_requests" />} />
                <Route path="hardware-requests/:id" element={<LazyRoute component={HardwareRequestDetailPage} featureName="Hardware Request Detail" requiredPageAccess="hardware_requests" />} />

                <Route path="eform-access" element={<LazyRoute component={EformAccessListPage} featureName="E-Form Access" requiredPageAccess="eform_access" />} />
                <Route path="eform-access/new" element={<LazyRoute component={EformAccessCreatePage} featureName="New E-Form Access" requiredPageAccess="eform_access" />} />
                <Route path="eform-access/:id" element={<LazyRoute component={EformAccessDetailPage} featureName="E-Form Access Detail" requiredPageAccess="eform_access" />} />
                <Route path="eform-access/:id/approve" element={<LazyRoute component={EformApprovalPage} featureName="E-Form Approval" requiredPageAccess="eform_access" />} />
                <Route path="eform-access/:id/credentials" element={<LazyRoute component={EformCredentialPage} featureName="E-Form Credentials" requiredPageAccess="eform_access" />} />
                <Route path="lost-items" element={<LazyRoute component={LostItemListPage} featureName="Lost Items" requiredPageAccess="lost_items" />} />
                <Route path="lost-items/:id" element={<LazyRoute component={LostItemDetailPage} featureName="Lost Items Detail" requiredPageAccess="lost_items" />} />
                <Route path="lost-items/my" element={<LazyRoute component={MyLostReportsPage} featureName="My Lost Reports" requiredPageAccess="lost_items" />} />
                <Route path="found" element={<LazyRoute component={ReportFoundItemPage} featureName="Report Found Item" requiredPageAccess="lost_items" />} />

                <Route path="profile" element={<LazyRoute component={ClientProfilePage} featureName="Profile" />} />
                <Route index element={<Navigate to="/client/my-tickets" replace />} />
            </Route>

            {/* Fallback - role-aware redirect to correct portal */}
            <Route path="*" element={<RoleBasedRedirect />} />
        </Routes>
    );
}