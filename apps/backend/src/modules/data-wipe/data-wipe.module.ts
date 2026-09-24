import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DataWipeController } from './data-wipe.controller';
import { DataWipeService } from './data-wipe.service';
import { DataWipeAccessGuard } from './guards/data-wipe-access.guard';
import { PreWipeBackupService } from './services/pre-wipe-backup.service';
import { WipeExecutorService } from './services/wipe-executor.service';
import { WipeFileSweeperService } from './services/wipe-file-sweeper.service';
import { WipePreviewService } from './services/wipe-preview.service';

/**
 * Danger zone: permanently deletes transactional data for ticketing, e-form and
 * hardware request so a production go-live starts from zero.
 *
 * Kept as its own module rather than folded into SettingsModule: that controller
 * is edited often for routine configuration work, and destructive endpoints
 * should not share a blast radius with it.
 *
 * AuditService comes from the @Global AuditModule, so no import is needed here.
 */
@Module({
    imports: [ConfigModule],
    controllers: [DataWipeController],
    providers: [
        DataWipeService,
        DataWipeAccessGuard,
        WipePreviewService,
        WipeExecutorService,
        PreWipeBackupService,
        WipeFileSweeperService,
    ],
    exports: [DataWipeService],
})
export class DataWipeModule { }
