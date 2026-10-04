import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

// Attachments are written under UPLOAD_DIR (read at import time): keep tests out of ./uploads.
const TMP_UPLOADS = mkdtempSync(join(tmpdir(), 'ipop-test-'));
process.env.UPLOAD_DIR = TMP_UPLOADS;
afterAll(() => rmSync(TMP_UPLOADS, { recursive: true, force: true }));

import { BadRequestException, UnprocessableEntityException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { IpopTicketService } from '../ipop-ticket.service';
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

function build(opts: { existing?: any; user?: any; createError?: Error } = {}) {
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
    const service = new IpopTicketService(
        ticketRepo as any, userRepo as any, catalog as any, ticketCreate as any,
        { get: (k: string) => (k === 'FRONTEND_URL' ? 'https://idesk.santos.co.id' : undefined) } as any,
    );
    return { service, ticketRepo, userRepo, catalog, ticketCreate };
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
    it('only returns tickets filed through iPop', async () => {
        const { service, ticketRepo, userRepo } = build();
        userRepo.findOne.mockResolvedValue({ id: 'u-1' });

        await service.find({ nik: '00000024', state: 'open' });

        expect(ticketRepo.find.mock.calls[0][0].where).toMatchObject({ userId: 'u-1', externalSource: 'IPOP' });
    });

    it('requires externalRef or nik', async () => {
        await expect(build().service.find({})).rejects.toThrow(BadRequestException);
    });
});
