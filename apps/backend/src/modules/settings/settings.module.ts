import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SystemSettings } from './entities/system-settings.entity';
import { SettingsService } from './settings.service';
import { SettingsController } from './settings.controller';
import { StorageCleanupService } from './storage-cleanup.service';
import { TicketMessage } from '../ticketing/entities/ticket-message.entity';
import { Ticket } from '../ticketing/entities/ticket.entity';
import { UploadModule } from '../../shared/upload/upload.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([SystemSettings, TicketMessage, Ticket]),
        UploadModule,
    ],
    controllers: [SettingsController],
    providers: [SettingsService, StorageCleanupService],
    exports: [SettingsService, StorageCleanupService],
})
export class SettingsModule { }
