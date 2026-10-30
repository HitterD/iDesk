import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../users/entities/user.entity';
import { WebhookOutbox } from '../ipop/entities/webhook-outbox.entity';
import { IpopIntegrationModule } from '../ipop/ipop.module';
import { IntegrationApp } from './entities/integration-app.entity';
import { IntegrationAppsService } from './integration-apps.service';
import { AppAuthGuard } from './app-auth.guard';
import { AppWebhookService } from './app-webhook.service';
import { AppTicketEventsListener } from './app-ticket-events.listener';
import { AppsApiController } from './apps-api.controller';
import { AppsAdminController } from './apps-admin.controller';
import { AppSourcesController } from './app-sources.controller';

/** Connected office apps (EBBK, ...): the iPop ticket API, per app, with its own secret, modules and permissions. */
@Module({
    imports: [TypeOrmModule.forFeature([IntegrationApp, WebhookOutbox, User]), IpopIntegrationModule],
    controllers: [AppsApiController, AppsAdminController, AppSourcesController],
    providers: [IntegrationAppsService, AppAuthGuard, AppWebhookService, AppTicketEventsListener],
})
export class IntegrationAppsModule {}
