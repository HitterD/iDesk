import { RequestFlowMembership } from './request-flow-membership.service';

describe('RequestFlowMembership', () => {
    const setup = (query: jest.Mock) => new RequestFlowMembership({ query } as never);

    it('is true when a request_flows row points at the request', async () => {
        const query = jest.fn(async () => [{ '?column?': 1 }]);
        await expect(setup(query).has('r1')).resolves.toBe(true);
        expect(query).toHaveBeenCalledWith(expect.stringContaining('request_flows'), ['r1']);
    });

    it('is false when none does', async () => {
        await expect(setup(jest.fn(async () => [])).has('r1')).resolves.toBe(false);
    });

    it('falls back to "not a flow" (legacy behaviour) when the lookup fails', async () => {
        await expect(setup(jest.fn(async () => { throw new Error('connection reset'); })).has('r1')).resolves.toBe(false);
    });
});
