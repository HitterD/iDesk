/**
 * Centralized Ticket Types for the ticket-board feature
 * Single source of truth - DO NOT duplicate these definitions elsewhere
 */

// ============ Base Types ============

export type TicketStatus = 'TODO' | 'IN_PROGRESS' | 'WAITING_VENDOR' | 'RESOLVED' | 'CANCELLED';
export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'HARDWARE_INSTALLATION';
export type TicketSource = 'WEB' | 'TELEGRAM' | 'EMAIL';

// ============ User Types ============

export interface TicketUser {
    id?: string;
    fullName: string;
    role?: string;
    email?: string;
    avatarUrl?: string;
    department?: {
        name: string;
    };
    telegramChatId?: string;
}

export interface AgentUser {
    id: string;
    fullName: string;
    avatarUrl?: string;
}

// ============ Message Types ============

export interface MessageAttachment {
    id: string;
    filename: string;
    url: string;
    type: string;
    size?: number;
}

export interface TicketMessage {
    id: string;
    content: string;
    createdAt: string;
    isSystemMessage: boolean;
    isInternal?: boolean;
    attachments: (string | MessageAttachment)[];
    sender?: {
        id?: string;
        fullName: string;
    };
}

// ============ Site Types ============

export interface TicketSite {
    id: string;
    code: string;
    name: string;
}

// ============ Attribute Types ============

export interface TicketAttribute {
    id: string;
    value: string;
    description?: string;
}

export interface TicketAttributes {
    categories: TicketAttribute[];
    devices: TicketAttribute[];
    software: TicketAttribute[];
    priorities: TicketAttribute[];
}

// ============ Main Ticket Types ============

/**
 * Ticket type for list views - includes all fields needed for table/kanban display
 */
export interface Ticket {
    id: string;
    ticketNumber?: string;
    title: string;
    description: string;
    category: string;
    status: TicketStatus;
    priority: TicketPriority;
    source: TicketSource;
    isOverdue: boolean;
    slaTarget?: string;
    scheduledDate?: string;
    isHardwareInstallation?: boolean;
    assignedTo?: AgentUser;
    createdAt: string;
    updatedAt: string;
    user: TicketUser;
    messages?: TicketMessage[];
    site?: TicketSite;
}

/**
 * Ticket type for detail view - includes additional fields for full display
 */
export interface TicketDetail extends Ticket {
    device?: string;
    // Hardware Installation fields
    scheduledTime?: string;
    hardwareType?: string;
    userAcknowledged?: boolean;
    // SLA fields
    slaStartedAt?: string;
    firstResponseAt?: string;
    firstResponseTarget?: string;
    isFirstResponseBreached?: boolean;
    resolvedAt?: string;
}

// ============ Pagination Types ============

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

export type PaginatedTickets = PaginatedResponse<Ticket>;

// ============ Filter Types ============

export interface TicketFilters {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
    status?: string;
    priority?: string;
    category?: string;
    search?: string;
    siteIds?: string[];
    assignedToMe?: boolean;
}

// ============ DTO Types ============

export interface CreateTicketDto {
    title: string;
    description: string;
    priority?: string;
    category?: string;
    device?: string;
    software?: string;
}

export interface UpdateTicketDto {
    status?: string;
    priority?: string;
    category?: string;
    assignedToId?: string;
    device?: string;
}

// ============ SLA Types ============

export interface SlaConfig {
    id: string;
    priority: string;
    resolutionTimeMinutes: number;
    firstResponseTimeMinutes?: number;
}

// ============ Component Prop Types ============

export interface TicketRowData extends Omit<Ticket, 'messages'> {
    messages?: TicketMessage[];
}
