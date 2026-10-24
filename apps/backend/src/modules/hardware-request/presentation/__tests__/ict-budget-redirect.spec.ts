import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, VersioningType } from '@nestjs/common';
import * as request from 'supertest';
import { IctBudgetRedirectController } from '../ict-budget-redirect.controller';

describe('IctBudgetRedirectController (integration)', () => {
    let app: INestApplication;

    beforeAll(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [IctBudgetRedirectController],
        }).compile();

        app = module.createNestApplication();
        await app.init();
    });

    afterAll(() => app.close());

    it('GET /ict-budget/123 → 308 + Location /hardware-requests/123', async () => {
        const res = await request(app.getHttpServer())
            .get('/ict-budget/123')
            .redirects(0);
        expect(res.status).toBe(308);
        expect(res.headers.location).toBe('/hardware-requests/123');
        expect(res.headers['deprecation']).toBe('true');
    });

    it('POST /ict-budget/123/approve → 308 + Location /hardware-requests/123/approve', async () => {
        const res = await request(app.getHttpServer())
            .post('/ict-budget/123/approve')
            .redirects(0);
        expect(res.status).toBe(308);
        expect(res.headers.location).toBe('/hardware-requests/123/approve');
    });

    it('GET /ict-budget → 308 + Location /hardware-requests', async () => {
        const res = await request(app.getHttpServer())
            .get('/ict-budget')
            .redirects(0);
        expect(res.status).toBe(308);
        expect(res.headers.location).toBe('/hardware-requests');
    });
});

describe('IctBudgetRedirectController behind URI versioning (as in main.ts)', () => {
    let app: INestApplication;

    beforeAll(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [IctBudgetRedirectController],
        }).compile();

        app = module.createNestApplication();
        app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
        await app.init();
    });

    afterAll(() => app.close());

    it('GET /v1/ict-budget/123?x=1 → /v1/hardware-requests/123?x=1 (no self-redirect loop)', async () => {
        const res = await request(app.getHttpServer())
            .get('/v1/ict-budget/123?x=1')
            .redirects(0);
        expect(res.status).toBe(308);
        expect(res.headers.location).toBe('/v1/hardware-requests/123?x=1');
    });

    it('GET /v1/ict-budget → /v1/hardware-requests', async () => {
        const res = await request(app.getHttpServer())
            .get('/v1/ict-budget')
            .redirects(0);
        expect(res.headers.location).toBe('/v1/hardware-requests');
    });
});
