export interface TicketParticipant {
    id: string;
    ticketId: string;
    userId: string;
    role: string;
    joinedAt: string;
    user?: {
        id: string;
        fullName: string;
        email: string;
        avatarUrl?: string | null;
        department?: {
            name: string;
        };
    };
    invitedBy?: {
        id: string;
        fullName: string;
    } | null;
}

export interface TicketDetail {
    id: string;
    ticketNumber?: string;
    title: string;
    description: string;
    status: string;
    priority: string;
    category: string;
    ticketType?: string;
    handlingTeam?: 'OPS_SUPPORT' | 'ORACLE_DEV' | 'MOBILE_DEV' | 'WEB_DEV' | string;
    device?: string;
    criticalReason?: string;
    createdAt: string;
    updatedAt: string;
    slaTarget?: string;
    slaStartedAt?: string;
    firstResponseAt?: string;
    firstResponseTarget?: string;
    isFirstResponseBreached?: boolean;
    targetResolutionDate?: string;
    // Hardware Installation fields
    isHardwareInstallation?: boolean;
    scheduledDate?: string;
    scheduledTime?: string;
    hardwareType?: string;
    userAcknowledged?: boolean;
    user: {
        /** Present in the findOne payload via the `user` relation; drives the presence dot. */
        id?: string;
        fullName: string;
        email: string;
        avatarUrl?: string | null;
        department?: {
            name: string;
        };
        site?: {
            name: string;
            code?: string;
        };
        telegramChatId?: string;
    };
    assignedTo?: {
        id: string;
        fullName: string;
        email?: string;
        site?: { name?: string; code?: string };
    };
    messages?: {
        id: string;
        content: string;
        createdAt: string;
        isSystemMessage: boolean;
        isInternal?: boolean;
        attachments: string[];
        sender?: {
            id?: string;
            fullName: string;
            role?: string;
            avatarUrl?: string | null;
        };
    }[];
    participants?: TicketParticipant[];
    isParticipant?: boolean;
    slaAdjustments?: SlaAdjustment[];
}

export type SlaAdjustmentReasonCategory =
    | 'WAITING_USER'
    | 'WAITING_VENDOR'
    | 'WAITING_APPROVAL'
    | 'TECHNICAL_COMPLEXITY'
    | 'EXTERNAL_DEPENDENCY'
    | 'OTHER';

export interface SlaAdjustment {
    id: string;
    ticketId: string;
    type: 'EXTEND';
    minutes: number;
    reasonCategory: SlaAdjustmentReasonCategory;
    reasonText: string;
    previousTarget: string | null;
    newTarget: string | null;
    actorId: string | null;
    actor?: {
        id: string;
        fullName: string;
        email?: string;
        avatarUrl?: string | null;
    };
    approvedById?: string | null;
    createdAt: string;
}

export interface Agent {
    id: string;
    fullName: string;
    email: string;
    role: string;
    avatarUrl?: string;
    site?: {
        name?: string;
        code?: string;
    };
}

