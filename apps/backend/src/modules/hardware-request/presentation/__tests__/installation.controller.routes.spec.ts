import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { InstallationController } from '../installation.controller';
import { HardwareRequestController } from '../hardware-request.controller';
import { HardwareCatalogController } from '../hardware-catalog.controller';
import { HardwareCommentController } from '../hardware-comment.controller';
import { HardwareActivityController } from '../hardware-activity.controller';
import { HardwareDashboardController } from '../hardware-dashboard.controller';
import { IctBudgetRedirectController } from '../ict-budget-redirect.controller';

import { JwtAuthGuard } from '../../../auth/infrastructure/guards/jwt-auth.guard';
import { HardwareRoleGuard } from '../../guards/hardware-role.guard';
import { HardwareRole } from '../../domain/enums/hardware-role.enum';
import { InstallationScheduleService } from '../../services/installation-schedule.service';
import { HardwareRequestCommandService } from '../../services/hardware-request-command.service';
import { HardwareRequestQueryService } from '../../services/hardware-request-query.service';
import { HardwareCatalogService } from '../../services/hardware-catalog.service';
import { HardwareCommentService } from '../../services/hardware-comment.service';
import { HardwareActivityService } from '../../services/hardware-activity.service';
import { HardwareDashboardService } from '../../services/hardware-dashboard.service';
import { HardwareAssetService } from '../../services/hardware-asset.service';
import { MutualSchedulingService } from '../../services/mutual-scheduling.service';
import { DeliveryTrackingService } from '../../services/delivery-tracking.service';
import { ProcurementDecisionService } from '../../services/procurement-decision.service';

const makeJwtGuard = (userId: string, role = 'USER') => ({
    canActivate: (ctx: any) => {
        ctx.switchToHttp().getRequest().user = { userId, role };
        return true;
    },
});

describe('InstallationController routes (route order)', () => {
    let app: INestApplication;

    beforeAll(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [
                InstallationController,
                HardwareCatalogController,
                HardwareDashboardController,
                HardwareCommentController,
                HardwareActivityController,
                HardwareRequestController,
                IctBudgetRedirectController,
            ],
            providers: [
                { provide: InstallationScheduleService, useValue: { calendar: jest.fn().mockResolvedValue([]), unscheduled: jest.fn().mockResolvedValue([]), myToday: jest.fn().mockResolvedValue([]) } },
                { provide: HardwareRequestCommandService, useValue: {} },
                { provide: HardwareRequestQueryService, useValue: { getById: jest.fn().mockRejectedValue(new Error('NOT THIS')) } },
                { provide: HardwareCatalogService, useValue: {} },
                { provide: HardwareCommentService, useValue: {} },
                { provide: HardwareActivityService, useValue: {} },
                { provide: HardwareDashboardService, useValue: {} },
                { provide: HardwareAssetService, useValue: {} },
                { provide: MutualSchedulingService, useValue: {} },
                { provide: DeliveryTrackingService, useValue: {} },
                { provide: ProcurementDecisionService, useValue: {} },
            ],
        })
            .overrideGuard(JwtAuthGuard).useValue(makeJwtGuard('admin-id', 'ADMIN'))
            .overrideGuard(HardwareRoleGuard).useValue({ canActivate: (ctx: any) => {
                const req = ctx.switchToHttp().getRequest();
                req.hardwareRole = HardwareRole.ICT_STAFF; 
                req.user = { userId: 'test-user-id', role: 'ADMIN' };
                return true;
            }})
            .compile();

        app = module.createNestApplication();
        app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
        await app.init();
    });

    afterAll(async () => {
        if (app) await app.close();
    });

    it('GET /hardware-requests/calendar tidak match :id (no UUID 400)', async () => {
        const res = await request(app.getHttpServer())
            .get('/hardware-requests/calendar')
            .query({ from: '2026-04-19', to: '2026-04-26' });
        expect(res.status).not.toBe(400);
        expect(res.status).toBeLessThan(500);
    });

    it('GET /hardware-requests/unscheduled tidak match :id', async () => {
        const res = await request(app.getHttpServer()).get('/hardware-requests/unscheduled');
        expect(res.status).not.toBe(400);
        expect(res.status).toBeLessThan(500);
    });

    it('GET /hardware-requests/my-today tidak match :id', async () => {
        const res = await request(app.getHttpServer()).get('/hardware-requests/my-today');
        expect(res.status).not.toBe(400);
        expect(res.status).toBeLessThan(500);
    });

    it('GET /calendar menerima technicianIds[] dan tidak abaikan filter', async () => {
        const tid = '11111111-1111-4111-8111-111111111111';
        const res = await request(app.getHttpServer())
            .get('/hardware-requests/calendar')
            .query({ from: '2026-04-19', to: '2026-04-26', technicianIds: [tid, tid] });
        expect(res.status).toBeLessThan(400);
        // We mocked the service with jest.fn, we can spy on it
        const schedService = app.get(InstallationScheduleService);
        expect(schedService.calendar).toHaveBeenCalledWith(expect.objectContaining({
            technicianIds: [tid, tid]
        }));
    });
});
