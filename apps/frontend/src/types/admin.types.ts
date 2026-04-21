/**
 * Centralized admin type definitions
 * Import these types instead of redefining them in each component
 */

// ============================================
// Site Types
// ============================================

export interface Site {
    id: string;
    code: string;
    name: string;
    description?: string;
    isActive?: boolean;
}

// ============================================
// User Types
// ============================================

export type UserRole = 'ADMIN' | 'AGENT' | 'USER' | 'MANAGER' | 'AGENT_ORACLE' | 'AGENT_ADMIN' | 'AGENT_OPERATIONAL_SUPPORT';

export interface User {
    id: string;
    fullName: string;
    email: string;
    role: UserRole;
    department?: { id: string; name: string; code?: string };
    site?: Site;
    siteId?: string;
    createdAt: string;
    updatedAt?: string;
    isActive?: boolean;
    employeeId?: string;
    jobTitle?: string;
    phoneNumber?: string;
    avatarUrl?: string;
    lastLoginAt?: string;
    appliedPresetId?: string | null;
    appliedPresetName?: string | null;
}

export interface AgentStats {
    id: string;
    fullName: string;
    email: string;
    role: string;
    avatarUrl?: string;
    department?: string;
    site?: Site;
    openTickets: number;
    inProgressTickets: number;
    resolvedThisWeek: number;
    resolvedThisMonth: number;
    resolvedTotal: number;
    slaCompliance: number;
    appraisalPoints?: number;
    activeWorkloadPoints?: number;
}

// ============================================
// Pagination Types
// ============================================

export interface PaginationMeta {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
}

export interface PaginatedResponse<T> {
    data: T[];
    meta: PaginationMeta;
}

// ============================================
// Audit Types
// ============================================

export type AuditAction =
    | 'CREATE_TICKET'
    | 'UPDATE_TICKET'
    | 'ASSIGN_TICKET'
    | 'RESOLVE_TICKET'
    | 'CANCEL_TICKET'
    | 'REOPEN_TICKET'
    | 'ADD_MESSAGE'
    | 'CREATE_USER'
    | 'UPDATE_USER'
    | 'DELETE_USER'
    | 'LOGIN'
    | 'LOGOUT'
    | 'CREATE_ARTICLE'
    | 'UPDATE_ARTICLE'
    | 'DELETE_ARTICLE'
    | 'CREATE_SLA'
    | 'UPDATE_SLA'
    | 'DELETE_SLA'
    | 'CREATE_AUTOMATION'
    | 'UPDATE_AUTOMATION'
    | 'DELETE_AUTOMATION'
    | 'IMPORT_USERS'
    | 'EXPORT_USERS'
    | 'BULK_DELETE_USERS'
    | 'UPDATE_ROLE';

export type AuditEntityType =
    | 'TICKET'
    | 'USER'
    | 'ARTICLE'
    | 'SLA_CONFIG'
    | 'AUTOMATION_RULE'
    | 'SYSTEM';

export interface AuditLog {
    id: string;
    action: AuditAction;
    entityType: AuditEntityType;
    entityId?: string;
    userId?: string;
    user?: Pick<User, 'id' | 'fullName' | 'email'>;
    description?: string;
    oldValue?: Record<string, any>;
    newValue?: Record<string, any>;
    ipAddress?: string;
    createdAt: string;
}

// ============================================
// Health Status Types
// ============================================

export interface HealthStatus {
    status: 'ok' | 'error';
    timestamp: string;
    uptime: number;
    database: 'connected' | 'disconnected';
    version: string;
}

export interface ServiceHealth {
    name: string;
    status: 'healthy' | 'unhealthy' | 'unknown';
    lastCheck?: string;
}

// ============================================
// Role Configuration Types
// ============================================

export interface RoleConfig {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    color: string;
    bgColor: string;
    badgeColor: string;
}

// ============================================
// Export Queue Types
// ============================================

export interface ExportJob {
    id: string;
    type: 'users' | 'tickets' | 'reports';
    format: 'csv' | 'xlsx' | 'pdf';
    status: 'pending' | 'processing' | 'completed' | 'failed';
    progress: number;
    filename?: string;
    downloadUrl?: string;
    createdAt: string;
    completedAt?: string;
    error?: string;
}

// ============================================
// Form Types
// ============================================

export interface UserFormData {
    fullName: string;
    email: string;
    role: UserRole;
    siteId?: string;
    departmentId?: string;
    employeeId?: string;
    jobTitle?: string;
    phoneNumber?: string;
    password?: string;
}

export interface BulkImportResult {
    total: number;
    success: number;
    failed: number;
    errors: Array<{ row: number; error: string }>;
}
