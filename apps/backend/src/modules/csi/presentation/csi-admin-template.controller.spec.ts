import 'reflect-metadata';
import { ArgumentMetadata, BadRequestException, ValidationPipe } from '@nestjs/common';
import { PATH_METADATA } from '@nestjs/common/constants';
import { validate } from 'class-validator';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { ApplyTemplatesToPeriodDto, ConfirmTemplateRatersDto, CreatePeriodFromTemplatesDto, PreviewPeriodFromTemplatesDto, SetTemplateRaterAccountsDto } from '../dto/template.dto';
import { CsiAssignmentTemplateService } from '../services/csi-assignment-template.service';
import { CsiAdminTemplateController, parseImportOptions } from './csi-admin-template.controller';

const ID = '12345678-1234-4234-8234-123456789012';
const OTHER = '22345678-1234-4234-8234-123456789012';
const request = { csiScope: ServiceScope.HC, user: { userId: ID } };

describe('CsiAdminTemplateController bulk contracts', () => {
    it('declares specific routes before parameter routes', () => {
        const methods = Object.getOwnPropertyNames(CsiAdminTemplateController.prototype);
        const path = (method: string) => Reflect.getMetadata(PATH_METADATA, (CsiAdminTemplateController.prototype as any)[method]);
        expect(path('accountSuggestions')).toBe(':id/account-suggestions');
        expect(path('setRaterAccounts')).toBe('raters/account');
        expect(path('confirmRaters')).toBe('raters/confirm');
        expect(path('blankTemplate')).toBe('blank/:location');
        expect(path('createPeriodFromTemplates')).toBe('create-period');
        expect(path('previewPeriod')).toBe('preview-period');
        expect(path('applyMany')).toBe('apply-many/:periodId');
        expect(methods.indexOf('applyMany')).toBeLessThan(methods.indexOf('get'));
        expect(methods.indexOf('createPeriodFromTemplates')).toBeLessThan(methods.indexOf('createPeriod'));
        expect(methods.indexOf('previewPeriod')).toBeLessThan(methods.indexOf('get'));
        expect(methods.indexOf('blankTemplate')).toBeLessThan(methods.indexOf('get'));
        expect(methods.indexOf('accountSuggestions')).toBeLessThan(methods.indexOf('get'));
        expect(methods.indexOf('setRaterAccounts')).toBeLessThan(methods.indexOf('setRaterAccount'));
        expect(methods.indexOf('confirmRaters')).toBeLessThan(methods.indexOf('setRaterAccount'));
    });

    it('forwards actor on account additions, single pins and bulk changes', () => {
        const templates = { addRater: jest.fn(), setRaterAccount: jest.fn(), setRaterAccounts: jest.fn(), confirmRaters: jest.fn() };
        const controller = new CsiAdminTemplateController(templates as any, {} as any, {} as any);
        controller.addRater(request, ID, { userId: ID });
        controller.setRaterAccount(request, ID, { userId: ID });
        controller.setRaterAccounts(request, { raterIds: [ID], userId: null });
        controller.confirmRaters(request, { raterIds: [ID], confirmed: true });
        expect(templates.addRater).toHaveBeenCalledWith(ServiceScope.HC, ID, { userId: ID }, ID);
        expect(templates.setRaterAccount).toHaveBeenCalledWith(ServiceScope.HC, ID, ID, ID);
        expect(templates.setRaterAccounts).toHaveBeenCalledWith(ServiceScope.HC, [ID], null, ID);
        expect(templates.confirmRaters).toHaveBeenCalledWith(ServiceScope.HC, [ID], true, ID);
        expect(() => controller.confirmRaters({ ...request, csiScope: ServiceScope.ICT }, { raterIds: [ID], confirmed: true })).toThrow(BadRequestException);
    });

    it('validates UUID v4 selections, array bounds, boolean and nullable optional userId', async () => {
        const accountDto = (value: object) => Object.assign(new SetTemplateRaterAccountsDto(), value);
        const confirmDto = (value: object) => Object.assign(new ConfirmTemplateRatersDto(), value);
        expect(await validate(accountDto({ raterIds: [ID], userId: null }))).toEqual([]);
        expect(await validate(accountDto({ raterIds: [ID] }))).toEqual([]);
        expect(await validate(confirmDto({ raterIds: Array(2000).fill(ID), confirmed: false }))).toEqual([]);
        for (const raterIds of [[], ['bad'], ['12345678-1234-1234-8234-123456789012'], Array(2001).fill(ID), ID]) {
            expect((await validate(confirmDto({ raterIds, confirmed: true }))).length).toBeGreaterThan(0);
        }
        expect((await validate(accountDto({ raterIds: [ID], userId: 'bad' }))).length).toBeGreaterThan(0);
        expect((await validate(confirmDto({ raterIds: [ID], confirmed: 'true' }))).length).toBeGreaterThan(0);
    });

    it('import reads the options field, honours legacy ?commit and refuses invalid options', async () => {
        const importer = { importExcel: jest.fn(async () => ({})) };
        const controller = new CsiAdminTemplateController({} as any, {} as any, importer as any);
        const file = { buffer: Buffer.from('x') } as Express.Multer.File;
        const resolutions = { 'Erna Wati': { as: 'rename', picName: 'ERNA' }, 'TIM A': { as: 'team' } };
        await controller.importExcel(request, 'krw', file, JSON.stringify({ commit: true, prune: true, resolutions }), 'false');
        expect(importer.importExcel).toHaveBeenLastCalledWith(ServiceScope.HC, 'krw', file.buffer, {
            commit: true, prune: true, pruneConfirmed: false, resolutions: { 'Erna Wati': { as: 'rename', picName: 'ERNA' }, 'TIM A': { as: 'team' } },
        });
        await controller.importExcel(request, 'krw', file, undefined, 'true');
        expect(importer.importExcel).toHaveBeenLastCalledWith(ServiceScope.HC, 'krw', file.buffer, { commit: true, prune: false, pruneConfirmed: false, resolutions: {} });
        for (const raw of ['{bad', '[]', '{"commit":"yes"}', '{"extra":1}', '{"resolutions":{"X":{"as":"rename"}}}', '{"resolutions":{"X":{"as":"drop"}}}']) {
            await expect(parseImportOptions(raw)).rejects.toThrow('Opsi impor tidak valid');
        }
        await expect(controller.importExcel(request, 'krw', {} as Express.Multer.File)).rejects.toThrow('File Excel wajib diunggah');
        await expect(controller.importExcel({ ...request, csiScope: ServiceScope.ICT }, 'krw', file)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('blank template downloads as an attachment for SMG and refuses unknown locations and ICT', async () => {
        const users = { find: jest.fn(async () => [{ fullName: 'ELVI CYNTHIA', jobTitle: null, employeeId: null }]) };
        const service = new CsiAssignmentTemplateService({} as any, {} as any, {} as any, {} as any, users as any, {} as any, {} as any, {} as any);
        const controller = new CsiAdminTemplateController(service, {} as any, {} as any);
        const res = { set: jest.fn(), send: jest.fn() };
        await controller.blankTemplate(request, 'SMG', res as any);
        expect(res.set).toHaveBeenCalledWith({
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': 'attachment; filename="CSI HC Semarang - template.xlsx"',
        });
        expect(res.send).toHaveBeenCalledWith(expect.any(Buffer));
        await expect(controller.blankTemplate(request, 'XXX', res as any)).rejects.toThrow(new BadRequestException('Lokasi tidak dikenal'));
        await expect(controller.blankTemplate({ ...request, csiScope: ServiceScope.ICT }, 'SMG', res as any)).rejects.toBeInstanceOf(BadRequestException);
        expect(res.send).toHaveBeenCalledTimes(1);
    });
    it('create-period and preview-period forward 1-4 unique template ids; the legacy route delegates with [id]', async () => {
        const applier = { createPeriodFromTemplates: jest.fn(), previewPeriod: jest.fn() };
        const controller = new CsiAdminTemplateController({} as any, applier as any, {} as any);
        const period = { title: 'CSI HC 2026', startDate: '2026-12-01', endDate: '2026-12-31' };
        controller.createPeriodFromTemplates(request, { ...period, templateIds: [ID, OTHER] });
        expect(applier.createPeriodFromTemplates).toHaveBeenLastCalledWith(ServiceScope.HC, [ID, OTHER], period, ID);
        controller.createPeriod(request, ID, period);
        expect(applier.createPeriodFromTemplates).toHaveBeenLastCalledWith(ServiceScope.HC, [ID], period, ID);
        controller.previewPeriod(request, { templateIds: [ID] });
        expect(applier.previewPeriod).toHaveBeenCalledWith(ServiceScope.HC, [ID]);
        expect(() => controller.previewPeriod({ ...request, csiScope: ServiceScope.ICT }, { templateIds: [ID] })).toThrow(BadRequestException);

        const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
        const body = (metatype: ArgumentMetadata['metatype']): ArgumentMetadata => ({ type: 'body', metatype });
        await expect(pipe.transform({ templateIds: [ID, OTHER] }, body(PreviewPeriodFromTemplatesDto))).resolves.toBeDefined();
        await expect(pipe.transform({ ...period, templateIds: [ID] }, body(CreatePeriodFromTemplatesDto))).resolves.toBeDefined();
        const ids = (count: number) => ['1', '2', '3', '4', '5', '6'].slice(0, count).map((digit) => `${digit}2345678-1234-4234-8234-123456789012`);
        await expect(pipe.transform({ templateIds: ids(5) }, body(PreviewPeriodFromTemplatesDto))).resolves.toBeDefined();
        await expect(pipe.transform({ ...period, templateIds: ids(5) }, body(CreatePeriodFromTemplatesDto))).resolves.toBeDefined();
        for (const templateIds of [[], ids(6), [ID, ID], ['bad'], undefined]) {
            await expect(pipe.transform({ templateIds }, body(PreviewPeriodFromTemplatesDto))).rejects.toBeInstanceOf(BadRequestException);
            await expect(pipe.transform({ ...period, templateIds }, body(CreatePeriodFromTemplatesDto))).rejects.toBeInstanceOf(BadRequestException);
        }
    });

    it('apply-many forwards template ids, commit and replaceNonPic; validates the body; ICT refused', async () => {
        const applier = { applyManyToPeriod: jest.fn() };
        const controller = new CsiAdminTemplateController({} as any, applier as any, {} as any);
        controller.applyMany(request, OTHER, { templateIds: [ID], replaceNonPic: true }, 'true');
        expect(applier.applyManyToPeriod).toHaveBeenLastCalledWith(ServiceScope.HC, [ID], OTHER, true, true);
        controller.applyMany(request, OTHER, { templateIds: [ID, OTHER] });
        expect(applier.applyManyToPeriod).toHaveBeenLastCalledWith(ServiceScope.HC, [ID, OTHER], OTHER, false, false);
        expect(() => controller.applyMany({ ...request, csiScope: ServiceScope.ICT }, OTHER, { templateIds: [ID] })).toThrow(BadRequestException);

        const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
        const body: ArgumentMetadata = { type: 'body', metatype: ApplyTemplatesToPeriodDto };
        await expect(pipe.transform({ templateIds: [ID], replaceNonPic: false }, body)).resolves.toBeDefined();
        for (const value of [{ templateIds: [] }, { templateIds: [ID, ID] }, { templateIds: [ID], replaceNonPic: 'yes' }]) {
            await expect(pipe.transform(value, body)).rejects.toBeInstanceOf(BadRequestException);
        }
    });
});
