import { ConflictException, type ExecutionContext } from '@nestjs/common';
import { NotInRequestFlowGuard } from './not-in-request-flow.guard';

const context = (params: Record<string, string>) => ({ switchToHttp: () => ({ getRequest: () => ({ params }) }) }) as unknown as ExecutionContext;
const ID = '0b6d3c4e-1111-4222-8333-444455556677';

describe('NotInRequestFlowGuard', () => {
    it('lets a legacy request (no request_flows row) through', async () => {
        const has = jest.fn(async () => false);
        await expect(new NotInRequestFlowGuard({ has } as never).canActivate(context({ id: ID }))).resolves.toBe(true);
        expect(has).toHaveBeenCalledWith(ID);
    });

    it('refuses a request that lives on a ticket: the ticket page is the only way to act on it', async () => {
        const guard = new NotInRequestFlowGuard({ has: jest.fn(async () => true) } as never);
        await expect(guard.canActivate(context({ id: ID }))).rejects.toBeInstanceOf(ConflictException);
    });

    it('a route without an id is not this guard\'s business', async () => {
        const has = jest.fn(async () => true);
        await expect(new NotInRequestFlowGuard({ has } as never).canActivate(context({}))).resolves.toBe(true);
        expect(has).not.toHaveBeenCalled();
    });
});
