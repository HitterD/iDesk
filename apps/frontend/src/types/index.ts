export * from './ticket.types';

// Re-export common types
export type { User, Department, UserRole } from './ticket.types';

// Notification types
export type NotificationType = 
    | 'TICKET_CREATED'
    | 'TICKET_ASSIGNED'
    | 'TICKET_UPDATED'
    | 'TICKET_RESOLVED'
    | 'TICKET_COMMENT'
    | 'CONTRACT_EXPIRING'
    | 'CONTRACT_RENEWED'
    | 'SURVEY_RECEIVED'
    | 'SYSTEM';

export interface Notification {
    id: string;
    type: NotificationType;
    title: string;
    message: string;
    data?: {
        ticketId?: string;
        contractId?: string;
        surveyId?: string;
        link?: string;
        [key: string]: unknown;
    };
    read: boolean;
    createdAt: string;
}

// Auth types
export interface AuthUser {
    id: string;
    email: string;
    fullName: string;
    role: 'ADMIN' | 'AGENT' | 'USER';
    avatarUrl?: string;
    department?: {
        id: string;
        name: string;
    };
}

export interface LoginCredentials {
    email: string;
    password: string;
}

export interface AuthResponse {
    access_token: string;
    user: AuthUser;
}

// Report types
export interface ReportStats {
    totalTickets: number;
    resolvedTickets: number;
    avgResolutionTime: number;
    slaComplianceRate: number;
    byStatus: Record<string, number>;
    byPriority: Record<string, number>;
    byCategory: Record<string, number>;
    byAgent: Array<{
        agentId: string;
        agentName: string;
        resolved: number;
        avgTime: number;
    }>;
}

// Contract/Renewal types
export type ContractStatus = 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED' | 'RENEWED' | 'CANCELLED';

export interface Contract {
    id: string;
    contractNumber: string;
    companyName: string;
    startDate: string;
    endDate: string;
    value?: number;
    status: ContractStatus;
    filePath?: string;
    fileName?: string;
    acknowledgedBy?: string;
    acknowledgedAt?: string;
    createdAt: string;
    updatedAt: string;
}

// Article/Knowledge Base types
export interface Article {
    id: string;
    title: string;
    content: string;
    category: string;
    tags?: string[];
    isPublished: boolean;
    viewCount: number;
    author: {
        id: string;
        fullName: string;
    };
    createdAt: string;
    updatedAt: string;
}

// Socket event types
export interface SocketTicketUpdate {
    ticketId: string;
    type: 'created' | 'updated' | 'deleted' | 'message';
    data: Partial<import('./ticket.types').Ticket>;
}

export interface SocketPresenceUpdate {
    userId: string;
    status: 'online' | 'offline' | 'away';
    lastSeen?: string;
}
