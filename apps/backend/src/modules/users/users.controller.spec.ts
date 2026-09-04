import { UsersController } from './users.controller';
import { UserRole } from './enums/user-role.enum';

describe('UsersController Oracle assignee scope', () => {
    it('restricts AGENT_ORACLE agent lookup to Oracle agents and admins', async () => {
        const usersService = { getAgents: jest.fn().mockResolvedValue([]) };
        const controller = new UsersController(usersService as never, {} as never);

        await (controller as any).getAgents(
            undefined,
            'ORACLE_REQUEST',
            'ORACLE_REQUEST',
            { user: { role: UserRole.AGENT_ORACLE } },
        );

        expect(usersService.getAgents).toHaveBeenCalledWith(
            undefined,
            UserRole.AGENT_ORACLE,
            'ORACLE_REQUEST',
            'ORACLE_REQUEST',
            undefined,
            undefined,
        );
    });
});
