import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { UsersController } from '../users.controller';
import { UsersService } from '../users.service';
import { UserRole } from '../enums/user-role.enum';
import { JwtAuthGuard } from '../../auth/infrastructure/guards/jwt-auth.guard';
import { CacheService } from '../../../shared/core/cache/cache.service';

const mockUsersService = {
    getTechnicians: jest.fn().mockResolvedValue([
        { id: 'tech-1', fullName: 'Tech One' },
        { id: 'tech-2', fullName: 'Tech Two' }
    ])
};

const mockCacheService = {
    getAsync: jest.fn(),
    setAsync: jest.fn(),
    delAsync: jest.fn(),
};

const makeJwtGuard = (userId: string, role = 'USER', siteId: string | null = null) => ({
    canActivate: (ctx: any) => {
        ctx.switchToHttp().getRequest().user = { userId, id: userId, role, siteId };
        return true;
    },
});

describe('GET /users/technicians', () => {
    let app: INestApplication;

    beforeAll(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [UsersController],
            providers: [
                { provide: UsersService, useValue: mockUsersService },
                { provide: CacheService, useValue: mockCacheService }
            ],
        })
            .overrideGuard(JwtAuthGuard).useValue(makeJwtGuard('admin-id', UserRole.ADMIN, null))
            .compile();

        app = module.createNestApplication();
        app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
        await app.init();
    });

    afterAll(async () => {
        await app.close();
    });

    it('returns 200 dengan array {id, fullName}', async () => {
        mockUsersService.getTechnicians.mockClear();
        const res = await request(app.getHttpServer()).get('/users/technicians');
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.data ?? res.body)).toBe(true);
        const list = res.body.data ?? res.body;
        if (list.length > 0) {
            expect(list[0]).toEqual({
                id: expect.any(String),
                fullName: expect.any(String),
            });
        }
        expect(mockUsersService.getTechnicians).toHaveBeenCalledWith(null);
    });
});

describe('GET /users/technicians — site scoping (unit: controller → service contract)', () => {
    it('site-locked caller passes siteId to service', async () => {
        const usersService = { getTechnicians: jest.fn().mockResolvedValue([]) } as any;
        const cacheService = { getAsync: jest.fn(), setAsync: jest.fn(), delAsync: jest.fn() } as any;
        const ctrl = new UsersController(usersService, cacheService);
        await (ctrl as any).getTechnicians({ user: { role: UserRole.AGENT_OPERATIONAL_SUPPORT, siteId: 'site-jkt' } });
        expect(usersService.getTechnicians).toHaveBeenCalledWith('site-jkt');
    });

    it('cross-site caller (ADMIN) passes null (no scoping)', async () => {
        const usersService = { getTechnicians: jest.fn().mockResolvedValue([]) } as any;
        const cacheService = { getAsync: jest.fn(), setAsync: jest.fn(), delAsync: jest.fn() } as any;
        const ctrl = new UsersController(usersService, cacheService);
        await (ctrl as any).getTechnicians({ user: { role: UserRole.ADMIN, siteId: 'site-jkt' } });
        expect(usersService.getTechnicians).toHaveBeenCalledWith(null);
        await (ctrl as any).getTechnicians({ user: { role: UserRole.MANAGER, siteId: null } });
        expect(usersService.getTechnicians).toHaveBeenLastCalledWith(null);
    });
});
