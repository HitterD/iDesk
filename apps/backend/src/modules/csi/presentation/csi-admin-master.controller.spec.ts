import 'reflect-metadata';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { CsiMasterService } from '../services/csi-master.service';
import { GUARDS_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { JwtAuthGuard } from '../../auth/infrastructure/guards/jwt-auth.guard';
import { CsiAdminGuard } from '../guards/csi-admin.guard';
import { CsiAdminMasterController } from './csi-admin-master.controller';
import { CreateDimensionDto } from '../dto/master.dto';

describe('CSI admin master HTTP validation', () => {
    let app: INestApplication;
    const master = {
        listDimensions: jest.fn().mockResolvedValue([]), updateDimension: jest.fn(), searchUsers: jest.fn().mockResolvedValue([]),
        reorderDimensions: jest.fn().mockResolvedValue([{ id: 'a' }]), reorderDepartments: jest.fn().mockResolvedValue([{ id: 'b' }]),
        createTemplateDimensions: jest.fn().mockResolvedValue([{ id: 't' }]),
    };
    beforeAll(async () => {
        const module = await Test.createTestingModule({
            controllers: [CsiAdminMasterController], providers: [{ provide: CsiMasterService, useValue: master }],
        }).overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
            .overrideGuard(CsiAdminGuard).useValue({ canActivate: (context: any) => {
                context.switchToHttp().getRequest().csiScope = ServiceScope.HC;
                return true;
            } }).compile();
        app = module.createNestApplication();
        app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
        await app.init();
    });
    afterAll(async () => { await app?.close(); });

    it('applies transformed query DTOs and UUID validation through HTTP', async () => {
        await request(app.getHttpServer()).get('/csi/admin/hc/dimensions?includeInactive=false').expect(200, []);
        expect(master.listDimensions).toHaveBeenCalledWith(ServiceScope.HC, false);
        await request(app.getHttpServer()).get('/csi/admin/hc/users?limit=100&search=User').expect(200, []);
        expect(master.searchUsers).toHaveBeenCalledWith('User', 50);
        const response = await request(app.getHttpServer()).patch('/csi/admin/hc/dimensions/invalid').send({ name: 'Baik' }).expect(400);
        expect(response.body.message).toBe('ID harus berupa UUID');
        expect(master.updateDimension).not.toHaveBeenCalled();
        await request(app.getHttpServer()).get('/csi/admin/hc/dimensions?includeInactive=invalid').expect(400);
    });

    it('routes order and template before :id so they are not parsed as UUIDs', async () => {
        const id = '7f1c6a2e-7a35-4c55-9a43-5d3c2a1b0e9f';
        await request(app.getHttpServer()).put('/csi/admin/hc/dimensions/order').send({ ids: [id] }).expect(200, [{ id: 'a' }]);
        expect(master.reorderDimensions).toHaveBeenCalledWith(ServiceScope.HC, [id]);
        await request(app.getHttpServer()).put('/csi/admin/hc/departments/order').send({ ids: [id] }).expect(200, [{ id: 'b' }]);
        expect(master.reorderDepartments).toHaveBeenCalledWith(ServiceScope.HC, [id]);
        await request(app.getHttpServer()).post('/csi/admin/hc/dimensions/template').expect(201, [{ id: 't' }]);
        expect(master.createTemplateDimensions).toHaveBeenCalledWith(ServiceScope.HC);
        await request(app.getHttpServer()).put('/csi/admin/hc/dimensions/order').send({ ids: ['x'] }).expect(400);
    });
});

describe('CSI admin master controller', () => {
    it('requires JWT and scope-isolated CSI guard on all master routes', () => {
        expect(Reflect.getMetadata(PATH_METADATA, CsiAdminMasterController)).toBe('csi/admin/:scope');
        expect(Reflect.getMetadata(GUARDS_METADATA, CsiAdminMasterController)).toEqual([JwtAuthGuard, CsiAdminGuard]);
    });

    it('delegates using guard-resolved scope rather than raw params and returns plain results', async () => {
        const service: any = {};
        const methods = ['listDimensions', 'createDimension', 'updateDimension', 'deactivateDimension',
            'listDepartments', 'createDepartment', 'updateDepartment', 'deactivateDepartment',
            'listRaters', 'addRaters', 'removeRater', 'searchUsers'];
        for (const method of methods) service[method] = jest.fn().mockResolvedValue({ id: 'result' });
        const controller = new CsiAdminMasterController(service);
        const req = { csiScope: ServiceScope.HC, params: { scope: 'ict' } };
        for (const resource of ['Dimension', 'Department'] as const) {
            expect(await controller[`list${resource}s`](req, { includeInactive: true })).toEqual({ id: 'result' });
            await controller[`create${resource}`](req, { name: 'Nama' } as CreateDimensionDto);
            await controller[`update${resource}`](req, 'id', { name: 'Baru' });
            await controller[`deactivate${resource}`](req, 'id');
            expect(service[`list${resource}s`]).toHaveBeenCalledWith(ServiceScope.HC, true);
            expect(service[`create${resource}`]).toHaveBeenCalledWith(ServiceScope.HC, { name: 'Nama' });
            expect(service[`update${resource}`]).toHaveBeenCalledWith(ServiceScope.HC, 'id', { name: 'Baru' });
            expect(service[`deactivate${resource}`]).toHaveBeenCalledWith(ServiceScope.HC, 'id');
        }
        await controller.listRaters(req);
        await controller.addRaters(req, { userIds: ['u1'] });
        await controller.removeRater(req, 'id');
        await controller.searchUsers({ search: 'User', limit: 5 });
        expect(service.listRaters).toHaveBeenCalledWith(ServiceScope.HC);
        expect(service.addRaters).toHaveBeenCalledWith(ServiceScope.HC, ['u1']);
        expect(service.removeRater).toHaveBeenCalledWith(ServiceScope.HC, 'id');
        expect(service.searchUsers).toHaveBeenCalledWith('User', 5);
    });
});
