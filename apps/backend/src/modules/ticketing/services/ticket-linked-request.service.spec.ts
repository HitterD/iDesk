import { Ticket, TicketStatus } from '../entities/ticket.entity';
import { TicketLinkedRequestService } from './ticket-linked-request.service';

const DEADLINE = new Date('2026-11-24T10:00:00Z');

function setup(ticket: Partial<Ticket>, running = '0', proposals = '0') {
    const row: any = { id: 't-1', siteId: 'site-1', assignedToId: 'agent-1', ...ticket };
    const manager = {
        findOne: jest.fn(async (entity: unknown) => (entity === Ticket ? row : null)),
        save: jest.fn(async (_e: unknown, v: any) => ({ id: 'msg-1', ...v })),
        create: jest.fn((_e: unknown, v: unknown) => v),
        query: jest.fn(async () => [{ running, proposals }]),
    };
    const dataSource = { transaction: jest.fn(async (cb: (m: unknown) => unknown) => cb(manager)) };
    const slaClock: Record<string, jest.Mock> = { hold: jest.fn(async () => undefined), release: jest.fn(async () => false) };
    const vendorVisit = { clear: jest.fn(async () => undefined) };
    const gateway = { notifyNewMessage: jest.fn(), notifyTicketUpdate: jest.fn(), notifyTicketListUpdate: jest.fn(), notifyDashboardStatsUpdate: jest.fn() };
    const businessHours = { calculateSlaTarget: jest.fn(async () => DEADLINE) };
    const surveys = { createSurvey: jest.fn(async (..._args: unknown[]): Promise<unknown> => ({})) };
    slaClock.resumeOnOriginalTarget = jest.fn();
    const service = new TicketLinkedRequestService(
        dataSource as never, slaClock as never, vendorVisit as never, gateway as never, { recalculateAgentWorkload: jest.fn() } as never, businessHours as never,
        surveys as never,
    );
    const phase = (target: TicketStatus, extra: { reopenResolved?: true; silentUnlessMoved?: boolean } = {}) => ({
        ...extra, ticketId: 't-1', actorId: null, target, text: 'x', event: { hardwareRequest: { id: 'hr-1', number: 'HR-1', phase: 'INSTALLED' as const } },
    });
    return { service, row, slaClock, phase, businessHours, surveys };
}

describe('TicketLinkedRequestService RESOLVED target', () => {
    it('resolves the ticket, opens the confirmation window and holds the SLA', async () => {
        const { service, row, slaClock, phase } = setup({ status: TicketStatus.IN_PROGRESS });

        await expect(service.record(phase(TicketStatus.RESOLVED))).resolves.toBe(true);

        expect(row.status).toBe(TicketStatus.RESOLVED);
        expect(row.resolvedAt).toBeInstanceOf(Date);
        expect(row.resolutionDeadlineAt).toBe(DEADLINE);
        expect(row.disputedAt).toBeNull();
        expect(slaClock.hold).toHaveBeenCalled();
    });

    it('stays out while another request on the ticket still runs', async () => {
        const { service, row, phase } = setup({ status: TicketStatus.IN_PROGRESS }, '1');

        await expect(service.record(phase(TicketStatus.RESOLVED))).resolves.toBe(false);
        expect(row.status).toBe(TicketStatus.IN_PROGRESS);
    });

    it('does not reopen a closed ticket', async () => {
        const { service, row, phase } = setup({ status: TicketStatus.CLOSED });

        await expect(service.record(phase(TicketStatus.RESOLVED))).resolves.toBe(false);
        expect(row.status).toBe(TicketStatus.CLOSED);
    });

    it('RESOLVED + CLOSED target closes the ticket and clears the deadline', async () => {
        const { service, row, phase } = setup({ status: TicketStatus.RESOLVED, resolutionDeadlineAt: DEADLINE });

        await expect(service.record(phase(TicketStatus.CLOSED))).resolves.toBe(true);

        expect(row.status).toBe(TicketStatus.CLOSED);
        expect(row.closedAt).toBeInstanceOf(Date);
        expect(row.resolutionDeadlineAt).toBeNull();
    });

    it('RESOLVED + IN_PROGRESS with reopenResolved reopens the ticket like a dispute', async () => {
        const { service, row, slaClock, phase } = setup({ status: TicketStatus.RESOLVED, resolutionDeadlineAt: DEADLINE, resolvedAt: new Date() });

        await expect(service.record(phase(TicketStatus.IN_PROGRESS, { reopenResolved: true }))).resolves.toBe(true);

        expect(row.status).toBe(TicketStatus.IN_PROGRESS);
        expect(row.resolutionDeadlineAt).toBeNull();
        expect(row.resolvedAt).toBeNull();
        expect(row.disputedAt).toBeInstanceOf(Date);
        expect(slaClock.resumeOnOriginalTarget).toHaveBeenCalledWith(row, expect.any(Date));
    });

    it.each([TicketStatus.CLOSED, TicketStatus.CANCELLED])('%s stays terminal', async (status) => {
        const { service, row, phase } = setup({ status });
        await expect(service.record(phase(TicketStatus.IN_PROGRESS))).resolves.toBe(false);
        await expect(service.record(phase(TicketStatus.CLOSED))).resolves.toBe(false);
        expect(row.status).toBe(status);
    });

    it('a RESOLVED ticket does not go back to a vendor wait', async () => {
        const { service, row, phase } = setup({ status: TicketStatus.RESOLVED });
        await expect(service.record(phase(TicketStatus.WAITING_VENDOR))).resolves.toBe(false);
        expect(row.status).toBe(TicketStatus.RESOLVED);
    });

    it('WAITING_VENDOR still resumes to IN_PROGRESS and closes as before', async () => {
        const a = setup({ status: TicketStatus.WAITING_VENDOR, lastPausedAt: new Date() });
        await expect(a.service.record(a.phase(TicketStatus.IN_PROGRESS))).resolves.toBe(true);
        expect(a.row.status).toBe(TicketStatus.IN_PROGRESS);
        expect(a.slaClock.release).toHaveBeenCalled();
        const b = setup({ status: TicketStatus.IN_PROGRESS });
        await expect(b.service.record(b.phase(TicketStatus.CLOSED))).resolves.toBe(true);
        expect(b.row.status).toBe(TicketStatus.CLOSED);
    });

    it('creates one satisfaction survey when the ticket becomes RESOLVED', async () => {
        const { service, surveys, row, phase } = setup({ status: TicketStatus.IN_PROGRESS });
        await service.record(phase(TicketStatus.RESOLVED));
        expect(surveys.createSurvey).toHaveBeenCalledTimes(1);
        expect(surveys.createSurvey).toHaveBeenCalledWith(row);
    });

    it('creates no survey for other targets or when nothing moved', async () => {
        const a = setup({ status: TicketStatus.RESOLVED });
        await a.service.record(a.phase(TicketStatus.CLOSED));
        const b = setup({ status: TicketStatus.IN_PROGRESS });
        await b.service.record(b.phase(TicketStatus.WAITING_VENDOR));
        const c = setup({ status: TicketStatus.RESOLVED });
        await c.service.record(c.phase(TicketStatus.RESOLVED));
        expect(a.surveys.createSurvey).not.toHaveBeenCalled();
        expect(b.surveys.createSurvey).not.toHaveBeenCalled();
        expect(c.surveys.createSurvey).not.toHaveBeenCalled();
    });

    it('a failing survey never fails the step', async () => {
        const { service, surveys, phase } = setup({ status: TicketStatus.IN_PROGRESS });
        surveys.createSurvey.mockRejectedValueOnce(new Error('mail down'));
        await expect(service.record(phase(TicketStatus.RESOLVED))).resolves.toBe(true);
    });

    it('IN_PROGRESS without reopenResolved (rejected, cancelled, returned, a retried resume) leaves a RESOLVED ticket alone', async () => {
        const { service, row, phase } = setup({ status: TicketStatus.RESOLVED, resolutionDeadlineAt: DEADLINE });

        await expect(service.record(phase(TicketStatus.IN_PROGRESS))).resolves.toBe(false);
        await expect(service.record(phase(TicketStatus.IN_PROGRESS, { silentUnlessMoved: true }))).resolves.toBe(false);

        expect(row.status).toBe(TicketStatus.RESOLVED);
        expect(row.resolutionDeadlineAt).toBe(DEADLINE);
        expect(row.disputedAt).toBeUndefined();
    });

    it('closing a RESOLVED ticket never reopens it because of an unanswered proposal', async () => {
        const { service, row, phase } = setup({ status: TicketStatus.RESOLVED, resolutionDeadlineAt: DEADLINE }, '0', '1');

        await expect(service.record(phase(TicketStatus.CLOSED))).resolves.toBe(false);

        expect(row.status).toBe(TicketStatus.RESOLVED);
        expect(row.disputedAt).toBeUndefined();
    });

    it('an unanswered proposal still sends a running ticket back to the agent instead of closing', async () => {
        const { service, row, phase } = setup({ status: TicketStatus.WAITING_VENDOR, lastPausedAt: new Date() }, '0', '1');

        await expect(service.record(phase(TicketStatus.CLOSED))).resolves.toBe(true);

        expect(row.status).toBe(TicketStatus.IN_PROGRESS);
    });
});
