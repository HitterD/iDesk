import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { EFormType } from '../../eform-request/entities/eform-request.entity';
import { TicketPriority, TicketType } from '../../ticketing/entities/ticket.entity';
import { TicketMessage } from '../../ticketing/entities/ticket-message.entity';
import { UserRole } from '../../users/enums/user-role.enum';
import { CreateEformTicketDto } from '../dto/create-eform-ticket.dto';
import { CreateHardwareTicketDto } from '../dto/create-hardware-ticket.dto';
import { RequestDocumentRevision } from '../entities/request-document-revision.entity';
import { RequestFlow } from '../entities/request-flow.entity';
import { RequestFlowService } from './request-flow.service';

const SIGNATURE = 'data:image/png;base64,iVBORw0KGgo=';
const MANAGER_ID = '6f0c1a8e-2b3d-4c5e-8f90-1a2b3c4d5e6f';
const CATALOG_ID = '0b6d3c4e-1111-4222-8333-444455556666';
const actor = { userId: 'u-1', username: 'leony', role: UserRole.USER, fullName: 'Leony Rustandy', siteId: 'site-1' };

const hardwareBody = (): CreateHardwareTicketDto => ({
    title: 'Laptop untuk staf baru',
    justification: 'Dua staf QC baru mulai bulan depan',
    division: 'QC',
    recipients: ['Andi', 'Budi'],
    managerId: MANAGER_ID,
    items: [
        { catalogId: CATALOG_ID, quantity: 2, note: 'RAM 16GB', fields: { os: 'Windows 11' }, recipientName: 'Andi' },
        { manualName: 'Docking USB-C', quantity: 1 },
    ],
    signatureData: SIGNATURE,
});

const eformBody = (over: Partial<CreateEformTicketDto> = {}): CreateEformTicketDto => ({
    formType: EFormType.VPN,
    formData: { alasan: 'Kerja remote saat dinas', kebutuhanAkses: 'Remote PC Kantor' },
    termsAccepted: true,
    signatureData: SIGNATURE,
    startDate: '2026-12-01',
    endDate: '2027-02-28',
    ...over,
} as CreateEformTicketDto);

function setup() {
    const saved: Record<string, any[]> = { flows: [], revisions: [], messages: [] };
    const manager = {
        create: jest.fn((_entity: unknown, value: any) => ({ ...value })),
        save: jest.fn(async (entity: unknown, value: any) => {
            if (entity === RequestFlow) { const row = { id: 'flow-1', ...value }; saved.flows.push(row); return row; }
            if (entity === RequestDocumentRevision) { saved.revisions.push(value); return value; }
            if (entity === TicketMessage) { saved.messages.push(value); return value; }
            return value;
        }),
    };
    const ticket = { id: 't-1', ticketNumber: '221126-QC-0035' };
    const requester = { id: 'u-1', fullName: 'Leony Rustandy' };
    const ticketCreate = {
        createTicketWithin: jest.fn(async (_userId: string, _dto: unknown, fill: any) => {
            await fill(manager, ticket, requester);
            return ticket;
        }),
    };
    const hardware = {
        createDraftWith: jest.fn(async () => ({ id: 'hr-1', requestNumber: 'HR-2026-0042' })),
        submitWith: jest.fn(async () => ({ id: 'hr-1', status: 'SUBMITTED' })),
    };
    const eform = { createForTicket: jest.fn(async () => ({ id: 'ef-1', documentNumber: 'F/ICT/04/0120' })) };
    const userRepo = { exists: jest.fn(async () => true) };
    const service = new RequestFlowService(ticketCreate as any, hardware as any, eform as any, userRepo as any);
    return { service, manager, ticketCreate, hardware, eform, userRepo, saved };
}

const dtoErrors = async (cls: any, body: object) =>
    (await validate(plainToInstance(cls, body) as object, { whitelist: true, forbidNonWhitelisted: true }))
        .flatMap(function flat(e: any): string[] {
            return [e.property, ...(e.children ?? []).flatMap(flat)];
        });

describe('RequestFlowService.createHardware', () => {
    it('creates an IT ticket and a submitted hardware request linked to it', async () => {
        const { service, ticketCreate, hardware, manager, saved } = setup();

        await expect(service.createHardware(actor, hardwareBody())).resolves.toEqual({ ticketId: 't-1', ticketNumber: '221126-QC-0035' });

        expect(ticketCreate.createTicketWithin).toHaveBeenCalledWith('u-1', {
            title: 'Laptop untuk staf baru',
            description: 'Dua staf QC baru mulai bulan depan',
            priority: TicketPriority.MEDIUM,
            ticketType: TicketType.HARDWARE_REQUEST,
        }, expect.any(Function));
        expect(hardware.createDraftWith).toHaveBeenCalledWith(manager, 'u-1', 'site-1', UserRole.USER, {
            recipientName: 'Andi, Budi',
            division: 'QC',
            justification: 'Dua staf QC baru mulai bulan depan',
            items: [
                { catalogId: CATALOG_ID, manualName: undefined, quantity: 2, notes: 'RAM 16GB', recipientName: 'Andi', customFields: { os: 'Windows 11', recipientName: 'Andi' } },
                { catalogId: undefined, manualName: 'Docking USB-C', quantity: 1, notes: undefined, customFields: {} },
            ],
        }, { sourceTicketId: 't-1', requesterSignature: SIGNATURE });
        expect(hardware.submitWith).toHaveBeenCalledWith(manager, 'u-1', 'hr-1', { allowDirectInstallation: false });
        expect(saved.flows).toEqual([expect.objectContaining({
            ticketId: 't-1', kind: 'HARDWARE', hardwareRequestId: 'hr-1', eformRequestId: null, route: null, managerId: MANAGER_ID,
        })]);
    });

    it('stores revision v1 GEN signed by the requester', async () => {
        const { service, saved } = setup();
        await service.createHardware(actor, hardwareBody());
        expect(saved.revisions).toEqual([{
            flowId: 'flow-1', version: 1, kind: 'GEN', label: 'Dibuat dari pengajuan · TTD pemohon', actorId: 'u-1',
        }]);
    });

    it('writes the first system message on the ticket', async () => {
        const { service, saved } = setup();
        await service.createHardware(actor, hardwareBody());
        expect(saved.messages).toEqual([expect.objectContaining({
            ticketId: 't-1',
            senderId: 'u-1',
            isSystemMessage: true,
            content: 'System: Leony Rustandy membuat Hardware Request',
            systemEvent: { v: 1, actor: { id: 'u-1', name: 'Leony Rustandy' }, changes: [] },
        })]);
    });

    it('keeps the justification as given, without a request type prefix', async () => {
        const { service, hardware } = setup();
        await service.createHardware(actor, { ...hardwareBody(), justification: '[PENJADWALAN PEMASANGAN] pasang sekarang' });
        expect((hardware.createDraftWith.mock.calls[0] as any[])[4].justification).toBe('[PENJADWALAN PEMASANGAN] pasang sekarang');
        expect(hardware.submitWith).toHaveBeenCalledWith(expect.anything(), 'u-1', 'hr-1', { allowDirectInstallation: false });
    });

    it('refuses a proposed manager who is not an active user, before creating anything', async () => {
        const { service, userRepo, ticketCreate } = setup();
        userRepo.exists.mockResolvedValue(false);
        await expect(service.createHardware(actor, hardwareBody())).rejects.toThrow('Atasan yang dipilih tidak ditemukan atau tidak aktif');
        expect(ticketCreate.createTicketWithin).not.toHaveBeenCalled();
    });

    it('refuses the requester as their own manager', async () => {
        const { service } = setup();
        await expect(service.createHardware({ ...actor, userId: MANAGER_ID }, hardwareBody())).rejects.toBeInstanceOf(BadRequestException);
    });
});

describe('CreateHardwareTicketDto', () => {
    it('accepts the unified form body', async () => {
        expect(await dtoErrors(CreateHardwareTicketDto, hardwareBody())).toEqual([]);
    });

    it('accepts a manual item without catalog', async () => {
        expect(await dtoErrors(CreateHardwareTicketDto, { ...hardwareBody(), items: [{ manualName: 'Kabel HDMI 5m', quantity: 1 }] })).toEqual([]);
    });

    it('rejects quantity 51', async () => {
        expect(await dtoErrors(CreateHardwareTicketDto, { ...hardwareBody(), items: [{ catalogId: CATALOG_ID, quantity: 51 }] }))
            .toContain('quantity');
    });

    it('rejects an item with neither catalog nor manual name', async () => {
        expect(await dtoErrors(CreateHardwareTicketDto, { ...hardwareBody(), items: [{ quantity: 1 }] })).not.toEqual([]);
    });

    it('rejects an item with both catalog and manual name', async () => {
        expect(await dtoErrors(CreateHardwareTicketDto, { ...hardwareBody(), items: [{ catalogId: CATALOG_ID, manualName: 'Laptop', quantity: 1 }] }))
            .not.toEqual([]);
    });

    it('rejects no recipients', async () => {
        expect(await dtoErrors(CreateHardwareTicketDto, { ...hardwareBody(), recipients: [] })).toContain('recipients');
    });

    it.each([
        ['not a png data URL', 'data:image/jpeg;base64,AAAA'],
        ['larger than 300 KB', `data:image/png;base64,${'A'.repeat(300 * 1024)}`],
    ])('rejects a signature %s', async (_case, signatureData) => {
        expect(await dtoErrors(CreateHardwareTicketDto, { ...hardwareBody(), signatureData })).toContain('signatureData');
    });
});

describe('RequestFlowService.createEform', () => {
    it('creates an eform ticket waiting for IT review, with the period kept in formData', async () => {
        const { service, ticketCreate, eform, manager, saved } = setup();

        await expect(service.createEform(actor, eformBody({ managerId: MANAGER_ID })))
            .resolves.toEqual({ ticketId: 't-1', ticketNumber: '221126-QC-0035' });

        expect(ticketCreate.createTicketWithin).toHaveBeenCalledWith('u-1', {
            title: 'Akses VPN',
            description: 'Kerja remote saat dinas',
            priority: TicketPriority.MEDIUM,
            ticketType: TicketType.EFORM_REQUEST,
        }, expect.any(Function));
        const [mgr, userId, name, dto, ticketId] = eform.createForTicket.mock.calls[0] as any[];
        expect([mgr, userId, name, ticketId]).toEqual([manager, 'u-1', 'Leony Rustandy', 't-1']);
        expect(dto.formData).toEqual({
            alasan: 'Kerja remote saat dinas', kebutuhanAkses: 'Remote PC Kantor', dariTanggal: '2026-12-01', sampaiTanggal: '2027-02-28',
        });
        expect(saved.flows).toEqual([expect.objectContaining({ kind: 'EFORM', eformRequestId: 'ef-1', hardwareRequestId: null, route: null, managerId: MANAGER_ID })]);
        expect(saved.revisions).toEqual([expect.objectContaining({ version: 1, kind: 'GEN', label: 'Dibuat dari pengajuan · TTD pemohon' })]);
        expect(saved.messages).toEqual([expect.objectContaining({ content: 'System: Leony Rustandy membuat E-Form Request' })]);
    });

    it('rejects VPN longer than 366 days', async () => {
        const { service, ticketCreate } = setup();
        await expect(service.createEform(actor, eformBody({ startDate: '2026-12-01', endDate: '2027-12-03' })))
            .rejects.toThrow('Maksimal 12 bulan');
        expect(ticketCreate.createTicketWithin).not.toHaveBeenCalled();
    });

    it('accepts VPN for exactly 366 days', async () => {
        const { service } = setup();
        await expect(service.createEform(actor, eformBody({ startDate: '2026-12-01', endDate: '2027-12-02' }))).resolves.toBeDefined();
    });

    it.each([EFormType.VPN, EFormType.NETWORK, EFormType.FLASHDISK])('requires an end date for %s', async (formType) => {
        const { service } = setup();
        await expect(service.createEform(actor, eformBody({ formType, endDate: undefined }))).rejects.toThrow('Isi tanggal selesai');
    });

    it('allows EMAIL without endDate', async () => {
        const { service, eform } = setup();
        await service.createEform(actor, eformBody({ formType: EFormType.EMAIL, endDate: undefined }));
        expect((eform.createForTicket.mock.calls[0] as any[])[3].formData).toMatchObject({ dariTanggal: '2026-12-01', sampaiTanggal: '' });
    });

    it('allows a permanent Website access longer than 12 months', async () => {
        const { service } = setup();
        await expect(service.createEform(actor, eformBody({ formType: EFormType.WEBSITE, endDate: '2028-12-01' }))).resolves.toBeDefined();
    });

    it('rejects an end date before the start date', async () => {
        const { service } = setup();
        await expect(service.createEform(actor, eformBody({ formType: EFormType.EMAIL, endDate: '2026-11-30' })))
            .rejects.toThrow('Tanggal selesai sebelum mulai');
    });

    it('requires the terms to be accepted', async () => {
        const { service } = setup();
        await expect(service.createEform(actor, eformBody({ termsAccepted: false }))).rejects.toThrow('Setujui syarat penggunaan');
    });

    it('titles the ticket after the access kind', async () => {
        const { service, ticketCreate } = setup();
        await service.createEform(actor, eformBody({ formType: EFormType.SYNOLOGY_NAS, endDate: undefined }));
        expect((ticketCreate.createTicketWithin.mock.calls[0] as any[])[1].title).toBe('Akses Synology NAS');
    });
});

describe('CreateEformTicketDto', () => {
    it('accepts an e-form body without manager', async () => {
        expect(await dtoErrors(CreateEformTicketDto, eformBody())).toEqual([]);
    });

    it.each(['2026-13-01', '01-12-2026', '2026-02-30'])('rejects start date %s', async (startDate) => {
        expect(await dtoErrors(CreateEformTicketDto, eformBody({ startDate }))).toContain('startDate');
    });

    it('does not take a GM or a draft id: IT decides the route', async () => {
        expect(await dtoErrors(CreateEformTicketDto, { ...eformBody(), gmApproverId: MANAGER_ID })).toContain('gmApproverId');
        expect(await dtoErrors(CreateEformTicketDto, { ...eformBody(), draftId: MANAGER_ID })).toContain('draftId');
    });
});

describe('CreateEformTicketDto signature', () => {
    it('rejects a signature that is not a PNG data URL', async () => {
        expect(await dtoErrors(CreateEformTicketDto, eformBody({ signatureData: 'javascript:alert(1)' }))).toContain('signatureData');
    });

    it('rejects a signature over 300 KB', async () => {
        const huge = `data:image/png;base64,${'A'.repeat(300 * 1024)}`;
        expect(await dtoErrors(CreateEformTicketDto, eformBody({ signatureData: huge }))).toContain('signatureData');
    });

    it('accepts a PNG data URL', async () => {
        expect(await dtoErrors(CreateEformTicketDto, eformBody())).not.toContain('signatureData');
    });
});
