import { UserCrudService } from './user-crud.service';

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
            {} as any, // permissionsService
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

        await service.createAgent({ email: 'agent@b.com', fullName: 'Agent', password: 'pass1234' } as any);

        expect(created.mustChangePassword).toBe(true);
    });
});
