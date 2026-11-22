import { TicketType } from '../../ticketing/entities/ticket.entity';

export type RequestKind = 'HARDWARE' | 'EFORM';
export type HardwareSource = 'ANNUAL_BUDGET' | 'NON_BUDGET' | 'IT_STOCK';

const ticketTypesByKind: Record<RequestKind, TicketType> = {
    HARDWARE: TicketType.HARDWARE_REQUEST,
    EFORM: TicketType.EFORM_REQUEST,
};

export function kindOfTicketType(ticketType: TicketType): RequestKind | null {
    if (ticketType === ticketTypesByKind.HARDWARE) return 'HARDWARE';
    if (ticketType === ticketTypesByKind.EFORM) return 'EFORM';
    return null;
}

export function ticketTypeOf(kind: RequestKind): TicketType {
    return ticketTypesByKind[kind];
}
