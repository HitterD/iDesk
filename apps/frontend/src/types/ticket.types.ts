/**
 * Comprehensive type definitions for Ticket-related entities
 * Removes usage of 'any' types throughout the application
 */

export type TicketStatus = 'TODO' | 'IN_PROGRESS' | 'WAITING_VENDOR' | 'RESOLVED' | 'CANCELLED';
export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type TicketSource = 'WEB' | 'TELEGRAM' | 'EMAIL';
export type UserRole = 'ADMIN' | 'AGENT' | 'USER';

export interface Department {
    id: string;
    name: string;
    description?: string;
}

export interface User {
    id: string;
    email: string;
    fullName: string;
    role: UserRole;
    avatarUrl?: string;
    department?: Department;
    isActive?: boolean;
    createdAt?: string;
    updatedAt?: string;
}

export interface TicketAttachment {
    id: string;
    filename: string;
    originalName: string;
    mimeType: string;
    size: number;
    url: string;
    uploadedAt: string;
}

export interface TicketMessage {
    id: string;
    content: string;
    sender: User;
    isInternal: boolean;
    attachments?: TicketAttachment[];
    createdAt: string;
    updatedAt?: string;
}

export interface SlaConfig {
    id: string;
    priority: TicketPriority;
    responseTimeHours: number;
    resolutionTimeHours: number;
}

export interface Ticket {
    id: string;
    ticketNumber: string;
    title: string;
    description: string;
    status: TicketStatus;
    priority: TicketPriority;
    category?: string;
    source: TicketSource;
    device?: string;
    software?: string;
    isOverdue: boolean;
    slaTarget?: string;
    responseDeadline?: string;
    user: User;
    assignedTo?: User;
    messages?: TicketMessage[];
    attachments?: TicketAttachment[];
    createdAt: string;
    updatedAt: string;
    resolvedAt?: string;
    closedAt?: string;
}

export interface TicketStats {
    total: number;
    open: number;
    inProgress: number;
    waitingVendor: number;
    resolved: number;
    cancelled: number;
    overdue: number;
    critical: number;
    avgResolutionTime?: number;
    slaComplianceRate?: number;
}

export interface TicketFilter {
    status?: TicketStatus | TicketStatus[];
    priority?: TicketPriority | TicketPriority[];
    assignedTo?: string;
    category?: string;
    search?: string;
    isOverdue?: boolean;
    dateFrom?: string;
    dateTo?: string;
}

export interface PaginationParams {
    page: number;
    limit: number;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
}

export interface PaginatedResponse<T> {
    data: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

// API Response types
export interface ApiResponse<T> {
    success: boolean;
    data: T;
    message?: string;
}

export interface ApiErrorResponse {
    success: false;
    message: string;
    errors?: Record<string, string[]>;
    statusCode: number;
}

// Mutation payloads
export interface CreateTicketPayload {
    title: string;
    description: string;
    priority: TicketPriority;
    category?: string;
    source?: TicketSource;
    device?: string;
    software?: string;
}

export interface UpdateTicketPayload {
    status?: TicketStatus;
    priority?: TicketPriority;
    category?: string;
    device?: string;
    assigneeId?: string;
}

export interface ReplyMessagePayload {
    content: string;
    isInternal?: boolean;
    attachments?: File[];
}

export interface BulkUpdatePayload {
    ticketIds: string[];
    updates: UpdateTicketPayload;
}
