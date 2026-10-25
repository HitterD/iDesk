import { BadRequestException, ConflictException } from '@nestjs/common';
import { IntegrationAppsService } from '../integration-apps.service';
import { APP_PERMISSIONS } from '../integration-app.constants';

describe('IntegrationAppsService', () => {
    let rows: any[];
    let repo: any;
    const cipher = { encrypt: (s: string) => `enc(${s})`, decrypt: (s: string) => s.slice(4, -1) };
    const catalog = { listModules: jest.fn(async () => [{ slug: 'it-support' }, { slug: 'web-developer' }]) };
    let service: IntegrationAppsService;
    const dto = { clientId: 'EBBK', name: 'EBBK', modules: ['web-developer'], permissions: [APP_PERMISSIONS.TICKETS_CREATE, APP_PERMISSIONS.TICKETS_CREATE] };

    beforeEach(() => {
        rows = [];
        repo = {
            exists: jest.fn(async ({ where }: any) => rows.some((r) => r.clientId === where.clientId)),
            create: (r: any) => r,
            save: jest.fn(async (r: any) => { const row = { id: r.id ?? `id-${rows.length + 1}`, ...r }; rows = rows.filter((x) => x.id !== row.id).concat(row); return row; }),
            findOne: jest.fn(async ({ where }: any) => rows.find((r) => (where.id ? r.id === where.id : r.clientId === where.clientId)) ?? null),
            find: jest.fn(async () => rows),
            update: jest.fn(),
            delete: jest.fn(),
        };
        service = new IntegrationAppsService(repo, cipher as any, catalog as any);
    });

    it('issues a secret once, stores it encrypted and normalises the app', async () => {
        const { app, secret } = await service.create(dto as any, 'admin-1');

        expect(secret).toMatch(/^[A-Za-z0-9_-]{43}$/);
        expect(rows[0].secretCipher).toBe(`enc(${secret})`);
        expect(app).toEqual(expect.objectContaining({ clientId: 'ebbk', secretHint: secret.slice(-4), permissions: ['tickets:create'] }));
        expect(app).not.toHaveProperty('secretCipher');
    });

    it('refuses reserved, duplicate ids and unknown modules', async () => {
        await expect(service.create({ ...dto, clientId: 'ipop' } as any, 'a')).rejects.toBeInstanceOf(BadRequestException);
        await service.create(dto as any, 'a');
        await expect(service.create(dto as any, 'a')).rejects.toBeInstanceOf(ConflictException);
        await expect(service.create({ ...dto, clientId: 'other', modules: ['payroll'] } as any, 'a')).rejects.toThrow('payroll');
    });

    it('resolves the active app with its secret, and forgets it once disabled', async () => {
        const { app, secret } = await service.create(dto as any, 'a');
        await expect(service.resolveActive('EBBK')).resolves.toEqual(expect.objectContaining({ secret }));

        await service.update(app.id, { isActive: false });
        await expect(service.resolveActive('ebbk')).resolves.toBeNull();
    });

    it('rotating replaces the secret right away', async () => {
        const { app, secret } = await service.create(dto as any, 'a');
        await service.resolveActive('ebbk');
        const rotated = await service.rotateSecret(app.id);

        expect(rotated.secret).not.toBe(secret);
        await expect(service.resolveActive('ebbk')).resolves.toEqual(expect.objectContaining({ secret: rotated.secret }));
    });

    it('stores the badge colour and lists sources without any secret', async () => {
        const { app } = await service.create({ ...dto, name: 'E-BBK', color: 'amber' } as any, 'a');
        expect(app.color).toBe('amber');

        await service.update(app.id, { color: null });
        await expect(service.listSources()).resolves.toEqual([{ source: 'EBBK', name: 'E-BBK', color: null }]);
    });
});
