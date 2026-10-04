import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Ticket } from '../../ticketing/entities/ticket.entity';
import { TicketModule } from '../../ticketing/entities/ticket-module.entity';
import { TicketAttribute } from '../../ticketing/entities/ticket-attribute.entity';
import { User } from '../../users/entities/user.entity';
import { TicketingModule } from '../../ticketing/ticketing.module';
import { WebhookOutbox } from './entities/webhook-outbox.entity';
import { IpopAuthGuard } from './ipop-auth.guard';
import { IpopCatalogService } from './ipop-catalog.service';
import { IpopTicketService } from './ipop-ticket.service';
import { IpopWebhookService } from './ipop-webhook.service';
import { IpopTicketEventsListener } from './ipop-ticket-events.listener';
import { IpopController } from './ipop.controller';

@Module({
    imports: [
        TypeOrmModule.forFeature([Ticket, TicketModule, TicketAttribute, User, WebhookOutbox]),
        TicketingModule,
    ],
    controllers: [IpopController],
    providers: [IpopAuthGuard, IpopCatalogService, IpopTicketService, IpopWebhookService, IpopTicketEventsListener],
})
export class IpopIntegrationModule {}
