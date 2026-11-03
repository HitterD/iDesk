import { BadRequestException } from '@nestjs/common';
import { ReportSignoffService } from './report-signoff.service';

const layout = (name: string) => ({ columns: 3, slots: [{ title: 'T', name }] });

describe('ReportSignoffService', () => {
    let rows: Record<string, any>;
    let repo: any;
    let service: ReportSignoffService;

    beforeEach(() => {
        rows = {};
        repo = {
            findOne: jest.fn(async ({ where }: any) => rows[where.key] ?? null),
            create: jest.fn((v: any) => v),
            save: jest.fn(async (v: any) => { rows[v.key] = v; return v; }),
            delete: jest.fn(async ({ key }: any) => { delete rows[key]; }),
        };
        service = new ReportSignoffService(repo);
    });

    it('returns nothing when no default is saved', async () => {
        expect(await service.resolve('monthly', 'site-1')).toBeUndefined();
    });

    it('prefers the site default over the all-sites one', async () => {
        rows['reports.signoff.monthly.ALL'] = { value: layout('Semua') };
        rows['reports.signoff.monthly.site-1'] = { value: layout('Site 1') };
        expect((await service.resolve('monthly', 'site-1'))?.slots[0].name).toBe('Site 1');
        expect((await service.resolve('monthly', 'site-2'))?.slots[0].name).toBe('Semua');
    });

    it('saves a sanitised layout under the site key, and updates it in place', async () => {
        await service.save('agent-performance', 'site-1', { columns: 9, slots: [{ title: ' T ', name: 'A' }] }, 'u1');
        expect(rows['reports.signoff.agent-performance.site-1'].value.columns).toBe(4);
        await service.save('agent-performance', 'site-1', layout('B'), 'u2');
        expect(rows['reports.signoff.agent-performance.site-1'].value.slots[0].name).toBe('B');
        expect(rows['reports.signoff.agent-performance.site-1'].updatedBy).toBe('u2');
    });

    it('rejects something that is not a layout', async () => {
        await expect(service.save('monthly', null, { nope: true })).rejects.toBeInstanceOf(BadRequestException);
    });

    it('resets to the built-in default', async () => {
        await service.save('monthly', 'site-1', layout('A'));
        await service.reset('monthly', 'site-1');
        expect(await service.resolve('monthly', 'site-1')).toBeUndefined();
    });
});
