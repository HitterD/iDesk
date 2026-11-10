import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import { PATH_METADATA } from '@nestjs/common/constants';
import { validate } from 'class-validator';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { ConfirmTemplateRatersDto, SetTemplateRaterAccountsDto } from '../dto/template.dto';
import { CsiAdminTemplateController } from './csi-admin-template.controller';

const ID = '12345678-1234-4234-8234-123456789012';
const request = { csiScope: ServiceScope.HC, user: { userId: ID } };

describe('CsiAdminTemplateController bulk contracts', () => {
    it('declares specific routes before parameter routes', () => {
        const methods = Object.getOwnPropertyNames(CsiAdminTemplateController.prototype);
        const path = (method: string) => Reflect.getMetadata(PATH_METADATA, (CsiAdminTemplateController.prototype as any)[method]);
        expect(path('accountSuggestions')).toBe(':id/account-suggestions');
        expect(path('setRaterAccounts')).toBe('raters/account');
        expect(path('confirmRaters')).toBe('raters/confirm');
        expect(methods.indexOf('accountSuggestions')).toBeLessThan(methods.indexOf('get'));
        expect(methods.indexOf('setRaterAccounts')).toBeLessThan(methods.indexOf('setRaterAccount'));
        expect(methods.indexOf('confirmRaters')).toBeLessThan(methods.indexOf('setRaterAccount'));
    });

    it('forwards actor on account additions, single pins and bulk changes', () => {
        const templates = { addRater: jest.fn(), setRaterAccount: jest.fn(), setRaterAccounts: jest.fn(), confirmRaters: jest.fn() };
        const controller = new CsiAdminTemplateController(templates as any, {} as any);
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
});
