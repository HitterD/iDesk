import { QueryRunner } from 'typeorm';
import { ClearSlaOnHardwareAndEformTickets1794890000000 } from './1794890000000-ClearSlaOnHardwareAndEformTickets';

describe('ClearSlaOnHardwareAndEformTickets migration', () => {
    it('nulls SLA fields and resets breach flags only on non-SLA tickets with dirty SLA state', async () => {
        const queries: string[] = [];
        const query = jest.fn(async (sql: string) => {
            queries.push(sql);
            return [];
        });

        await new ClearSlaOnHardwareAndEformTickets1794890000000().up({ query } as unknown as QueryRunner);

        expect(query).toHaveBeenCalledTimes(1);
        const sql = queries[0];
        expect(sql).toContain('UPDATE "tickets"');
        expect(sql).toContain('"slaTarget" = NULL');
        expect(sql).toContain('"originalSlaTarget" = NULL');
        expect(sql).toContain('"slaStartedAt" = NULL');
        expect(sql).toContain('"firstResponseTarget" = NULL');
        expect(sql).toContain('"slaRemainingMinutes" = NULL');
        expect(sql).toContain('"firstResponseRemainingMinutes" = NULL');
        expect(sql).toContain('"isOverdue" = false');
        expect(sql).toContain('"isFirstResponseBreached" = false');
        expect(sql).toContain('"slaWarningSent" = false');
        expect(sql).toContain("IN ('HARDWARE_REQUEST', 'EFORM_REQUEST')");
        expect(sql).toContain('FROM "request_flows" rf');
        // Idempotent guard: avoids touching already clean rows on re-run
        expect(sql).toContain('"slaTarget" IS NOT NULL');
        expect(sql).toContain('"isOverdue" = true');
        // Never deletes audit trails
        expect(sql).not.toContain('sla_adjustments');
        expect(sql).not.toContain('notifications');
        expect(sql).not.toContain('ticket_messages');
    });

    it('provides a safe no-op down() that does not execute destructive writes', async () => {
        const query = jest.fn();
        await expect(
            new ClearSlaOnHardwareAndEformTickets1794890000000().down({ query } as unknown as QueryRunner),
        ).resolves.toBeUndefined();
        expect(query).not.toHaveBeenCalled();
    });
});
