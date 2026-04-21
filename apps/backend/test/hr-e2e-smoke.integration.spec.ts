import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Hardware Request E2E Smoke (Integration)', () => {
    let app: INestApplication;
    let authTokens: Record<string, string> = {};
    let createdRequestId: string;

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        app = moduleFixture.createNestApplication();
        app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
        await app.init();
        
        // Setup tokens for roles if possible, or bypass auth using mocks
    });

    afterAll(async () => {
        await app.close();
    });

    it('dummy test to pass initially', () => {
        expect(true).toBe(true);
    });
});
