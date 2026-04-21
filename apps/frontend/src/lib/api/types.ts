/**
 * API Types
 * Type definitions for API requests and responses
 */

// ========================================
// Common Types
// ========================================

export interface PaginatedResponse<T> {
    data: T[];
    meta: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    };
}

export interface ApiError {
    statusCode: number;
    message: string | string[];
    errorCode?: string;
    error?: string;
}

// ========================================
// User Types
// ========================================

export type UserRole = 'USER' | 'AGENT' | 'ADMIN';

export interface User {
    id: string;
    email: string;
    fullName: string;
    role: UserRole;
    department?: string;
    phone?: string;
    telegramChatId?: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface CreateUserDto {
    email: string;
    fullName: string;
    password: string;
    role: UserRole;
    department?: string;
    phone?: string;
}

export interface UpdateUserDto {
    fullName?: string;
    department?: string;
    phone?: string;
    isActive?: boolean;
}

// ========================================
// Ticket Types
// ========================================

export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'PENDING' | 'RESOLVED' | 'CLOSED';
export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type TicketCategory = 'HARDWARE' | 'SOFTWARE' | 'NETWORK' | 'EMAIL' | 'ACCESS' | 'GENERAL' | 'Hardware Request' | 'Hardware Installation';

export interface TicketMessage {
    id: string;
    content: string;
    senderId: string;
    sender?: {
        id: string;
        fullName: string;
        role: UserRole;
    };
    isSystemMessage: boolean;
    attachments?: string[];
    createdAt: string;
}

export interface Ticket {
    id: string;
    ticketNumber: string;
    subject: string;
    description: string;
    status: TicketStatus;
    priority: TicketPriority;
    category: TicketCategory;
    device?: string;
    software?: string;

    // Relationships
    requesterId: string;
    requester?: User;
    assignedToId?: string;
    assignedTo?: User;

    // SLA
    slaDeadline?: string;
    isOverdue?: boolean;
    responseTime?: number;
    resolutionTime?: number;

    // Messages
    messages?: TicketMessage[];

    // Timestamps
    createdAt: string;
    updatedAt: string;
    resolvedAt?: string;
    closedAt?: string;
}

export interface CreateTicketDto {
    subject: string;
    description: string;
    priority?: TicketPriority;
    category?: TicketCategory;
    device?: string;
    software?: string;
}

export interface UpdateTicketDto {
    subject?: string;
    description?: string;
    status?: TicketStatus;
    priority?: TicketPriority;
    category?: TicketCategory;
    assignedToId?: string;
}

export interface TicketListParams {
    page?: number;
    limit?: number;
    status?: TicketStatus | TicketStatus[];
    priority?: TicketPriority | TicketPriority[];
    category?: TicketCategory;
    excludeCategory?: TicketCategory | string;
    ticketType?: string;
    excludeType?: string;
    assignedToId?: string;
    requesterId?: string;
    search?: string;
    sortBy?: 'createdAt' | 'updatedAt' | 'priority' | 'status';
    sortOrder?: 'asc' | 'desc';
}

export interface SendMessageDto {
    content: string;
    attachments?: string[];
}

// ========================================
// Knowledge Base Types
// ========================================

export interface KBCategory {
    id: string;
    name: string;
    slug: string;
    description?: string;
    icon?: string;
    parentId?: string;
    articleCount?: number;
}

export interface KBArticle {
    id: string;
    title: string;
    slug: string;
    content: string;
    excerpt?: string;
    categoryId: string;
    category?: KBCategory;
    authorId: string;
    author?: User;
    isPublished: boolean;
    viewCount: number;
    helpfulCount: number;
    tags?: string[];
    createdAt: string;
    updatedAt: string;
}

export interface CreateArticleDto {
    title: string;
    content: string;
    categoryId: string;
    excerpt?: string;
    tags?: string[];
    isPublished?: boolean;
}

// ========================================
// Dashboard Types
// ========================================

export interface DashboardStats {
    totalTickets: number;
    openTickets: number;
    inProgressTickets: number;
    resolvedTickets: number;
    criticalTickets: number;
    overdueTickets: number;
    avgResponseTime: number;
    avgResolutionTime: number;
    slaComplianceRate: number;
}

export interface TicketsByStatus {
    status: TicketStatus;
    count: number;
}

export interface TicketsByPriority {
    priority: TicketPriority;
    count: number;
}

// ========================================
// Notification Types
// ========================================

export type NotificationType =
    | 'TICKET_ASSIGNED'
    | 'TICKET_UPDATED'
    | 'TICKET_MESSAGE'
    | 'SLA_WARNING'
    | 'SLA_BREACH'
    | 'MENTION';

export interface Notification {
    id: string;
    type: NotificationType;
    title: string;
    message: string;
    isRead: boolean;
    userId: string;
    ticketId?: string;
    createdAt: string;
}

// ========================================
// Auth Types
// ========================================

export interface LoginDto {
    email: string;
    password: string;
}

export interface LoginResponse {
    accessToken: string;
    user: User;
}

export interface RegisterDto {
    email: string;
    fullName: string;
    password: string;
    department?: string;
}
