import { UserCrudService } from './user-crud.service';
import { UserRole } from './enums/user-role.enum';

describe('UserCrudService.getAgents HRIS roles', () => {
    it('includes operational support but excludes Oracle-only agents', async () => {
        const queryBuilder = {
            leftJoinAndSelect: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            orderBy: jest.fn().mockReturnThis(),
            getMany: jest.fn().mockResolvedValue([]),
        };
        const userRepo = { createQueryBuilder: jest.fn(() => queryBuilder) };
        const service = new UserCrudService(
            userRepo as any,
            {} as any,
            {} as any,
            {} as any,
            {} as any,
            {} as any,
            {} as any,
        );

        await service.getAgents();

        expect(queryBuilder.andWhere).toHaveBeenCalledWith('user.role IN (:...roles)', {
            roles: [
                UserRole.AGENT,
                UserRole.ADMIN,
                UserRole.AGENT_OPERATIONAL_SUPPORT,
                UserRole.AGENT_ADMIN,
            ],
        });
    });

    it('limits Oracle context to Oracle agents and admins', async () => {
        const queryBuilder = {
            leftJoinAndSelect: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            orderBy: jest.fn().mockReturnThis(),
            getMany: jest.fn().mockResolvedValue([]),
        };
        const userRepo = { createQueryBuilder: jest.fn(() => queryBuilder) };
        const service = new UserCrudService(
            userRepo as any,
            {} as any,
            {} as any,
            {} as any,
            {} as any,
            {} as any,
            {} as any,
        );

        await service.getAgents(undefined, UserRole.AGENT_ORACLE);

        expect(queryBuilder.andWhere).toHaveBeenCalledWith('user.role IN (:...roles)', {
            roles: [UserRole.AGENT_ORACLE, UserRole.AGENT_WEB_DEV, UserRole.AGENT_MOBILE_DEV, UserRole.ADMIN],
        });
    });

    it('resolves assigneeRoles from TicketModule by moduleSlug', async () => {
        const queryBuilder = {
            leftJoinAndSelect: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            orderBy: jest.fn().mockReturnThis(),
            getMany: jest.fn().mockResolvedValue([]),
        };
        const userRepo = { createQueryBuilder: jest.fn(() => queryBuilder) };
        const ticketModuleRepo = {
            findOne: jest.fn().mockResolvedValue({
                slug: 'mobile-developer',
                assigneeRoles: [UserRole.ADMIN, UserRole.AGENT_MOBILE_DEV],
            }),
        };
        const service = new UserCrudService(
            userRepo as any,
            {} as any,
            {} as any,
            {} as any,
            {} as any,
            {} as any,
            {} as any,
            ticketModuleRepo as any,
        );

        await service.getAgents(undefined, undefined, undefined, undefined, undefined, 'mobile-developer');

        expect(ticketModuleRepo.findOne).toHaveBeenCalledWith({
            where: { slug: 'mobile-developer', isActive: true },
        });
        expect(queryBuilder.andWhere).toHaveBeenCalledWith('user.role IN (:...roles)', {
            roles: [UserRole.ADMIN, UserRole.AGENT_MOBILE_DEV],
        });
    });
});

describe('UserCrudService mustChangePassword on create', () => {
    let service: UserCrudService;

    beforeEach(() => {
        service = new UserCrudService(
            {} as any, // userRepo
            {} as any, // ticketRepo
            {} as any, // siteRepo
            {} as any, // departmentRepo
            {} as any, // mailerService
            { logAsync: jest.fn() } as any, // auditService
            { resolveDefaultPresetId: jest.fn().mockResolvedValue(null), applyPresetToUser: jest.fn() } as any, // permissionsService
        );
    });

    it('createUser menandai mustChangePassword true', async () => {
        const created: any = {};
        (service as any).userRepo.create = jest.fn((v: any) => { Object.assign(created, v); return created; });
        (service as any).userRepo.save = jest.fn(async (v: any) => ({ id: 'u1', ...v }));
        (service as any).userRepo.findOne = jest.fn(async () => null);

        await service.createUser({ email: 'a@b.com', fullName: 'A', role: 'USER' } as any);

        expect(created.mustChangePassword).toBe(true);
    });

    it('createAgent menandai mustChangePassword true', async () => {
        const created: any = {};
        (service as any).userRepo.create = jest.fn((v: any) => { Object.assign(created, v); return created; });
        (service as any).userRepo.save = jest.fn(async (v: any) => ({ id: 'u1', ...v }));
        (service as any).userRepo.findOne = jest.fn(async () => null);

        await service.createAgent({ email: 'agent@b.com', fullName: 'Agent', password: 'Pass1234' } as any);

        expect(created.mustChangePassword).toBe(true);
    });
});
