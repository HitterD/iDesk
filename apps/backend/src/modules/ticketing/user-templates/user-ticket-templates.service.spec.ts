import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UserTicketTemplatesService } from './user-ticket-templates.service';
import { UserTicketTemplate } from './user-ticket-template.entity';
import { USER_TEMPLATE_MAX_PER_USER } from './user-ticket-template.constants';
import { TicketPriority } from '../entities/ticket.entity';

describe('UserTicketTemplatesService', () => {
    const owned: UserTicketTemplate = {
        id: 'tpl-1', userId: 'u-1', ticketType: 'service', label: 'Reset VPN', title: 'Reset akun VPN mingguan',
        description: 'Mohon reset VPN', priority: TicketPriority.MEDIUM, category: 'NETWORK', device: null, software: null,
    } as UserTicketTemplate;
    let repo: Record<string, jest.Mock>;
    let labelTaken: number;
    let service: UserTicketTemplatesService;

    beforeEach(() => {
        labelTaken = 0;
        const qb: any = { where: jest.fn(() => qb), andWhere: jest.fn(() => qb), getCount: jest.fn(async () => labelTaken) };
        repo = {
            find: jest.fn(async () => [owned]),
            count: jest.fn(async () => 0),
            create: jest.fn((value) => value),
            save: jest.fn(async (value) => ({ id: 'tpl-new', ...value })),
            findOne: jest.fn(async ({ where }) => (where.id === owned.id && where.userId === owned.userId ? { ...owned } : null)),
            remove: jest.fn(async () => undefined),
            createQueryBuilder: jest.fn(() => qb),
        };
        service = new UserTicketTemplatesService(repo as any);
    });

    const dto = {
        ticketType: 'service' as const, label: 'Laporan bulanan', title: 'Akses folder laporan bulanan',
        description: 'Mohon buka akses folder', priority: TicketPriority.LOW, category: 'GENERAL',
    };

    it('lists only the caller templates, filtered by form when asked', async () => {
        await service.list('u-1', 'service');
        expect(repo.find).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'u-1', ticketType: 'service' } }));
        await service.list('u-1');
        expect(repo.find).toHaveBeenLastCalledWith(expect.objectContaining({ where: { userId: 'u-1' } }));
    });

    it('saves a template owned by the caller with empty optional fields as null', async () => {
        const saved = await service.create('u-1', dto);
        expect(saved).toMatchObject({ userId: 'u-1', label: 'Laporan bulanan', device: null, software: null, category: 'GENERAL' });
    });

    it(`refuses more than ${USER_TEMPLATE_MAX_PER_USER} templates per user`, async () => {
        repo.count.mockResolvedValue(USER_TEMPLATE_MAX_PER_USER);
        await expect(service.create('u-1', dto)).rejects.toBeInstanceOf(BadRequestException);
        expect(repo.save).not.toHaveBeenCalled();
    });

    it('refuses a duplicate chip name on the same form', async () => {
        labelTaken = 1;
        await expect(service.create('u-1', dto)).rejects.toThrow('sudah ada');
    });

    it('updates only the fields sent and keeps the form type', async () => {
        const saved = await service.update('u-1', 'tpl-1', { title: 'Reset akun VPN bulanan' });
        expect(saved).toMatchObject({ title: 'Reset akun VPN bulanan', label: 'Reset VPN', ticketType: 'service' });
    });

    it("cannot see, edit or delete someone else's template", async () => {
        await expect(service.update('u-2', 'tpl-1', { label: 'X1' })).rejects.toBeInstanceOf(NotFoundException);
        await expect(service.remove('u-2', 'tpl-1')).rejects.toBeInstanceOf(NotFoundException);
        expect(repo.remove).not.toHaveBeenCalled();
    });

    it('deletes the caller template', async () => {
        await expect(service.remove('u-1', 'tpl-1')).resolves.toEqual({ success: true });
        expect(repo.remove).toHaveBeenCalled();
    });
});
