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

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: '.env',
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
            entities: [User, Ticket, TicketMessage, CustomerSession, Department, SlaConfig, SavedReply, TicketSurvey, TicketAttribute, Article, ArticleView, Notification, NotificationPreference, NotificationLog, TelegramSession, SavedSearch, RenewalContract],
            // SECURITY: Use migrations in production, never auto-sync
            synchronize: process.env.NODE_ENV !== 'production',
            // Enable migrations for production
            migrationsRun: process.env.NODE_ENV === 'production',
            migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
            logging: process.env.DB_LOGGING === 'true',
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
