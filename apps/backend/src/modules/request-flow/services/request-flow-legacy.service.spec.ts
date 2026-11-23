import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRole } from '../../users/enums/user-role.enum';
import { RequestFlowLegacyService } from './request-flow-legacy.service';

const LEGACY = '4db3ff1a-1ba2-4a64-bd77-3312f9a4dcc9';
const TICKET = '0b6d3c4e-1111-4222-8333-444455556677';
const viewer = (userId: string, role = UserRole.USER, siteId: string | null = 'site-1') => ({ userId, role, siteId });

function setup(row: { ticketId: string; requesterId: string; siteId: string | null; managerId: string | null; gmId: string | null } | null) {
    const query = jest.fn(async (_sql: string, _params?: unknown[]) => (row ? [row] : []));
    return { service: new RequestFlowLegacyService({ query } as never), query };
}
const row = { ticketId: TICKET, requesterId: 'req-1', siteId: 'site-1', managerId: 'mgr-1', gmId: null };

describe('RequestFlowLegacyService.ticketOf', () => {
    it('finds the ticket of an old hardware request or e-form by its old id', async () => {
        const { service, query } = setup(row);
        await expect(service.ticketOf(viewer('req-1'), 'hardware', LEGACY)).resolves.toEqual({ ticketId: TICKET });
        expect(String(query.mock.calls[0][0])).toContain('hardware_requests');
        expect(query.mock.calls[0][1]).toEqual([LEGACY]);
        await service.ticketOf(viewer('req-1'), 'eform', LEGACY);
        expect(String(query.mock.calls[1][0])).toContain('eform_requests');
    });

    it('an unknown id, or one that is not an id at all, is not found', async () => {
        await expect(setup(null).service.ticketOf(viewer('req-1'), 'eform', LEGACY)).rejects.toBeInstanceOf(NotFoundException);
        const { service, query } = setup(row);
        await expect(service.ticketOf(viewer('req-1'), 'eform', 'not-a-uuid')).rejects.toBeInstanceOf(NotFoundException);
        expect(query).not.toHaveBeenCalled();
    });

    it('an unknown kind is a bad request', async () => {
        await expect(setup(row).service.ticketOf(viewer('req-1'), 'laptop' as never, LEGACY)).rejects.toBeInstanceOf(BadRequestException);
    });

    it.each(['constructor', 'toString', '__proto__', 'hasOwnProperty'])('the kind "%s" is inherited from Object, not a kind: bad request, no SQL', async (kind) => {
        const { service, query } = setup(row);
        await expect(service.ticketOf(viewer('req-1'), kind as never, LEGACY)).rejects.toBeInstanceOf(BadRequestException);
        expect(query).not.toHaveBeenCalled();
    });

    it('opens for the requester, a named approver, and IT of the same site; refuses everyone else', async () => {
        const { service } = setup(row);
        await expect(service.ticketOf(viewer('mgr-1'), 'hardware', LEGACY)).resolves.toBeDefined();
        await expect(service.ticketOf(viewer('it-1', UserRole.AGENT_OPERATIONAL_SUPPORT), 'hardware', LEGACY)).resolves.toBeDefined();
        await expect(service.ticketOf(viewer('x'), 'hardware', LEGACY)).rejects.toBeInstanceOf(ForbiddenException);
        await expect(service.ticketOf(viewer('it-2', UserRole.AGENT, 'site-2'), 'hardware', LEGACY)).rejects.toBeInstanceOf(ForbiddenException);
    });
});
