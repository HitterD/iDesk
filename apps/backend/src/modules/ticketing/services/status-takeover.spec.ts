import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { TicketStatus } from '../entities/ticket.entity';
import { UserRole } from '../../users/enums/user-role.enum';
import { decideStatusTakeover, REASSIGN_CONFIRMATION_REQUIRED } from './status-takeover';

describe('decideStatusTakeover', () => {
    const pic = { id: 'agent-a', fullName: 'Agent A' };
    const assigned = { assignedToId: pic.id, assignedTo: pic };
    const unassigned = { assignedToId: null, assignedTo: null };
    const agentB = { id: 'agent-b', role: UserRole.AGENT_OPERATIONAL_SUPPORT };
    const start = (ticket: any, actor: any, opts = {}) =>
        decideStatusTakeover(ticket, TicketStatus.IN_PROGRESS, TicketStatus.TODO, actor, opts);

    it('returns none when actor is the current PIC', () => {
        expect(start(assigned, { id: pic.id, role: UserRole.AGENT })).toEqual({ kind: 'none' });
    });

    it('returns none when new status is not IN_PROGRESS', () => {
        expect(decideStatusTakeover(assigned, TicketStatus.WAITING_VENDOR, TicketStatus.TODO, agentB, {}))
            .toEqual({ kind: 'none' });
        expect(decideStatusTakeover(assigned, TicketStatus.IN_PROGRESS, TicketStatus.IN_PROGRESS, agentB, {}))
            .toEqual({ kind: 'none' });
    });

    it('returns autoAssign for an unassigned ticket', () => {
        expect(start(unassigned, agentB)).toEqual({ kind: 'autoAssign' });
        expect(start(unassigned, { id: 'admin-1', role: UserRole.ADMIN })).toEqual({ kind: 'autoAssign' });
        // Managers supervise; they do not pick up tickets by starting them.
        expect(start(unassigned, { id: 'mgr-1', role: UserRole.MANAGER })).toEqual({ kind: 'none' });
    });

    it('throws 409 with REASSIGN_CONFIRMATION_REQUIRED and currentAssignee when assigned to another agent', () => {
        let caught: unknown;
        try {
            start(assigned, agentB);
        } catch (error) {
            caught = error;
        }
        expect(caught).toBeInstanceOf(ConflictException);
        expect((caught as ConflictException).getResponse()).toMatchObject({
            code: REASSIGN_CONFIRMATION_REQUIRED,
            currentAssignee: { id: pic.id, fullName: pic.fullName },
        });
    });

    it('returns takeover with reason when confirmed', () => {
        expect(start(assigned, agentB, { takeover: true, reason: '  PIC cuti  ' })).toEqual({
            kind: 'takeover', previousAssigneeId: pic.id, reason: 'PIC cuti',
        });
    });

    it('throws 400 when takeover has no reason', () => {
        expect(() => start(assigned, agentB, { takeover: true })).toThrow(BadRequestException);
        expect(() => start(assigned, agentB, { takeover: true, reason: '   ' })).toThrow(BadRequestException);
    });

    it('returns keep for ADMIN and MANAGER with keepAssignee', () => {
        expect(start(assigned, { id: 'admin-1', role: UserRole.ADMIN }, { keepAssignee: true })).toEqual({ kind: 'keep' });
        expect(start(assigned, { id: 'mgr-1', role: UserRole.MANAGER }, { keepAssignee: true })).toEqual({ kind: 'keep' });
    });

    it('throws 403 for AGENT with keepAssignee', () => {
        expect(() => start(assigned, { id: 'agent-b', role: UserRole.AGENT }, { keepAssignee: true }))
            .toThrow(ForbiddenException);
    });
});
