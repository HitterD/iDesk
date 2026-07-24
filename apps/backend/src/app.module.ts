import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { ThrottlerModule } from '@nestjs/throttler';
import { CustomThrottlerGuard } from './shared/core/guards/custom-throttler.guard';
import { CustomTypeOrmLogger } from './shared/core/logger/typeorm-logger';
import { APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { TicketingModule } from './modules/ticketing/ticketing.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { User } from './modules/users/entities/user.entity';
import { Ticket } from './modules/ticketing/entities/ticket.entity';
import { TicketMessage } from './modules/ticketing/entities/ticket-message.entity';
import { CustomerSession } from './modules/users/entities/customer-session.entity';
import { Department } from './modules/users/entities/department.entity';
import { SlaConfig } from './modules/ticketing/entities/sla-config.entity';
import { SavedReply } from './modules/ticketing/entities/saved-reply.entity';
import { TicketSurvey } from './modules/ticketing/entities/ticket-survey.entity';
import { TicketTemplate } from './modules/ticketing/entities/ticket-template.entity';
import { AuditLog } from './modules/audit/entities/audit-log.entity';

import { ScheduleModule } from '@nestjs/schedule';
import { ReportsModule } from './modules/reports/reports.module';
import { KnowledgeBaseModule } from './modules/knowledge-base/knowledge-base.module';
import { SlaConfigModule } from './modules/sla-config/sla-config.module';
import { NotificationModule } from './modules/notifications/notification.module';
import { TelegramModule } from './modules/telegram/telegram.module';

import { TicketAttribute } from './modules/ticketing/entities/ticket-attribute.entity';
import { TelegramSession } from './modules/telegram/entities/telegram-session.entity';
import { Article } from './modules/knowledge-base/entities/article.entity';
import { ArticleView } from './modules/knowledge-base/entities/article-view.entity';
import { Notification } from './modules/notifications/entities/notification.entity';
import { NotificationPreference } from './modules/notifications/entities/notification-preference.entity';
import { NotificationLog } from './modules/notifications/entities/notification-log.entity';
import { HealthModule } from './modules/health/health.module';
import { SearchModule } from './modules/search/search.module';
import { SavedSearch } from './modules/search/entities/saved-search.entity';
import { RenewalModule } from './modules/renewal/renewal.module';
import { RenewalContract } from './modules/renewal/entities/renewal-contract.entity';
import { AppCacheModule } from './shared/core/cache';
import { QueueModule } from './shared/queue';
import { UploadModule } from './shared/upload';
import { EncryptionModule } from './shared/core/encryption/encryption.module';
import { AuditModule } from './modules/audit';
import { BusinessHours } from './modules/sla-config/entities/business-hours.entity';
import { AutomationModule } from './modules/automation/automation.module';
import { WorkflowRule } from './modules/automation/entities/workflow-rule.entity';
import { WorkflowExecution } from './modules/automation/entities/workflow-execution.entity';
import { SettingsModule } from './modules/settings/settings.module';
import { SystemSettings } from './modules/settings/entities/system-settings.entity';

// New entities for Phase 0
import { Site } from './modules/sites/entities/site.entity';

import { LostItemReport } from './modules/lost-item/entities/lost-item-report.entity';
import { AccessType } from './modules/access-request/entities/access-type.entity';
import { AccessRequest } from './modules/access-request/entities/access-request.entity';
import { InstallationSchedule } from './modules/hardware-request/domain/entities/installation-schedule.entity';
import { PriorityWeight } from './modules/workload/entities/priority-weight.entity';
import { AgentDailyWorkload } from './modules/workload/entities/agent-daily-workload.entity';
import { NotificationSound } from './modules/sound/entities/notification-sound.entity';
import { BackupConfiguration } from './modules/synology/entities/backup-configuration.entity';
import { BackupHistory } from './modules/synology/entities/backup-history.entity';
import { IpWhitelist } from './modules/ip-whitelist/entities/ip-whitelist.entity';

// New modules for Phase 1
import { SitesModule } from './modules/sites/sites.module';
import { TvBoardModule } from './modules/tv-board/tv-board.module';

// New modules for Phase 2
import { LostItemModule } from './modules/lost-item/lost-item.module';
import { AccessRequestModule } from './modules/access-request/access-request.module';

// New modules for Phase 3
import { WorkloadModule } from './modules/workload/workload.module';

// New modules for Phase 4
import { SoundModule } from './modules/sound/sound.module';
import { SynologyModule } from './modules/synology/synology.module';

// New modules for Phase 6
import { ManagerModule } from './modules/manager/manager.module';

// New modules for Phase 7: IP Whitelist
import { IpWhitelistModule } from './modules/ip-whitelist/ip-whitelist.module';

// New modules for Phase 8: Zoom Booking Calendar
import { ZoomBookingModule } from './modules/zoom-booking/zoom-booking.module';
import { ZoomAccount } from './modules/zoom-booking/entities/zoom-account.entity';
import { ZoomBooking } from './modules/zoom-booking/entities/zoom-booking.entity';
import { ZoomMeeting } from './modules/zoom-booking/entities/zoom-meeting.entity';
import { ZoomParticipant } from './modules/zoom-booking/entities/zoom-participant.entity';
import { ZoomSettings } from './modules/zoom-booking/entities/zoom-settings.entity';
import { ZoomAuditLog } from './modules/zoom-booking/entities/zoom-audit-log.entity';

// New modules for Phase 9: Permissions System
import { PermissionsModule } from './modules/permissions/permissions.module';
import { FeatureDefinition } from './modules/permissions/entities/feature-definition.entity';
import { UserFeaturePermission } from './modules/permissions/entities/user-feature-permission.entity';
import { PermissionPreset } from './modules/permissions/entities/permission-preset.entity';

// New modules for Phase 10: Google Sync
import { GoogleSyncModule } from './modules/google-sync/google-sync.module';
import { SpreadsheetConfig } from './modules/google-sync/entities/spreadsheet-config.entity';
import { SpreadsheetSheet } from './modules/google-sync/entities/spreadsheet-sheet.entity';
import { SyncLog } from './modules/google-sync/entities/sync-log.entity';

// New modules for Phase 11: VPN Access Tracking
import { VpnAccessModule } from './modules/vpn-access/vpn-access.module';
import { VpnAccess } from './modules/vpn-access/entities/vpn-access.entity';

// New modules for E-Form Access (VPN MVP)
import { EFormRequestModule } from './modules/eform-request/eform-request.module';
import { EFormRequest, EFormApproval, EFormSignature, EFormCredential } from './modules/eform-request/entities';

// Shared Guards Module (provides PageAccessGuard, FeatureAccessGuard with dependencies)
import { SharedGuardsModule } from './shared/core/shared-guards.module';
import { HardwareRequestModule } from './modules/hardware-request/hardware-request.module';
import { HrisGatewayModule } from './modules/hris-gateway/hris-gateway.module';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: ['.env', '../../.env'], // Check apps/backend/.env first, then root/.env
        }),
        EventEmitterModule.forRoot(),
        ReportsModule,
        KnowledgeBaseModule,
        SlaConfigModule,
        ScheduleModule.forRoot(),
        TypeOrmModule.forRoot({
            type: 'postgres',
            host: process.env.DB_HOST || 'localhost',
            port: parseInt(process.env.DB_PORT || '5432', 10),
            username: process.env.DB_USERNAME || 'postgres',
            password: process.env.DB_PASSWORD || 'postgres',
            database: process.env.DB_DATABASE || 'idesk_db',
            autoLoadEntities: true,
            // SECURITY: Use migrations in production, never auto-sync
            synchronize: process.env.NODE_ENV !== 'production',
            // Enable migrations for production
            migrationsRun: process.env.NODE_ENV === 'production',
            migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
            // Slow query logging with custom logger
            logging: ['error', 'warn', 'schema', 'migration'],
            logger: new CustomTypeOrmLogger(),
            maxQueryExecutionTime: 1000, // Log queries taking > 1 second
            // Connection Pool Configuration (Section 5.3.B)
            extra: {
                max: parseInt(process.env.DB_POOL_MAX || '20', 10),
                min: parseInt(process.env.DB_POOL_MIN || '5', 10),
                idleTimeoutMillis: 30000,
                connectionTimeoutMillis: 5000,
            },
        }),
        ServeStaticModule.forRoot({
            rootPath: join(process.cwd(), 'uploads'),
            serveRoot: '/uploads',
            serveStaticOptions: {
                index: false,
            },
        }),
        // SECURITY: SMTP credentials from environment variables
        MailerModule.forRoot({
            transport: {
                host: process.env.SMTP_HOST || 'smtp.ethereal.email',
                port: parseInt(process.env.SMTP_PORT || '587', 10),
                secure: process.env.SMTP_SECURE === 'true',
                auth: {
                    user: process.env.SMTP_USER || '',
                    pass: process.env.SMTP_PASS || '',
                },
            },
            defaults: {
                from: process.env.SMTP_FROM || '"No Reply" <noreply@idesk.com>',
            },
            template: {
                // Fix: __dirname is dist/src, templates are in dist/assets/templates
                dir: join(__dirname, '..', 'assets', 'templates'),
                adapter: new HandlebarsAdapter(),
                options: {
                    strict: true,
                },
            },
        }),
        TicketingModule,
        AuthModule,
        UsersModule,
        UploadsModule,
        NotificationModule,
        TelegramModule,
        HealthModule,
        SearchModule,
        RenewalModule,
        AppCacheModule,
        QueueModule.forRoot(),
        UploadModule,
        AuditModule,
        AutomationModule,
        SettingsModule,
        SitesModule, // Phase 1: Multi-Site System
        TvBoardModule,

        LostItemModule, // Phase 2: Ticket Types
        AccessRequestModule, // Phase 2: Ticket Types
        WorkloadModule, // Phase 3: Auto-Assignment
        SoundModule, // Phase 4: Sound Notifications
        SynologyModule, // Phase 4: Synology Backup
        ManagerModule, // Phase 6: Manager Dashboard
        IpWhitelistModule, // Phase 7: IP Whitelist Management
        ZoomBookingModule, // Phase 8: Zoom Booking Calendar
        PermissionsModule, // Phase 9: Feature Access Control
        GoogleSyncModule, // Phase 10: Google Spreadsheet Sync
        VpnAccessModule, // Phase 11: VPN Access Tracking
        EFormRequestModule, // E-Form Access (VPN MVP)
        SharedGuardsModule, // Provides PageAccessGuard and FeatureAccessGuard with dependencies
        HardwareRequestModule,
        HrisGatewayModule,
        EncryptionModule, // Provides CredentialCipherService (AES-256-GCM) for at-rest credential protection
        ThrottlerModule.forRoot([{
            ttl: 60000, // 1 minute
            limit: 60, // 60 requests per minute (P0: lowered from 100 to leave headroom for per-endpoint overrides)
        }]),
    ],
    providers: [
        {
            provide: APP_GUARD,
            useClass: CustomThrottlerGuard,
        },
    ],
})
export class AppModule { }
// Force rebuild: Fix agent deletion code update
