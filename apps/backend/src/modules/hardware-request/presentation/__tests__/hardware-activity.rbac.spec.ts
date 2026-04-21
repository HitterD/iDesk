import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ForbiddenException } from '@nestjs/common';
import * as request from 'supertest';
import { HardwareActivityController } from '../hardware-activity.controller';
import { HardwareActivityService } from '../../services/hardware-activity.service';
import { JwtAuthGuard } from '../../../auth/infrastructure/guards/jwt-auth.guard';
import { HardwareRoleGuard } from '../../guards/hardware-role.guard';
import { HardwareRole } from '../../domain/enums/hardware-role.enum';

const REQ_ID = '00000000-0000-0000-0000-000000000001';

const makeJwtGuard = (userId: string, role = 'USER') => ({
    canActivate: (ctx: any) => {
        ctx.switchToHttp().getRequest().user = { id: userId, role };
        return true;
    },
});

describe('HardwareActivityController — RBAC', () => {
    async function buildApp(userId: string, role: string, serviceImpl: () => any) {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [HardwareActivityController],
            providers: [{ provide: HardwareActivityService, useValue: { listForRequest: serviceImpl } }],
        })
            .overrideGuard(JwtAuthGuard).useValue(makeJwtGuard(userId, role))
            .overrideGuard(HardwareRoleGuard).useValue({ canActivate: (ctx: any) => {
                const req = ctx.switchToHttp().getRequest();
                req.hardwareRole = HardwareRole.USER;
                return true;
            }})
            .compile();

        const app = module.createNestApplication();
        await app.init();
        return app;
    }

    it('requester that owns request → 200', async () => {
        const app = await buildApp('owner', 'USER', () => []);
        await request(app.getHttpServer())
            .get(`/hardware-requests/${REQ_ID}/activity`)
            .expect(200);
        await app.close();
    });

    it('non-owner user (service throws) → 403', async () => {
        const app = await buildApp('other', 'USER', () => {
            throw new ForbiddenException('view activity for this request');
        });
        await request(app.getHttpServer())
            .get(`/hardware-requests/${REQ_ID}/activity`)
            .expect(403);
        await app.close();
    });

    it('admin role → 200', async () => {
        const app = await buildApp('admin', 'ADMIN', () => []);
        await request(app.getHttpServer())
            .get(`/hardware-requests/${REQ_ID}/activity`)
            .expect(200);
        await app.close();
    });
});
