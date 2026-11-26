import { TicketType } from '../entities/ticket.entity';
import {
    clearTicketSlaColumns,
    findNonSlaTicketIds,
    isNonSlaTicket,
    isNonSlaTicketType,
    isSlaTicketSql,
    nonSlaTicketSql,
    stripSlaFields,
} from './non-sla-ticket.util';

describe('non-sla-ticket.util', () => {
    it('detects non-SLA tickets by ticketType, requestKind, or isNonSla flag', () => {
        expect(isNonSlaTicketType(null)).toBe(false);
        expect(isNonSlaTicketType({ ticketType: TicketType.SERVICE })).toBe(false);
        expect(isNonSlaTicketType({ ticketType: TicketType.HARDWARE_INSTALLATION })).toBe(false);
        expect(isNonSlaTicketType({ ticketType: TicketType.HARDWARE_REQUEST })).toBe(true);
        expect(isNonSlaTicketType({ ticketType: TicketType.EFORM_REQUEST })).toBe(true);
        expect(isNonSlaTicketType({ ticketType: TicketType.SERVICE, requestKind: 'EFORM' })).toBe(true);
        expect(isNonSlaTicketType({ ticketType: TicketType.SERVICE, isNonSla: true })).toBe(true);
    });

    it('checks request_flows when ticketType is SERVICE in isNonSlaTicket', async () => {
        const managerWithFlow = { query: jest.fn().mockResolvedValue([{ '?column?': 1 }]) };
        await expect(
            isNonSlaTicket(managerWithFlow as any, { id: 't-1', ticketType: TicketType.SERVICE }),
        ).resolves.toBe(true);
        expect(managerWithFlow.query).toHaveBeenCalledWith(
            expect.stringContaining('FROM request_flows'),
            ['t-1'],
        );

        const managerWithoutFlow = { query: jest.fn().mockResolvedValue([]) };
        await expect(
            isNonSlaTicket(managerWithoutFlow as any, { id: 't-2', ticketType: TicketType.SERVICE }),
        ).resolves.toBe(false);

        const skipDbForTyped = { query: jest.fn() };
        await expect(
            isNonSlaTicket(skipDbForTyped as any, { id: 't-3', ticketType: TicketType.HARDWARE_REQUEST }),
        ).resolves.toBe(true);
        expect(skipDbForTyped.query).not.toHaveBeenCalled();
    });

    it('batches remaining ticket ids to query request_flows in findNonSlaTicketIds', async () => {
        const manager = { query: jest.fn().mockResolvedValue([{ ticketId: 't-legacy' }]) };
        const ids = await findNonSlaTicketIds(manager as any, [
            { id: 't-hw', ticketType: TicketType.HARDWARE_REQUEST },
            { id: 't-legacy', ticketType: TicketType.SERVICE },
            { id: 't-regular', ticketType: TicketType.SERVICE },
        ]);
        expect(Array.from(ids).sort()).toEqual(['t-hw', 't-legacy']);
        expect(manager.query).toHaveBeenCalledWith(
            expect.stringContaining('FROM request_flows'),
            [['t-legacy', 't-regular']],
        );
    });

    it('strips and clears SLA columns cleanly', () => {
        const dirty: Record<string, unknown> = {
            id: 't-1',
            slaTarget: new Date(),
            originalSlaTarget: new Date(),
            slaStartedAt: new Date(),
            firstResponseTarget: new Date(),
            slaRemainingMinutes: 30,
            firstResponseRemainingMinutes: 15,
            isOverdue: true,
            isFirstResponseBreached: true,
            slaWarningSent: true,
        };
        const stripped = stripSlaFields(dirty);
        expect(stripped.slaTarget).toBeNull();
        expect(stripped.isOverdue).toBe(false);
        expect(dirty.isOverdue).toBe(true);

        clearTicketSlaColumns(dirty);
        expect(dirty.slaTarget).toBeNull();
        expect(dirty.slaRemainingMinutes).toBeNull();
        expect(dirty.isOverdue).toBe(false);
        expect(dirty.isFirstResponseBreached).toBe(false);
        expect(dirty.slaWarningSent).toBe(false);
    });

    it('produces complementary NULL-safe SQL predicates executable on SQLite', () => {
        const { DatabaseSync } = require('node:sqlite');
        const db = new DatabaseSync(':memory:');
        try {
            db.exec('CREATE TABLE ticket(id TEXT, "ticketType" TEXT)');
            db.exec('CREATE TABLE request_flows("ticketId" TEXT)');
            db.exec(`
                INSERT INTO ticket VALUES
                    ('svc', 'SERVICE'),
                    ('null_type', NULL),
                    ('hw_inst', 'HARDWARE_INSTALLATION'),
                    ('hw_req', 'HARDWARE_REQUEST'),
                    ('eform', 'EFORM_REQUEST'),
                    ('backfill', 'SERVICE');
                INSERT INTO request_flows VALUES ('backfill');
            `);

            const nonSlaRows = db
                .prepare(`SELECT id FROM ticket WHERE ${nonSlaTicketSql('ticket')} ORDER BY id`)
                .all()
                .map((r: { id: string }) => r.id);
            const slaRows = db
                .prepare(`SELECT id FROM ticket WHERE ${isSlaTicketSql('ticket')} ORDER BY id`)
                .all()
                .map((r: { id: string }) => r.id);

            expect(nonSlaRows).toEqual(['backfill', 'eform', 'hw_req']);
            expect(slaRows).toEqual(['hw_inst', 'null_type', 'svc']);
        } finally {
            db.close();
        }
    });
});
