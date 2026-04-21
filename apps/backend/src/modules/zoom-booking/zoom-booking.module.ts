import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';

// Entities
import {
    ZoomAccount,
    ZoomBooking,
    ZoomMeeting,
    ZoomParticipant,
    ZoomSettings,
    ZoomAuditLog,
} from './entities';
import { Notification } from '../notifications/entities/notification.entity';

// Adapters
import {
    ZoomApiAdapter,
    GoogleCalendarAdapter,
    OutlookCalendarAdapter,
} from './adapters';

// Services
import {
    ZoomBookingService,
    ZoomAccountService,
    ZoomSettingsService,
    ZoomAuditLogService,
    ZoomNotificationService,
    ZoomQueueService,
    ZoomBookingEventListener,
    ZoomSyncService,
} from './services';

// Controllers
import {
    ZoomBookingController,
    ZoomAdminController,
    ZoomWebhookController,
} from './controllers';

// Gateways
import { ZoomGateway } from './gateways';

// Seeders
import { ZoomBootstrapSeeder } from './seeders/zoom-bootstrap.seeder';
import { AuditModule } from '../audit/audit.module';

@Module({
    imports: [
        ConfigModule,
        TypeOrmModule.forFeature([
            ZoomAccount,
            ZoomBooking,
            ZoomMeeting,
            ZoomParticipant,
            ZoomSettings,
            ZoomAuditLog,
            Notification,
        ]),
        AuditModule,
    ],
    controllers: [
        ZoomBookingController,
        ZoomAdminController,
        ZoomWebhookController,
    ],
    providers: [
        // Adapters
        ZoomApiAdapter,
        GoogleCalendarAdapter,
        OutlookCalendarAdapter,
        // Services
        ZoomBookingService,
        ZoomAccountService,
        ZoomSettingsService,
        ZoomAuditLogService,
        ZoomNotificationService,
        ZoomQueueService,
        ZoomBookingEventListener,
        ZoomSyncService,
        // Gateway
        ZoomGateway,
        // Seeder
        ZoomBootstrapSeeder,
    ],
    exports: [
        ZoomBookingService,
        ZoomAccountService,
        ZoomSettingsService,
        ZoomNotificationService,
        ZoomQueueService,
        ZoomGateway,
        ZoomApiAdapter,
        GoogleCalendarAdapter,
        OutlookCalendarAdapter,
    ],
})
export class ZoomBookingModule { }
