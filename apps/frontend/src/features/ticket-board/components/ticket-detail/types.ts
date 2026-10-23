import type { AttachmentInfo } from './attachmentKind';
import type { TicketSystemEvent } from './ActivityEvent';

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
    /** WEB, EMAIL or IPOP (filed through the iPop integration). */
    source?: string;
    criticalReason?: string;
    createdAt: string;
    updatedAt: string;
    slaTarget?: string;
    /** 'requester' = I filed it but don't handle it: view/chat only. */
    viewerAccess?: 'handler' | 'requester';
    slaStartedAt?: string;
    /** Business minutes left while the SLA clock is held (waiting vendor, resolved). */
    slaRemainingMinutes?: number | null;
    lastPausedAt?: string | null;
    /** Agreed vendor visit while WAITING_VENDOR. */
    vendorVisitAt?: string | null;
    firstResponseRemainingMinutes?: number | null;
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
    /** Requester confirmation window while status is RESOLVED; auto-closes after this. */
    resolutionDeadlineAt?: string | null;
    closedAt?: string | null;
    disputedAt?: string | null;
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
        /** Structured activity (who changed what); absent on older system messages. */
        systemEvent?: TicketSystemEvent | null;
        isInternal?: boolean;
        attachments: string[];
        attachmentInfo?: AttachmentInfo[] | null;
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

