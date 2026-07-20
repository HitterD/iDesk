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
            roles: [UserRole.AGENT, UserRole.ADMIN, UserRole.AGENT_OPERATIONAL_SUPPORT],
        });
    });
});
