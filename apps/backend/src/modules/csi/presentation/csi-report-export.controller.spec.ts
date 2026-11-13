import 'reflect-metadata';
import { GUARDS_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { JwtAuthGuard } from '../../auth/infrastructure/guards/jwt-auth.guard';
import { CsiAdminGuard } from '../guards/csi-admin.guard';
import { CsiAdminReportController } from './csi-admin-report.controller';
import { CsiMeReportController } from './csi-me-report.controller';

const ID = '12345678-1234-4234-8234-123456789012';
const file = { filename: 'csi-hc - DATA MENTAH (RAHASIA).xlsx', buffer: Buffer.from('x') };
const response = () => ({ setHeader: jest.fn(), send: jest.fn() });
const path = (target: object, method: string) => Reflect.getMetadata(PATH_METADATA, (target as any)[method]);

describe('CSI report export endpoints', () => {
    it('admin raw export lives next to the main export, behind the same admin guard', async () => {
        expect(Reflect.getMetadata(GUARDS_METADATA, CsiAdminReportController)).toEqual([JwtAuthGuard, CsiAdminGuard]);
        expect(path(CsiAdminReportController.prototype, 'export')).toBe('export');
        expect(path(CsiAdminReportController.prototype, 'exportRaw')).toBe('export-raw');
        const exporter = { buildRawWorkbook: jest.fn(async () => file) };
        const controller = new CsiAdminReportController({} as any, exporter as any, {} as any);
        const res = response();
        await controller.exportRaw({ csiScope: ServiceScope.HC, user: { userId: 'u' } } as any, ID, res as any);
        expect(exporter.buildRawWorkbook).toHaveBeenCalledWith(ServiceScope.HC, ID, expect.any(Date));
        expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', `attachment; filename="${file.filename}"`);
        expect(res.send).toHaveBeenCalledWith(file.buffer);
    });

    it('admin Excel export forwards both siteId filter and notes to buildWorkbook', async () => {
        const xlsx = { filename: 'csi-ict.xlsx', buffer: Buffer.from('xlsx') };
        const exporter = { buildWorkbook: jest.fn(async () => xlsx) };
        const controller = new CsiAdminReportController({} as any, exporter as any, {} as any);
        const res = response();
        await controller.export({ csiScope: ServiceScope.ICT, user: { userId: 'u' } } as any, ID, { siteId: 'site-skd', notes: 'Catatan' }, res as any);
        expect(exporter.buildWorkbook).toHaveBeenCalledWith(ServiceScope.ICT, ID, expect.any(Date), { siteId: 'site-skd', notes: 'Catatan' });
        expect(res.send).toHaveBeenCalledWith(xlsx.buffer);
    });

    it('service-owner raw export goes through the owner-checked service with the caller id', async () => {
        expect(path(CsiMeReportController.prototype, 'exportRaw')).toBe('periods/:id/services/:serviceCode/export-raw');
        const reports = { exportRawWorkbook: jest.fn(async () => file) };
        const controller = new CsiMeReportController({} as any, reports as any);
        const res = response();
        await controller.exportRaw({ user: { userId: 'u-rara' } }, 'hc', ID, 'HCD', res as any);
        expect(reports.exportRawWorkbook).toHaveBeenCalledWith('u-rara', ID, 'HCD', ServiceScope.HC);
        expect(res.send).toHaveBeenCalledWith(file.buffer);
    });
});
