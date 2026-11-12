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
import { NotificationModule } from '../notifications/notification.module';

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
        ]),
        AuditModule,
        // NotificationService: booking notifications reach the bell, toast and push like every other module.
        NotificationModule,
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
