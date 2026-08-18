import { UserCrudService } from './user-crud.service';
import { UserRole } from './enums/user-role.enum';

const makeQueryBuilder = (overrides: Record<string, unknown> = {}) => {
    const queryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
        getMany: jest.fn().mockResolvedValue([]),
        getRawMany: jest.fn().mockResolvedValue([]),
        ...overrides,
    };

    return queryBuilder;
};

describe('UserCrudService list filter scopes', () => {
    it('returns role and site counts from the active search scope', async () => {
        const dataQb = makeQueryBuilder({
            getManyAndCount: jest.fn().mockResolvedValue([[{ id: 'user-1' }], 1]),
        });
        const roleCountsQb = makeQueryBuilder({
            getRawMany: jest.fn().mockResolvedValue([
                { role: UserRole.AGENT, count: '3' },
                { role: UserRole.USER, count: '7' },
            ]),
        });
        const siteCountsQb = makeQueryBuilder({
            getRawMany: jest.fn().mockResolvedValue([
                { siteCode: 'JKT', count: '6' },
                { siteCode: 'SMG', count: '4' },
            ]),
        });
        const userRepo = {
            createQueryBuilder: jest.fn()
                .mockReturnValueOnce(dataQb)
                .mockReturnValueOnce(roleCountsQb)
                .mockReturnValueOnce(siteCountsQb),
        };
        const service = new UserCrudService(
            userRepo as never,
            {} as never,
            {} as never,
            {} as never,
            {} as never,
            {} as never,
            {} as never,
        );

        const result = await service.findAll({
            search: 'budi',
            siteCode: 'JKT',
            role: UserRole.AGENT,
        });

        expect(result.meta.roleCounts).toEqual({
            [UserRole.AGENT]: 3,
            [UserRole.USER]: 7,
        });
        expect(result.meta.siteCounts).toEqual({ JKT: 6, SMG: 4 });
        expect(roleCountsQb.andWhere).toHaveBeenCalledWith(
            '(user.fullName ILIKE :search OR user.email ILIKE :search)',
            { search: '%budi%' },
        );
        expect(roleCountsQb.andWhere).toHaveBeenCalledWith('site.code = :siteCode', { siteCode: 'JKT' });
        expect(roleCountsQb.andWhere).not.toHaveBeenCalledWith('user.role = :role', { role: UserRole.AGENT });
        expect(siteCountsQb.andWhere).toHaveBeenCalledWith('user.role = :role', { role: UserRole.AGENT });
        expect(siteCountsQb.andWhere).not.toHaveBeenCalledWith('site.code = :siteCode', { siteCode: 'JKT' });
    });

    it('applies search, site, and role filters to agent stats', async () => {
        const agentQb = makeQueryBuilder({ getMany: jest.fn().mockResolvedValue([]) });
        const userRepo = { createQueryBuilder: jest.fn().mockReturnValue(agentQb) };
        const service = new UserCrudService(
            userRepo as never,
            {} as never,
            {} as never,
            {} as never,
            {} as never,
            {} as never,
            {} as never,
        );

        await (service as any).getAgentStats({
            search: 'budi',
            siteCode: 'JKT',
            role: UserRole.AGENT_OPERATIONAL_SUPPORT,
        });

        expect(agentQb.andWhere).toHaveBeenCalledWith(
            '(user.fullName ILIKE :search OR user.email ILIKE :search)',
            { search: '%budi%' },
        );
        expect(agentQb.andWhere).toHaveBeenCalledWith('site.code = :siteCode', { siteCode: 'JKT' });
        expect(agentQb.andWhere).toHaveBeenCalledWith('user.role = :role', {
            role: UserRole.AGENT_OPERATIONAL_SUPPORT,
        });
    });

    it('applies resolved default preset after admin creates a user without presetId', async () => {
        const userRepo = {
            findOne: jest.fn().mockResolvedValue(null),
            create: jest.fn((entity) => entity),
            save: jest.fn(async (entity) => ({ id: 'user-1', ...entity })),
        };
        const permissionsService = {
            resolveDefaultPresetId: jest.fn().mockResolvedValue('oracle-preset'),
            applyPresetToUser: jest.fn().mockResolvedValue({ applied: true, presetName: 'Agent Oracle' }),
        };
        const service = new UserCrudService(
            userRepo as never,
            {} as never,
            {} as never,
            {} as never,
            { send: jest.fn() } as never,
            { logAsync: jest.fn() } as never,
            permissionsService as never,
        );

        const createdUser = await service.createUser({
            fullName: 'New User',
            email: 'new@example.com',
            role: UserRole.AGENT_ORACLE,
            autoGeneratePassword: true,
        });

        expect(permissionsService.resolveDefaultPresetId).toHaveBeenCalledWith(UserRole.AGENT_ORACLE);
        expect(permissionsService.applyPresetToUser).toHaveBeenCalledWith('user-1', 'oracle-preset');
        expect(createdUser).toMatchObject({ appliedPresetId: 'oracle-preset', appliedPresetName: 'Agent Oracle' });
    });
});
