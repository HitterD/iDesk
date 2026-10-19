import { IpopAccountLinker } from './ipop-account-linker.service';

describe('IpopAccountLinker', () => {
    const users = { findByEmployeeId: jest.fn(), findByEmail: jest.fn(), update: jest.fn() } as any;
    const audit = { log: jest.fn(), logAsync: jest.fn() } as any;
    const linker = new IpopAccountLinker(users, audit);
    const identity = { sub: 's1', nik: '00012345', name: 'Bagas', email: 'bagas@santos.co.id' };
    const account = (over: Record<string, unknown> = {}) => ({
        id: 'u1', email: 'bagas@santos.co.id', fullName: 'Bagas', role: 'USER', isActive: true, mustChangePassword: false,
        employeeId: '00012345', password: 'hash', ...over,
    });

    beforeEach(() => jest.clearAllMocks());

    it('matches by HRIS NIK', async () => {
        users.findByEmployeeId.mockResolvedValue(account());

        await expect(linker.resolve(identity)).resolves.toMatchObject({ ok: true, user: { id: 'u1' } });
        expect(users.findByEmployeeId).toHaveBeenCalledWith('00012345');
    });

    it('never matches or links by email, even when the email is the same', async () => {
        users.findByEmployeeId.mockResolvedValue(undefined);
        users.findByEmail.mockResolvedValue(account({ employeeId: null }));

        await expect(linker.resolve(identity)).resolves.toEqual({ ok: false, reason: 'NOT_LINKED' });
        expect(users.findByEmail).not.toHaveBeenCalled();
        expect(users.update).not.toHaveBeenCalled();
        expect(audit.logAsync).toHaveBeenCalledTimes(1);
    });

    it('signs in by NIK even when iPop has no email or a different one', async () => {
        users.findByEmployeeId.mockResolvedValue(account());

        await expect(linker.resolve({ ...identity, email: undefined })).resolves.toMatchObject({ ok: true });
        await expect(linker.resolve({ ...identity, email: 'other@santos.co.id' })).resolves.toMatchObject({ ok: true });
    });

    it('refuses a disabled account', async () => {
        users.findByEmployeeId.mockResolvedValue(account({ isActive: false }));

        await expect(linker.resolve(identity)).resolves.toEqual({ ok: false, reason: 'ACCOUNT_DISABLED' });
    });
});
