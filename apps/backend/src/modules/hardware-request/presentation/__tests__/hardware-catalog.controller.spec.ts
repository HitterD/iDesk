import { HardwareCatalogController } from '../hardware-catalog.controller';

function setup() {
    const service = { listActive: jest.fn(async () => [{ id: 'a' }]), listAll: jest.fn(async () => [{ id: 'a' }, { id: 'hidden' }]) };
    return { controller: new HardwareCatalogController(service as never), service };
}

describe('HardwareCatalogController.list', () => {
    it('ICT staff can ask for the hidden items too (the catalog page)', async () => {
        const { controller, service } = setup();
        const res = await controller.list({ user: { role: 'AGENT_OPERATIONAL_SUPPORT' } }, 'true');
        expect(service.listAll).toHaveBeenCalled();
        expect(res.data).toHaveLength(2);
    });

    it('a requester asking for includeInactive still gets only the items shown in the form', async () => {
        const { controller, service } = setup();
        const res = await controller.list({ user: { role: 'USER' } }, 'true');
        expect(service.listAll).not.toHaveBeenCalled();
        expect(res.data).toEqual([{ id: 'a' }]);
    });

    it('without includeInactive everyone gets the active list', async () => {
        const { controller, service } = setup();
        await controller.list({ user: { role: 'AGENT' } });
        expect(service.listActive).toHaveBeenCalled();
        expect(service.listAll).not.toHaveBeenCalled();
    });
});
