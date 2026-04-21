import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync } from 'fs';

// Entities
import { RenewalContract } from './entities/renewal-contract.entity';
import { ContractAuditLog } from './entities/contract-audit-log.entity';
import { User } from '../users/entities/user.entity';
import { PermissionPreset } from '../permissions/entities/permission-preset.entity';

// Services
import { RenewalService } from './renewal.service';
import { PdfExtractionService } from './services/pdf-extraction.service';
import { PdfValidationService } from './services/pdf-validation.service';
import { PdfOcrService } from './services/pdf-ocr.service';
import { RenewalSchedulerService } from './services/renewal-scheduler.service';
import { ContractAuditService } from './services/contract-audit.service';

// Controller
import { RenewalController } from './renewal.controller';

// Guards
import { PageAccessGuard } from '../../shared/core/guards/page-access.guard';

// External Dependencies (READ-ONLY)
import { NotificationModule } from '../notifications/notification.module';
import { AuditModule } from '../audit/audit.module';

// Ensure upload directory exists
const contractsUploadPath = join(process.cwd(), 'uploads', 'contracts');
if (!existsSync(contractsUploadPath)) {
    mkdirSync(contractsUploadPath, { recursive: true });
}

@Module({
    imports: [
        TypeOrmModule.forFeature([RenewalContract, ContractAuditLog, User, PermissionPreset]),
        MulterModule.register({
            storage: diskStorage({
                destination: contractsUploadPath,
                filename: (req, file, callback) => {
                    const uniqueId = randomUUID();
                    const ext = extname(file.originalname);
                    callback(null, `${uniqueId}${ext}`);
                },
            }),
            fileFilter: (req, file, callback) => {
                if (file.mimetype === 'application/pdf') {
                    callback(null, true);
                } else {
                    callback(new Error('Only PDF files are allowed'), false);
                }
            },
            limits: {
                fileSize: 10 * 1024 * 1024, // 10MB max
            },
        }),
        NotificationModule,
        AuditModule,
    ],
    controllers: [RenewalController],
    providers: [
        RenewalService,
        PdfExtractionService,
        PdfValidationService,
        PdfOcrService,
        RenewalSchedulerService,
        ContractAuditService,
        PageAccessGuard, // V9: Preset-based page access guard
    ],
    exports: [RenewalService, ContractAuditService],
})
export class RenewalModule { }
