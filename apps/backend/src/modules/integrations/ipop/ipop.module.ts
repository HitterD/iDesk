import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Ticket } from '../../ticketing/entities/ticket.entity';
import { TicketMessage } from '../../ticketing/entities/ticket-message.entity';
import { TicketModule } from '../../ticketing/entities/ticket-module.entity';
import { TicketAttribute } from '../../ticketing/entities/ticket-attribute.entity';
import { User } from '../../users/entities/user.entity';
import { ZoomBooking } from '../../zoom-booking/entities/zoom-booking.entity';
import { TicketingModule } from '../../ticketing/ticketing.module';
import { WebhookOutbox } from './entities/webhook-outbox.entity';
import { IpopAuthGuard } from './ipop-auth.guard';
import { IpopCatalogService } from './ipop-catalog.service';
import { IpopTicketService } from './ipop-ticket.service';
import { IpopWebhookService } from './ipop-webhook.service';
import { IpopTicketEventsListener } from './ipop-ticket-events.listener';
import { IpopZoomBookingService } from './ipop-zoom-booking.service';
import { IpopZoomEventsListener } from './ipop-zoom-events.listener';
import { IpopController } from './ipop.controller';

@Module({
    imports: [
        TypeOrmModule.forFeature([Ticket, TicketMessage, TicketModule, TicketAttribute, User, ZoomBooking, WebhookOutbox]),
        TicketingModule,
    ],
    controllers: [IpopController],
    providers: [
        IpopAuthGuard, IpopCatalogService, IpopTicketService, IpopWebhookService, IpopTicketEventsListener,
        IpopZoomBookingService, IpopZoomEventsListener,
    ],
})
export class IpopIntegrationModule {}
