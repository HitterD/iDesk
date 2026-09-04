import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { SynologyService } from './synology.service';
import { BackupConfiguration, BackupType } from './entities/backup-configuration.entity';
import { BackupHistory, BackupStatus } from './entities/backup-history.entity';
import * as fs from 'fs';
import * as path from 'path';

describe('SynologyService', () => {
    let service: SynologyService;
    let configRepo: any;
    let historyRepo: any;

    const mockConfig: Partial<BackupConfiguration> = {
        id: 'cfg-123',
        name: 'Daily backup database',
        synologyHost: '192.168.2.17',
        synologyPort: 30001,
        synologyUsername: 'ict',
        synologyPasswordEncrypted: 'enc-pass',
        destinationFolder: '/sja/SJA SPJ/ICT/OPERATIONAL SUPPORT/Backup',
        backupType: BackupType.FULL,
        isActive: true,
    };

    beforeEach(async () => {
        configRepo = {
            find: jest.fn().mockResolvedValue([mockConfig]),
            findOne: jest.fn().mockResolvedValue(mockConfig),
            create: jest.fn((dto) => ({ ...dto })),
            save: jest.fn((entity) => Promise.resolve({ ...entity, id: entity.id || 'new-id' })),
        };

        historyRepo = {
            create: jest.fn((dto) => ({ ...dto })),
            save: jest.fn((entity) => Promise.resolve({ ...entity, id: 'hist-123' })),
            createQueryBuilder: jest.fn(() => ({
                leftJoinAndSelect: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                take: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                getMany: jest.fn().mockResolvedValue([]),
            })),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                SynologyService,
                {
                    provide: getRepositoryToken(BackupConfiguration),
                    useValue: configRepo,
                },
                {
                    provide: getRepositoryToken(BackupHistory),
                    useValue: historyRepo,
                },
                {
                    provide: ConfigService,
                    useValue: {
                        get: jest.fn((key, defaultVal) => {
                            if (key === 'BACKUP_ENCRYPTION_KEY') return 'test-key-32-chars-long-example!';
                            if (key === 'UPLOAD_DIR') return './test-uploads';
                            return defaultVal;
                        }),
                    },
                },
            ],
        }).compile();

        service = module.get<SynologyService>(SynologyService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('handleFileUploaded', () => {
        it('should mirror newly uploaded file to Synology NAS destination', async () => {
            const uploadSpy = jest.spyOn<any, any>(service, 'uploadToSynology').mockResolvedValue(undefined);

            await service.handleFileUploaded({
                filePath: 'uploads/tickets/t1/doc.pdf',
                relativePath: 'tickets/t1/doc.pdf',
                filename: 'doc.pdf',
            });

            expect(uploadSpy).toHaveBeenCalledWith(
                mockConfig,
                'uploads/tickets/t1/doc.pdf',
                '/sja/SJA SPJ/ICT/OPERATIONAL SUPPORT/Backup/tickets/t1/doc.pdf',
            );
        });

        it('should handle uploads with /uploads/ prefix cleanly', async () => {
            const uploadSpy = jest.spyOn<any, any>(service, 'uploadToSynology').mockResolvedValue(undefined);

            await service.handleFileUploaded({
                filePath: 'F:/idesk/uploads/telegram/photo.jpg',
                relativePath: '/uploads/telegram/photo.jpg',
            });

            expect(uploadSpy).toHaveBeenCalledWith(
                mockConfig,
                'F:/idesk/uploads/telegram/photo.jpg',
                '/sja/SJA SPJ/ICT/OPERATIONAL SUPPORT/Backup/telegram/photo.jpg',
            );
        });
    });

    describe('syncUploadsToSynology', () => {
        it('should sync all files in upload directory and record history', async () => {
            const tempDir = path.resolve('./test-uploads');
            if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
            const subDir = path.join(tempDir, 'attachments');
            if (!fs.existsSync(subDir)) fs.mkdirSync(subDir, { recursive: true });
            const testFile = path.join(subDir, 'test-sync.txt');
            fs.writeFileSync(testFile, 'hello synology');

            const uploadSpy = jest.spyOn<any, any>(service, 'uploadToSynology').mockResolvedValue(undefined);

            try {
                const result = await service.syncUploadsToSynology('cfg-123');

                expect(result.success).toBe(true);
                expect(result.uploadedFiles).toBeGreaterThanOrEqual(1);
                expect(uploadSpy).toHaveBeenCalled();
                expect(historyRepo.save).toHaveBeenCalled();
            } finally {
                if (fs.existsSync(testFile)) fs.unlinkSync(testFile);
                if (fs.existsSync(subDir)) fs.rmdirSync(subDir);
                if (fs.existsSync(tempDir)) fs.rmdirSync(tempDir);
            }
        });
    });
});
