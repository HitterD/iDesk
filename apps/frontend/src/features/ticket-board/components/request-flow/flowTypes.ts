import type { RequestKind } from './requestKind';

/** Mirrors the backend read model (GET /request-flow/:ticketId): what the request ticket page renders from. */
export type FlowPhase =
    | 'review' | 'appr_mgr' | 'appr_gm' | 'procure' | 'delivery' | 'schedule' | 'install' | 'fulfill' | 'confirm' | 'done' | 'rejected';
export type ApprovalRoute = 'NONE' | 'MANAGER' | 'MANAGER_GM';
export type HardwareSource = 'ANNUAL_BUDGET' | 'NON_BUDGET' | 'IT_STOCK';
export type ViewerRoleInFlow = 'REQUESTER' | 'APPROVER_CURRENT' | 'APPROVER' | 'ICT' | 'OBSERVER';

export interface FlowItem {
    id: string; name: string; quantity: number; note: string | null; recipient: string;
    deliveryStatus: string; procurementDecision: string | null;
    vendor: string | null; actualCost: string | null; invoiceNumber: string | null; invoiceDate: string | null;
}

export interface FlowSchedule {
    slots: { start: string; end: string }[];
    /** Index into `slots` the requester chose; null while none is chosen. */
    chosen: number | null;
    technicianName: string | null;
    status: string;
    resched: number;
    note: string | null;
}

export interface FlowRevision { version: number; kind: 'GEN' | 'DIG' | 'IMP' | 'FIN'; label: string; actorName: string; createdAt: string }

export interface RequestFlowView {
    kind: RequestKind;
    phase: FlowPhase;
    phaseLabel: string;
    route: ApprovalRoute | null;
    managerId: string | null;
    gmId: string | null;
    hardwareSource: HardwareSource | null;
    returnedReason: string | null;
    rescheduleCount: number;
    documentVersion: number;
    revisions: FlowRevision[];
    viewerRoleInFlow: ViewerRoleInFlow;
    hardware?: {
        requestNumber: string; division: string; recipients: string[]; items: FlowItem[];
        schedule: FlowSchedule | null; assets: { code: string; itemId: string }[];
    };
    eform?: {
        formType: string; documentNumber: string; startDate: string; endDate: string | null;
        fields: Record<string, string>; hasCredentials: boolean; requiresGm: boolean;
    };
}

/** A requester can ask for another install time at most this many times. */
export const RESCHEDULE_LIMIT = 3;
