export type RequestStatus =
    | 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED'
    | 'PROCUREMENT' | 'AWAITING_DELIVERY' | 'INSTALLATION' | 'COMPLETED'
    | 'REJECTED' | 'CANCELLED';

export const REQUEST_PIPELINE: RequestStatus[] = [
    'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'PROCUREMENT', 'AWAITING_DELIVERY', 'INSTALLATION', 'COMPLETED',
];

export type InstallStatus =
    | 'PROPOSED' | 'PROPOSED_AWAITING_USER' | 'CONFIRMED' | 'IN_PROGRESS' | 'DONE' | 'RESCHEDULED' | 'RESCHEDULE_REQUESTED' | 'CANCELLED';

export type HardwareRole = 'USER' | 'ICT_STAFF';
export type ItemCategory = 'LAPTOP' | 'DESKTOP' | 'MONITOR' | 'ACCESSORY' | 'NETWORK' | 'SOFTWARE' | 'OTHER';

export interface UserLite { id: string; fullName: string; email?: string; avatarUrl?: string | null; role?: HardwareRole; }
export interface SiteLite { id: string; name: string; }

export interface HardwareCatalog {
    id: string; code: string; name: string;
    category: ItemCategory;
    defaultSpecs?: Record<string, unknown>;
    requiredFields?: Record<string, { type: 'string'|'number'|'select'; label: string; options?: string[]; required?: boolean }>;
    active: boolean; displayOrder: number;
}

export type ItemDeliveryStatus = 'PENDING' | 'ARRIVED' | 'NOT_PROCURED';
export type ItemProcurementDecision = 'APPROVED' | 'REJECTED';

export interface HardwareRequestItem {
    id: string;
    requestId: string;
    catalogId?: string | null;
    categorySnapshot: { code: string; name: string; category: ItemCategory; [k: string]: unknown };
    quantity: number;
    name?: string;
    actualCost?: number | null;
    vendor?: string | null;
    invoiceNumber?: string | null;
    invoiceDate?: string | null;
    notes?: string | null;
    specs?: Record<string, unknown>;
    deliveryStatus?: ItemDeliveryStatus;
    arrivedAt?: string | null;
    procurementDecision?: ItemProcurementDecision | null;
    procurementDecidedAt?: string | null;
    procurementDecidedBy?: string | null;
}

export interface SlotProposal {
    start: string;
    end: string;
}

export interface InstallationSchedule {
    id: string; requestId: string; technicianId: string; technician?: UserLite;
    scheduledStart?: string | null; scheduledEnd?: string | null;
    status: InstallStatus;
    proposedSlots?: SlotProposal[] | null;
    selectedSlotAt?: string | null;
    rescheduleCount: number;
    rescheduleReason?: string | null;
    proposedBy: string; confirmedBy: string | null;
    locationDetail: string | null;
    startedAt: string | null; completedAt: string | null;
    items?: InstallationScheduleItem[];
}

export interface InstallationScheduleItem {
    id: string;
    scheduleId: string;
    itemId: string;
}

export interface HardwareAsset {
    id: string; itemId: string; barcode: string;
    assignedToUserId: string; siteId: string;
    installedAt: string; installedBy: string;
}

export interface HardwareRequest {
    id: string; requestNumber: string;
    requesterId: string; requester?: UserLite;
    recipientId?: string | null; recipient?: UserLite | null;
    siteId: string; site?: SiteLite;
    justification: string;
    status: RequestStatus;
    submittedAt?: string | null; reviewedAt?: string | null; approvedAt?: string | null;
    procuredAt?: string | null; installedAt?: string | null; completedAt?: string | null;
    reviewedBy?: string | null; approvedBy?: string | null; procuredBy?: string | null;
    rejectReason?: string | null;
    version: number;
    items: HardwareRequestItem[];
    installationSchedule?: InstallationSchedule | null;
    schedules?: InstallationSchedule[];
    assets?: HardwareAsset[];
    createdAt: string; updatedAt: string;
}

export interface HardwareRequestActivity {
    id: string; requestId: string; actorId: string; actor?: UserLite;
    action: string; fromStatus?: RequestStatus | null; toStatus?: RequestStatus | null;
    metadata?: Record<string, unknown>;
    createdAt: string;
}

export interface HardwareRequestComment {
    id: string; requestId: string; authorId: string; author?: UserLite;
    body: string;
    attachments: Array<{ url: string; name: string; size: number; mimeType: string }>;
    createdAt: string; editedAt: string | null; deletedAt: string | null;
}

export interface ListFilters {
    status?: RequestStatus[]; category?: ItemCategory[];
    siteId?: string; requesterId?: string;
    scope?: 'my' | 'all'; search?: string;
    page?: number; pageSize?: number;
}

export interface ApiEnvelope<T> { success: boolean; data?: T; error?: string; meta?: { total: number; page: number; pageSize: number } }

export interface ProcurementDecisionInput {
    decisions: Array<{ itemId: string; decision: ItemProcurementDecision }>;
    note?: string;
}
export interface ProcurementCompleteInput { rejectReason?: string }
export interface ItemDeliveryInput { status: 'ARRIVED' | 'PENDING' }
export interface ScheduleProposeInput {
    itemIds: string[];
    technicianId: string;
    slots: SlotProposal[];
    note?: string;
}
export interface SelectSlotInput { slotIndex: number }
export interface RequestRescheduleInput { reason: string }
