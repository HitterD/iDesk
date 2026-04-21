// apps/backend/src/modules/hardware-request/services/request-number.service.spec.ts
import { Test } from '@nestjs/testing';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RequestNumberService } from './request-number.service';
import { HardwareRequest } from '../domain/entities/hardware-request.entity';

describe('RequestNumberService', () => {
    let service: RequestNumberService;
    let repoCount: jest.Mock;

    beforeEach(async () => {
        repoCount = jest.fn();
        const moduleRef = await Test.createTestingModule({
            providers: [
                RequestNumberService,
                {
                    provide: getRepositoryToken(HardwareRequest),
                    useValue: { count: repoCount } as Partial<Repository<HardwareRequest>>,
                },
            ],
        }).compile();
        service = moduleRef.get(RequestNumberService);
    });

    it('generates HR-YYYY-0001 when no requests exist this year', async () => {
        repoCount.mockResolvedValue(0);
        const now = new Date('2026-04-17T10:00:00Z');
        const num = await service.generate(now);
        expect(num).toBe('HR-2026-0001');
    });

    it('increments sequence based on count this year', async () => {
        repoCount.mockResolvedValue(42);
        const now = new Date('2026-04-17T10:00:00Z');
        const num = await service.generate(now);
        expect(num).toBe('HR-2026-0043');
    });

    it('pads to 4 digits minimum', async () => {
        repoCount.mockResolvedValue(9999);
        const num = await service.generate(new Date('2026-01-01Z'));
        expect(num).toBe('HR-2026-10000');
    });
});
