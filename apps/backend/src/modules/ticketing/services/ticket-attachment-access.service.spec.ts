import { HandlingTeam } from '../entities/ticket.entity';
import { UserRole } from '../../users/enums/user-role.enum';
import { parseTicketUploadPath, TicketAttachmentAccessService } from './ticket-attachment-access.service';

const TICKET_ID = '11111111-2222-3333-4444-555555555555';
const FILE = 'mabc12-xyz.xlsx';
const REL = `tickets/${TICKET_ID}/${FILE}`;

const ticket = (overrides: Record<string, unknown> = {}) => ({
    id: TICKET_ID,
    userId: 'owner',
    siteId: 'site-a',
    handlingTeam: HandlingTeam.OPS_SUPPORT,
    participants: [{ userId: 'guest' }],
    ...overrides,
});

const message = (overrides: Record<string, unknown> = {}) => ({
    ticketId: TICKET_ID,
    isInternal: false,
    attachments: [`/uploads/${REL}`],
    attachmentInfo: [{ path: `/uploads/${REL}`, name: 'Stok Gudang.xlsx', size: 10, mime: 'x' }],
    ...overrides,
});

function setup(messages: unknown[], ticketRow: unknown = ticket()) {
    const qb: any = {
        select: jest.fn(() => qb),
        where: jest.fn(() => qb),
        take: jest.fn(() => qb),
        getMany: jest.fn(async () => messages),
    };
    const ticketRepo = { findOne: jest.fn(async () => ticketRow) };
    const messageRepo = { createQueryBuilder: jest.fn(() => qb) };
    const jwt = { verify: jest.fn() };
    const config = { getOrThrow: jest.fn(() => 'secret') };
    const service = new TicketAttachmentAccessService(ticketRepo as any, messageRepo as any, jwt as any, config as any);
    return { service, jwt, qb, ticketRepo };
}

const viewer = (role: UserRole, id = 'someone', siteId: string | null = 'site-a') => ({ id, role, siteId });

describe('parseTicketUploadPath', () => {
    it('accepts tickets/<dir>/<file> only', () => {
        expect(parseTicketUploadPath(REL)).toEqual({ dir: TICKET_ID, fileName: FILE });
        expect(parseTicketUploadPath('tickets/a/b/c.png')).toBeNull();
        expect(parseTicketUploadPath('avatars/x.png')).toBeNull();
    });
});

describe('TicketAttachmentAccessService.authorize', () => {
    it('lets the requester download with the original file name', async () => {
        const { service, qb } = setup([message()]);
        await expect(service.authorize(viewer(UserRole.USER, 'owner'), REL))
            .resolves.toEqual({ ok: true, downloadName: 'Stok Gudang.xlsx' });
        expect(qb.where).toHaveBeenCalledWith('msg.attachments LIKE :pattern', { pattern: `%/${FILE}"%` });
    });

    it('lets a participant from another site download', async () => {
        const { service } = setup([message()]);
        const result = await service.authorize(viewer(UserRole.AGENT, 'guest', 'site-b'), REL);
        expect(result.ok).toBe(true);
    });

    it("blocks a requester from another requester's ticket on the same site", async () => {
        const { service } = setup([message()]);
        await expect(service.authorize(viewer(UserRole.USER, 'neighbour'), REL))
            .resolves.toEqual({ ok: false, status: 403 });
    });

    it('blocks a site-locked agent from another site', async () => {
        const { service } = setup([message()]);
        await expect(service.authorize(viewer(UserRole.AGENT, 'x', 'site-b'), REL))
            .resolves.toEqual({ ok: false, status: 403 });
    });

    it('blocks an ops agent from a developer-team ticket', async () => {
        const { service } = setup([message()], ticket({ handlingTeam: HandlingTeam.ORACLE_DEV }));
        await expect(service.authorize(viewer(UserRole.AGENT), REL)).resolves.toEqual({ ok: false, status: 403 });
    });

    it('hides internal-note attachments from requesters but not agents', async () => {
        const { service } = setup([message({ isInternal: true })]);
        await expect(service.authorize(viewer(UserRole.USER, 'owner'), REL)).resolves.toEqual({ ok: false, status: 403 });
        expect((await service.authorize(viewer(UserRole.AGENT), REL)).ok).toBe(true);
    });

    it('hides the files of a deleted message from requesters; the handling team keeps them for audit', async () => {
        const { service, qb } = setup([message({ deletedAt: new Date() })]);
        await expect(service.authorize(viewer(UserRole.USER, 'owner'), REL)).resolves.toEqual({ ok: false, status: 403 });
        expect((await service.authorize(viewer(UserRole.AGENT), REL)).ok).toBe(true);
        expect(qb.select.mock.calls[0][0]).toContain('msg.deletedAt');
    });

    it('ignores LIKE hits whose stored name only partially matches', async () => {
        const { service, ticketRepo } = setup([message({ attachments: [`/uploads/tickets/${TICKET_ID}/x${FILE}`] })], null);
        await expect(service.authorize(viewer(UserRole.ADMIN), REL)).resolves.toEqual({ ok: false, status: 404 });
        expect(ticketRepo.findOne).toHaveBeenCalledWith({ where: { id: TICKET_ID }, relations: ['participants'] });
    });

    it('falls back to the folder ticket for untracked files', async () => {
        const { service } = setup([]);
        await expect(service.authorize(viewer(UserRole.USER, 'owner'), REL)).resolves.toEqual({ ok: true, downloadName: null });
        await expect(service.authorize(viewer(UserRole.USER, 'stranger'), REL)).resolves.toEqual({ ok: false, status: 403 });
    });

    it('limits untracked files in the unscoped folder to admins', async () => {
        const { service } = setup([]);
        const rel = `tickets/unscoped/${FILE}`;
        expect((await service.authorize(viewer(UserRole.ADMIN), rel)).ok).toBe(true);
        await expect(service.authorize(viewer(UserRole.AGENT), rel)).resolves.toEqual({ ok: false, status: 404 });
    });
});

describe('TicketAttachmentAccessService.authenticate', () => {
    const claims = { sub: 'u1', role: UserRole.AGENT, type: 'access', siteId: 'site-a' };

    it('reads the access cookie', () => {
        const { service, jwt } = setup([]);
        jwt.verify.mockReturnValue(claims);
        expect(service.authenticate({ cookies: { access_token: 't' }, headers: {} } as any))
            .toEqual({ id: 'u1', role: UserRole.AGENT, siteId: 'site-a' });
        expect(jwt.verify).toHaveBeenCalledWith('t', { secret: 'secret' });
    });

    it('falls back to a Bearer header', () => {
        const { service, jwt } = setup([]);
        jwt.verify.mockReturnValue(claims);
        service.authenticate({ headers: { authorization: 'Bearer h' } } as any);
        expect(jwt.verify).toHaveBeenCalledWith('h', { secret: 'secret' });
    });

    it('rejects missing, invalid and non-access tokens', () => {
        const { service, jwt } = setup([]);
        expect(service.authenticate({ headers: {} } as any)).toBeNull();
        jwt.verify.mockImplementation(() => { throw new Error('bad'); });
        expect(service.authenticate({ cookies: { access_token: 't' }, headers: {} } as any)).toBeNull();
        jwt.verify.mockReturnValue({ ...claims, type: 'refresh' });
        expect(service.authenticate({ cookies: { access_token: 't' }, headers: {} } as any)).toBeNull();
    });
});
