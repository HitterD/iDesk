import { EFormType } from '../../eform-request/entities/eform-request.entity';
import { TicketType } from '../../ticketing/entities/ticket.entity';
import { canChangeRoute, defaultRoute } from './approval-route';
import { kindOfTicketType, ticketTypeOf, type RequestKind } from './request-kind';

describe('approval route', () => {
    it.each([
        [EFormType.VPN, 'MANAGER_GM'],
        [EFormType.SYNOLOGY_NAS, 'NONE'],
        [EFormType.WEBSITE, 'MANAGER'],
        [undefined, 'MANAGER'],
    ])('defaults E-Form %s to %s', (type, route) => {
        expect(defaultRoute('EFORM', type)).toBe(route);
    });

    it('defaults hardware to manager approval', () => {
        expect(defaultRoute('HARDWARE')).toBe('MANAGER');
    });

    it('cannot remove approval after the manager signs', () => {
        expect(canChangeRoute('MANAGER', 'NONE', { manager: true, gm: false })).toBe(false);
    });

    it('can add GM approval after the manager signs', () => {
        expect(canChangeRoute('MANAGER', 'MANAGER_GM', { manager: true, gm: false })).toBe(true);
    });

    it('can remove GM approval before anyone signs', () => {
        expect(canChangeRoute('MANAGER_GM', 'MANAGER', { manager: false, gm: false })).toBe(true);
    });

    it('cannot remove GM approval after the GM signs', () => {
        expect(canChangeRoute('MANAGER_GM', 'MANAGER', { manager: false, gm: true })).toBe(false);
    });
});

describe('request kind', () => {
    it.each<[RequestKind, string]>([
        ['HARDWARE', 'HARDWARE_REQUEST'],
        ['EFORM', 'EFORM_REQUEST'],
    ])('maps %s to the persisted ticket type %s and back', (kind, value) => {
        const ticketType = ticketTypeOf(kind);
        expect(ticketType).toBe(value);
        expect(kindOfTicketType(ticketType)).toBe(kind);
    });

    it.each([TicketType.SERVICE, TicketType.HARDWARE_INSTALLATION])('does not map legacy ticket type %s', (type) => {
        expect(kindOfTicketType(type)).toBeNull();
    });
});
