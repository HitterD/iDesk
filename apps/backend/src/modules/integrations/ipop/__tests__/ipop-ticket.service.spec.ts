import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

// Attachments are written under UPLOAD_DIR (read at import time): keep tests out of ./uploads.
const TMP_UPLOADS = mkdtempSync(join(tmpdir(), 'ipop-test-'));
process.env.UPLOAD_DIR = TMP_UPLOADS;
afterAll(() => rmSync(TMP_UPLOADS, { recursive: true, force: true }));

import { BadRequestException, ForbiddenException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { In, Not, QueryFailedError } from 'typeorm';
import { IpopTicketService, isIpopVisible, plainText, visitOf } from '../ipop-ticket.service';
import { TicketPriority, TicketSource, TicketStatus, TicketType, HandlingTeam } from '../../../ticketing/entities/ticket.entity';

const PNG = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex');

const ticket = (over: Record<string, unknown> = {}) => ({
    id: 't-1', ticketNumber: 'GEN-0001', externalRef: 'REF-1', externalSource: 'IPOP',
    status: TicketStatus.TODO, priority: TicketPriority.MEDIUM, category: 'NETWORK', title: 'Wifi mati',
    handlingTeam: HandlingTeam.OPS_SUPPORT, assignedTo: null, slaTarget: null,
    createdAt: new Date('2026-10-04T01:00:00Z'), updatedAt: new Date('2026-10-04T01:00:00Z'), resolvedAt: null, closedAt: null,
    ...over,
});

const dto = (over: Record<string, unknown> = {}) => ({
    externalRef: 'REF-1', module: 'it-support', category: 'NETWORK', priority: TicketPriority.MEDIUM,
    title: 'Wifi lantai 2 mati', description: 'Tidak bisa konek', requester: { nik: '00000024' }, ...over,
}) as any;

function build(opts: { existing?: any; user?: any; createError?: Error; messages?: any[] } = {}) {
    const ticketRepo = {
        findOne: jest.fn()
            .mockResolvedValueOnce(opts.existing ?? null) // idempotency lookup
            .mockResolvedValue(ticket()),                 // reload after create
        find: jest.fn().mockResolvedValue([]),
    };
    const userRepo = {
        findOne: jest.fn().mockResolvedValue('user' in opts ? opts.user : { id: 'u-1', isActive: true }),
    };
    const catalog = {
        resolveRoute: jest.fn(async (slug: string, category?: string) => (
            slug === 'oracle-k2'
                ? { module: { slug }, category: 'ORACLE_REQUEST', ticketType: TicketType.ORACLE_REQUEST, isHardwareInstallation: false }
                : { module: { slug }, category, ticketType: TicketType.SERVICE, isHardwareInstallation: category === 'HARDWARE_INSTALLATION' }
        )),
    };
    const ticketCreate = {
        createTicket: opts.createError
            ? jest.fn().mockRejectedValue(opts.createError)
            : jest.fn().mockResolvedValue(ticket()),
    };
    const messageRepo = { find: jest.fn().mockResolvedValue(opts.messages ?? []) };
    const messaging = { replyToTicket: jest.fn().mockResolvedValue({ id: 'm-9', createdAt: new Date('2026-10-19T03:00:00Z') }) };
    const service = new IpopTicketService(
        ticketRepo as any, userRepo as any, messageRepo as any, catalog as any, ticketCreate as any,
        { get: (k: string) => (k === 'FRONTEND_URL' ? 'https://idesk.santos.co.id' : undefined) } as any,
        messaging as any,
    );
    return { service, ticketRepo, userRepo, messageRepo, catalog, ticketCreate, messaging };
}

describe('IpopTicketService.create', () => {
    it('files the ticket as the iPop user, tagged IPOP with the external ref', async () => {
        const { service, ticketCreate } = build();

        const result = await service.create(dto());

        expect(result.created).toBe(true);
        const [requesterId, createDto, , , external] = ticketCreate.createTicket.mock.calls[0];
        expect(requesterId).toBe('u-1');
        expect(createDto).toMatchObject({ source: TicketSource.IPOP, category: 'NETWORK', ticketType: TicketType.SERVICE });
        expect(external).toEqual({ source: 'IPOP', ref: 'REF-1' });
        expect(result.ticket).toMatchObject({ ticketNumber: 'GEN-0001', module: 'it-support', url: 'https://idesk.santos.co.id/client/tickets/t-1' });
    });

    it('sends a developer module request to that module type', async () => {
        const { service, ticketCreate } = build();

        await service.create(dto({ module: 'oracle-k2', category: undefined }));

        expect(ticketCreate.createTicket.mock.calls[0][1]).toMatchObject({ category: 'ORACLE_REQUEST', ticketType: TicketType.ORACLE_REQUEST });
    });

    it('returns the existing ticket for a repeated externalRef without creating another', async () => {
        const { service, ticketCreate } = build({ existing: ticket({ ticketNumber: 'GEN-0009' }) });

        const result = await service.create(dto());

        expect(result).toMatchObject({ created: false, ticket: { ticketNumber: 'GEN-0009' } });
        expect(ticketCreate.createTicket).not.toHaveBeenCalled();
    });

    it('resolves a concurrent duplicate through the unique index', async () => {
        const unique = Object.assign(new QueryFailedError('insert', [], new Error('dup')), { driverError: { code: '23505' } });
        const { service, ticketRepo } = build({ createError: unique });
        ticketRepo.findOne.mockReset()
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(ticket({ ticketNumber: 'GEN-0002' }));

        const result = await service.create(dto());

        expect(result).toMatchObject({ created: false, ticket: { ticketNumber: 'GEN-0002' } });
    });

    it('rejects a requester that is not registered or not active (422)', async () => {
        await expect(build({ user: null }).service.create(dto())).rejects.toThrow(UnprocessableEntityException);
        await expect(build({ user: { id: 'u', isActive: false } }).service.create(dto())).rejects.toThrow(/inactive/);
    });

    it('matches by email when no NIK is sent', async () => {
        const { service, userRepo } = build();

        await service.create(dto({ requester: { email: 'Budi@Santos.co.id' } }));

        expect(userRepo.findOne).toHaveBeenCalledWith({ where: { email: 'budi@santos.co.id' } });
    });

    it('stores valid base64 attachments and rejects content that does not match the extension', async () => {
        const ok = build();
        await ok.service.create(dto({ attachments: [{ fileName: 'shot.png', contentBase64: PNG.toString('base64') }] }));
        const [, , paths, info] = ok.ticketCreate.createTicket.mock.calls[0];
        expect(paths[0]).toMatch(/^\/uploads\/tickets\/ipop\/.+\.png$/);
        expect(info[0]).toMatchObject({ name: 'shot.png', mime: 'image/png', size: PNG.length });

        const bad = build();
        await expect(bad.service.create(dto({ attachments: [{ fileName: 'evil.png', contentBase64: Buffer.from('MZ not an image').toString('base64') }] })))
            .rejects.toThrow(BadRequestException);
        expect(bad.ticketCreate.createTicket).not.toHaveBeenCalled();
    });
});

describe('IpopTicketService.find', () => {
    // Tickets filed directly in iDesk are linked by the requester's NIK, like "My Tickets".
    it('returns all requester-visible tickets of the NIK, wherever they were filed', async () => {
        const { service, ticketRepo, userRepo } = build();
        userRepo.findOne.mockResolvedValue({ id: 'u-1' });

        await service.find({ nik: '00000024', state: 'open' });

        const where = ticketRepo.find.mock.calls[0][0].where;
        expect(where.userId).toBe('u-1');
        expect(where).not.toHaveProperty('externalSource');
        expect(where.ticketType).toEqual(Not(In([TicketType.ICT_BUDGET, TicketType.HARDWARE_INSTALLATION])));
    });

    it('requires externalRef or nik', async () => {
        await expect(build().service.find({})).rejects.toThrow(BadRequestException);
    });
});

describe('iPop visibility of iDesk-filed tickets', () => {
    it('includes iDesk tickets whose requester has a NIK, and marks their origin', () => {
        const { service } = build();
        const view = service.toView(ticket({ externalSource: null, externalRef: null, user: { employeeId: '00000024', fullName: 'Budi' } }) as any);

        expect(view).toMatchObject({ origin: 'IDESK', externalRef: null, requester: { nik: '00000024', name: 'Budi' } });
        expect(isIpopVisible({ externalSource: null, ticketType: TicketType.SERVICE, user: { employeeId: '00000024' } } as any)).toBe(true);
    });

    it('excludes requesters without a NIK and types hidden from "My Tickets"', () => {
        expect(isIpopVisible({ externalSource: null, ticketType: TicketType.SERVICE, user: { employeeId: null } } as any)).toBe(false);
        expect(isIpopVisible({ externalSource: null, ticketType: TicketType.ICT_BUDGET, user: { employeeId: '1' } } as any)).toBe(false);
        expect(isIpopVisible({ externalSource: null, ticketType: TicketType.HARDWARE_INSTALLATION, user: { employeeId: '1' } } as any)).toBe(false);
    });

    it('always includes tickets filed through iPop', () => {
        expect(isIpopVisible({ externalSource: 'IPOP', ticketType: TicketType.SERVICE, user: null } as any)).toBe(true);
    });

    it('looks up a ticket number only when iPop may see it', async () => {
        const { service, ticketRepo } = build();
        ticketRepo.findOne.mockReset().mockResolvedValue(ticket({ externalSource: null, user: { employeeId: null } }));

        await expect(service.getByNumber('GEN-0001')).rejects.toThrow(/not|No ticket/i);
    });
});

describe('IpopTicketService.getMessages', () => {
    const msg = (over: Record<string, unknown> = {}) => ({
        id: 'm-1', content: '<p>Sudah saya cek</p>', senderId: 'u-agent', sender: { fullName: 'Agent A', employeeId: '00000099' },
        attachments: [], attachmentInfo: null, createdAt: new Date('2026-10-11T03:00:00Z'), ...over,
    });

    it('returns the public chat oldest first, as plain text, without internal notes', async () => {
        const { service, ticketRepo, messageRepo } = build({
            messages: [msg({ id: 'm-2', content: 'Siap', senderId: 'u-1', sender: { fullName: 'Budi' } }), msg()],
        });
        ticketRepo.findOne.mockReset().mockResolvedValue(ticket({ userId: 'u-1' }));

        const result = await service.getMessages('GEN-0001');

        expect(messageRepo.find.mock.calls[0][0].where).toEqual({ ticketId: 't-1', isInternal: false, isSystemMessage: false });
        expect(result.messages.map((m) => m.id)).toEqual(['m-1', 'm-2']);
        expect(result.messages[0]).toMatchObject({ sender: { name: 'Agent A' }, fromRequester: false, content: 'Sudah saya cek' });
        expect(result.messages[1].fromRequester).toBe(true);
        expect(result.url).toBe('https://idesk.santos.co.id/client/tickets/t-1');
    });

    it('never exposes the sender NIK', async () => {
        const { service, ticketRepo } = build({ messages: [msg()] });
        ticketRepo.findOne.mockReset().mockResolvedValue(ticket());

        const json = JSON.stringify(await service.getMessages('GEN-0001'));

        expect(json).not.toContain('00000099');
        expect(json).not.toMatch(/nik|employeeId/i);
    });

    it('lists attachments by original name only', async () => {
        const { service, ticketRepo } = build({
            messages: [msg({ attachments: ['/uploads/tickets/x1.pdf'], attachmentInfo: [{ path: '/uploads/tickets/x1.pdf', name: 'reset-wifi.pdf', size: 1, mime: 'x' }] })],
        });
        ticketRepo.findOne.mockReset().mockResolvedValue(ticket());

        const [m] = (await service.getMessages('GEN-0001')).messages;

        expect(m.attachments).toEqual([{ name: 'reset-wifi.pdf' }]);
    });

    it('is 404 for tickets iPop may not see', async () => {
        const { service, ticketRepo } = build();
        ticketRepo.findOne.mockReset().mockResolvedValue(ticket({ externalSource: null, user: { employeeId: null } }));

        await expect(service.getMessages('GEN-0001')).rejects.toThrow(/No ticket/);
    });
});

describe('plainText', () => {
    it('keeps line breaks and decodes entities', () => {
        expect(plainText('<p>Halo&nbsp;Budi</p><p>Coba <b>restart</b><br>lalu cek &amp; kabari</p>')).toBe('Halo Budi\nCoba restart\nlalu cek & kabari');
    });
});

describe('visitOf', () => {
    const install = (over: Record<string, unknown> = {}) => ({
        isHardwareInstallation: true, scheduledDate: new Date('2026-10-12T17:00:00Z'), scheduledTime: '09:00', hardwareType: 'PRINTER', ...over,
    }) as any;

    it('turns the WIB date + slot into a one-hour UTC visit', () => {
        // 2026-10-12T17:00Z is 13 Oct 00:00 WIB: the visit is on the 13th, 09:00 WIB = 02:00Z.
        expect(visitOf(install())).toEqual({ start: '2026-10-13T02:00:00.000Z', end: '2026-10-13T03:00:00.000Z', hardwareType: 'PRINTER' });
    });

    it('uses the end of a "09.00 - 11.00" range', () => {
        expect(visitOf(install({ scheduledTime: '09.00 - 11.00' }))).toMatchObject({ start: '2026-10-13T02:00:00.000Z', end: '2026-10-13T04:00:00.000Z' });
    });

    it('is null for other tickets or without a slot', () => {
        expect(visitOf(install({ isHardwareInstallation: false }))).toBeNull();
        expect(visitOf(install({ scheduledDate: null }))).toBeNull();
        expect(visitOf(install({ scheduledTime: null }))).toBeNull();
    });
});

describe('IpopTicketService.reply (from the iPop Notifier)', () => {
    const replyTicket = (over: Record<string, unknown> = {}) => ticket({
        userId: 'u-req', createdById: null, assignedToId: 'u-agent', participants: [],
        user: { employeeId: '00000024' }, ...over,
    });
    const setup = (t: any, user: any) => {
        const ctx = build({ user });
        ctx.ticketRepo.findOne.mockReset().mockResolvedValue(t);
        return ctx;
    };

    it('posts as the requester through the normal iDesk reply path', async () => {
        const { service, messaging } = setup(replyTicket(), { id: 'u-req', isActive: true });
        await expect(service.reply('GEN-0001', { nik: '00000024', content: '  Sudah bisa, terima kasih  ' }))
            .resolves.toEqual({ id: 'm-9', createdAt: '2026-10-19T03:00:00.000Z' });
        expect(messaging.replyToTicket).toHaveBeenCalledWith('t-1', 'u-req', 'Sudah bisa, terima kasih');
    });

    it('finds the ticket by its iDesk id too (agents have no iPop copy)', async () => {
        const { service, ticketRepo } = setup(replyTicket(), { id: 'u-agent', isActive: true });
        await service.reply('23841455-c9a9-494c-952f-e68309dc9fca', { nik: '00061058', content: 'ok' });
        expect(ticketRepo.findOne.mock.calls[0][0].where).toEqual({ id: '23841455-c9a9-494c-952f-e68309dc9fca' });
    });

    it('lets the assigned agent reply', async () => {
        const { service, messaging } = setup(replyTicket(), { id: 'u-agent', isActive: true });
        await service.reply('GEN-0001', { nik: '00061058', content: 'Siap, saya cek' });
        expect(messaging.replyToTicket).toHaveBeenCalledWith('t-1', 'u-agent', 'Siap, saya cek');
    });

    it('refuses anyone else, even ICT staff not assigned to the ticket', async () => {
        const { service, messaging } = setup(replyTicket(), { id: 'u-other', isActive: true });
        await expect(service.reply('GEN-0001', { nik: '00099999', content: 'hi' })).rejects.toBeInstanceOf(ForbiddenException);
        expect(messaging.replyToTicket).not.toHaveBeenCalled();
    });

    it('refuses unknown or inactive NIKs and tickets iPop cannot see', async () => {
        let ctx = setup(replyTicket(), null);
        await expect(ctx.service.reply('GEN-0001', { nik: 'x', content: 'hi' })).rejects.toBeInstanceOf(UnprocessableEntityException);
        ctx = setup(replyTicket(), { id: 'u-req', isActive: false });
        await expect(ctx.service.reply('GEN-0001', { nik: 'x', content: 'hi' })).rejects.toBeInstanceOf(UnprocessableEntityException);
        ctx = setup(replyTicket({ externalSource: null, user: { employeeId: null } }), { id: 'u-req', isActive: true });
        await expect(ctx.service.reply('GEN-0001', { nik: 'x', content: 'hi' })).rejects.toBeInstanceOf(NotFoundException);
    });
});
