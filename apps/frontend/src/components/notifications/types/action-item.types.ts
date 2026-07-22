export type ActionItemUrgency = 'CRITICAL' | 'HIGH' | 'NORMAL';
export type ActionItemEntityType = 'TICKET' | 'HARDWARE_REQUEST' | 'EFORM' | 'RENEWAL';
export type SnoozeDuration = '30m' | '2h' | 'tomorrow';

export interface ActionItem {
    id: string;
    entityType: ActionItemEntityType;
    title: string;
    description: string;
    urgency: ActionItemUrgency;
    entityId: string;
    link: string;
    createdAt: string;
    isSnoozed?: boolean;
    snoozeUntil?: string | null;
}

export interface ActionItemsResponse {
    items: ActionItem[];
    counts: {
        critical: number;
        high: number;
        normal: number;
        total: number;
    };
}
