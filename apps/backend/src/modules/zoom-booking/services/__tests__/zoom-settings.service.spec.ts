import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ZoomSettingsService } from '../zoom-settings.service';
import { ZoomSettings } from '../../entities/zoom-settings.entity';

describe('ZoomSettingsService', () => {
    let service: ZoomSettingsService;

    const mockRepo = {
        findOne: jest.fn(),
        create: jest.fn((dto) => dto as ZoomSettings),
        save: jest.fn((entity) => Promise.resolve(entity as ZoomSettings)),
    } as unknown as jest.Mocked<Repository<ZoomSettings>>;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ZoomSettingsService,
                { provide: getRepositoryToken(ZoomSettings), useValue: mockRepo },
            ],
        }).compile();

        service = module.get<ZoomSettingsService>(ZoomSettingsService);
    });

    afterEach(() => jest.clearAllMocks());

    it('creates settings with 24h slot, all 7 days, 50/day cap on first run', async () => {
        mockRepo.findOne.mockResolvedValue(null);

        const result = await service.getSettings();

        expect(result.slotStartTime).toBe('00:00');
        expect(result.slotEndTime).toBe('23:59');
        expect(result.workingDays).toEqual([0, 1, 2, 3, 4, 5, 6]);
        expect(result.maxBookingPerUserPerDay).toBe(50);
        expect(mockRepo.save).toHaveBeenCalledTimes(1);
    });

    it('accepts maxBookingPerUserPerDay = 500 (no upper cap)', async () => {
        const existing = { id: '1' } as ZoomSettings;
        mockRepo.findOne.mockResolvedValue(existing);

        const result = await service.updateSettings({ maxBookingPerUserPerDay: 500 });

        expect(result.maxBookingPerUserPerDay).toBe(500);
    });
});
