import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { ThrottlerModule } from '@nestjs/throttler';
import { CustomThrottlerGuard } from './shared/core/guards/custom-throttler.guard';
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
import { AuditModule } from './modules/audit';
import { BusinessHours } from './modules/sla-config/entities/business-hours.entity';
import { AutomationModule } from './modules/automation/automation.module';
import { WorkflowRule } from './modules/automation/entities/workflow-rule.entity';
import { WorkflowExecution } from './modules/automation/entities/workflow-execution.entity';
import { SettingsModule } from './modules/settings/settings.module';
import { SystemSettings } from './modules/settings/entities/system-settings.entity';

// New entities for Phase 0
import { Site } from './modules/sites/entities/site.entity';
import { IctBudgetRequest } from './modules/ict-budget/entities/ict-budget-request.entity';
import { LostItemReport } from './modules/lost-item/entities/lost-item-report.entity';
import { AccessType } from './modules/access-request/entities/access-type.entity';
import { AccessRequest } from './modules/access-request/entities/access-request.entity';
import { PriorityWeight } from './modules/workload/entities/priority-weight.entity';
import { AgentDailyWorkload } from './modules/workload/entities/agent-daily-workload.entity';
import { NotificationSound } from './modules/sound/entities/notification-sound.entity';
import { BackupConfiguration } from './modules/synology/entities/backup-configuration.entity';
import { BackupHistory } from './modules/synology/entities/backup-history.entity';
import { IpWhitelist } from './modules/ip-whitelist/entities/ip-whitelist.entity';

// New modules for Phase 1
import { SitesModule } from './modules/sites/sites.module';

// New modules for Phase 2
import { IctBudgetModule } from './modules/ict-budget/ict-budget.module';
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
            port: parseInt(process.env.DB_PORT, 10) || 5432,
            username: process.env.DB_USERNAME || 'postgres',
            password: process.env.DB_PASSWORD || 'postgres',
            database: process.env.DB_DATABASE || 'idesk_db',
            entities: [
                // Existing entities
                User, Ticket, TicketMessage, CustomerSession, Department, SlaConfig,
                SavedReply, TicketSurvey, TicketTemplate, TicketAttribute, Article,
                ArticleView, Notification, NotificationPreference, NotificationLog,
                TelegramSession, SavedSearch, RenewalContract, AuditLog, BusinessHours,
                WorkflowRule, WorkflowExecution, SystemSettings,
                // New entities (Phase 0)
                Site, IctBudgetRequest, LostItemReport, AccessType, AccessRequest,
                PriorityWeight, AgentDailyWorkload, NotificationSound,
                BackupConfiguration, BackupHistory,
                // New entities (Phase 7)
                IpWhitelist,
                // New entities (Phase 8: Zoom Booking)
                ZoomAccount, ZoomBooking, ZoomMeeting, ZoomParticipant, ZoomSettings, ZoomAuditLog,
                // New entities (Phase 9: Permissions)
                FeatureDefinition, UserFeaturePermission, PermissionPreset,
            ],
            // SECURITY: Use migrations in production, never auto-sync
            synchronize: process.env.NODE_ENV !== 'production',
            // Enable migrations for production
            migrationsRun: process.env.NODE_ENV === 'production',
            migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
            logging: process.env.DB_LOGGING === 'true',
            // Connection Pool Configuration (Section 5.3.B)
            extra: {
                max: parseInt(process.env.DB_POOL_MAX, 10) || 20,
                min: parseInt(process.env.DB_POOL_MIN, 10) || 5,
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
                port: parseInt(process.env.SMTP_PORT, 10) || 587,
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
                dir: join(__dirname, 'assets', 'templates'),
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
        IctBudgetModule, // Phase 2: Ticket Types
        LostItemModule, // Phase 2: Ticket Types
        AccessRequestModule, // Phase 2: Ticket Types
        WorkloadModule, // Phase 3: Auto-Assignment
        SoundModule, // Phase 4: Sound Notifications
        SynologyModule, // Phase 4: Synology Backup
        ManagerModule, // Phase 6: Manager Dashboard
        IpWhitelistModule, // Phase 7: IP Whitelist Management
        ZoomBookingModule, // Phase 8: Zoom Booking Calendar
        PermissionsModule, // Phase 9: Feature Access Control
        ThrottlerModule.forRoot([{
            ttl: 60000, // 1 minute
            limit: 100, // 100 requests per minute
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
