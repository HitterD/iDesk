import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { StorageCleanupService } from './storage-cleanup.service';
import { TicketMessage } from '../ticketing/entities/ticket-message.entity';
import { Ticket } from '../ticketing/entities/ticket.entity';
import { SettingsService } from './settings.service';
import { UploadService } from '../../shared/upload/upload.service';

describe('StorageCleanupService', () => {
    let service: StorageCleanupService;

    const mockMessageRepo = {
        createQueryBuilder: jest.fn(() => ({
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            getMany: jest.fn().mockResolvedValue([]),
            getCount: jest.fn().mockResolvedValue(0),
            delete: jest.fn().mockReturnThis(),
            execute: jest.fn().mockResolvedValue({ affected: 0 }),
        })),
        update: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    const mockTicketRepo = {
        find: jest.fn().mockResolvedValue([]),
    };

    const mockSettingsService = {
        getStorageSettings: jest.fn().mockResolvedValue({
            autoCleanupEnabled: false,
            attachments: { enabled: true, retentionDays: 90, onlyResolvedTickets: true },
            notes: { enabled: true, retentionDays: 90, onlyResolvedTickets: true },
            discussions: { enabled: true, retentionDays: 90, onlyResolvedTickets: true },
            imageCompression: { enabled: true, retentionDays: 90, onlyResolvedTickets: true, quality: 80, maxWidth: 1600 },
        }),
    };

    const mockUploadService = {};

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                StorageCleanupService,
                {
                    provide: getRepositoryToken(TicketMessage),
                    useValue: mockMessageRepo,
                },
                {
                    provide: getRepositoryToken(Ticket),
                    useValue: mockTicketRepo,
                },
                {
                    provide: SettingsService,
                    useValue: mockSettingsService,
                },
                {
                    provide: UploadService,
                    useValue: mockUploadService,
                },
            ],
        }).compile();

        service = module.get<StorageCleanupService>(StorageCleanupService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    it('should preview image compression when no messages found', async () => {
        const preview = await service.previewImageCompression({ olderThanDays: 90, onlyResolvedTickets: true });
        expect(preview).toEqual({
            eligibleCount: 0,
            totalSizeBytes: 0,
            estimatedSavingsBytes: 0,
            files: [],
        });
    });

    it('should compress images and return result statistics', async () => {
        const result = await service.compressImages({ olderThanDays: 90, onlyResolvedTickets: true });
        expect(result.totalScanned).toBe(0);
        expect(result.compressedCount).toBe(0);
        expect(result.freedBytes).toBe(0);
        expect(result.savingsPercentage).toBe(0);
        expect(result.errors).toEqual([]);
    });
});
