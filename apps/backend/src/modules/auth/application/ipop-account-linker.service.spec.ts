import { IpopAccountLinker } from './ipop-account-linker.service';

describe('IpopAccountLinker', () => {
    const users = { findByEmployeeId: jest.fn(), findByEmail: jest.fn(), update: jest.fn() } as any;
    const audit = { log: jest.fn(), logAsync: jest.fn() } as any;
    const linker = new IpopAccountLinker(users, audit);
    const identity = { sub: 's1', nik: '00012345', name: 'Bagas', email: 'bagas@santos.co.id' };
    const account = (over: Record<string, unknown> = {}) => ({
        id: 'u1', email: 'bagas@santos.co.id', fullName: 'Bagas', role: 'USER', isActive: true, mustChangePassword: false,
        employeeId: null, password: 'hash', ...over,
    });

    beforeEach(() => jest.clearAllMocks());

    it('matches by NIK first', async () => {
        users.findByEmployeeId.mockResolvedValue(account({ employeeId: '00012345' }));

        await expect(linker.resolve(identity)).resolves.toMatchObject({ ok: true, linked: false, user: { id: 'u1' } });
        expect(users.findByEmail).not.toHaveBeenCalled();
        expect(users.update).not.toHaveBeenCalled();
    });

    it('links an account without a NIK once by email and audits it', async () => {
        users.findByEmployeeId.mockResolvedValue(undefined);
        users.findByEmail.mockResolvedValue(account());
        users.update.mockResolvedValue(account({ employeeId: '00012345' }));

        const result = await linker.resolve(identity);

        expect(result).toMatchObject({ ok: true, linked: true, user: { employeeId: '00012345' } });
        expect(users.update).toHaveBeenCalledWith('u1', { employeeId: '00012345' });
        expect(audit.log).toHaveBeenCalledTimes(1);
    });

    it('never overwrites a different NIK', async () => {
        users.findByEmployeeId.mockResolvedValue(undefined);
        users.findByEmail.mockResolvedValue(account({ employeeId: '00099999' }));

        await expect(linker.resolve(identity)).resolves.toEqual({ ok: false, reason: 'NIK_CONFLICT' });
        expect(users.update).not.toHaveBeenCalled();
    });

    it('does not create an account when nothing matches', async () => {
        users.findByEmployeeId.mockResolvedValue(undefined);
        users.findByEmail.mockResolvedValue(undefined);

        await expect(linker.resolve(identity)).resolves.toEqual({ ok: false, reason: 'NOT_LINKED' });
        expect(users.update).not.toHaveBeenCalled();
    });

    it('skips the email match when iPop sends no email', async () => {
        users.findByEmployeeId.mockResolvedValue(undefined);

        await expect(linker.resolve({ ...identity, email: undefined })).resolves.toEqual({ ok: false, reason: 'NOT_LINKED' });
        expect(users.findByEmail).not.toHaveBeenCalled();
    });

    it('refuses a disabled account', async () => {
        users.findByEmployeeId.mockResolvedValue(account({ employeeId: '00012345', isActive: false }));

        await expect(linker.resolve(identity)).resolves.toEqual({ ok: false, reason: 'ACCOUNT_DISABLED' });
    });
});
