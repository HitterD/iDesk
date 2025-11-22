import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
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

import { ScheduleModule } from '@nestjs/schedule';
import { ReportsModule } from './modules/reports/reports.module';
import { KnowledgeBaseModule } from './modules/knowledge-base/knowledge-base.module';

@Module({
    imports: [
        ReportsModule,
        KnowledgeBaseModule,
        ScheduleModule.forRoot(),
        TypeOrmModule.forRoot({
            type: 'postgres',
            host: process.env.DB_HOST || 'localhost',
            port: parseInt(process.env.DB_PORT, 10) || 5432,
            username: process.env.DB_USERNAME || 'postgres',
            password: process.env.DB_PASSWORD || 'postgres',
            database: process.env.DB_DATABASE || 'idesk_db',
            entities: [User, Ticket, TicketMessage, CustomerSession, Department, SlaConfig, SavedReply],
            synchronize: true, // Auto-create tables (Dev only)
        }),
        ServeStaticModule.forRoot({
            rootPath: join(__dirname, '..', '..', 'uploads'), // Adjust path based on dist/ structure
            serveRoot: '/uploads',
        }),
        MailerModule.forRoot({
            transport: {
                host: 'smtp.ethereal.email',
                port: 587,
                secure: false,
                auth: {
                    user: 'ethereal.user@ethereal.email', // Placeholder, will be logged in console
                    pass: 'ethereal.pass',
                },
            },
            defaults: {
                from: '"No Reply" <noreply@idesk.com>',
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
        ThrottlerModule.forRoot([{
            ttl: 60000, // 1 minute
            limit: 100, // 100 requests per minute
        }]),
    ],
    providers: [
        {
            provide: APP_GUARD,
            useClass: ThrottlerGuard,
        },
    ],
})
export class AppModule { }
