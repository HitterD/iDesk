import { Module, forwardRef, OnModuleInit } from '@nestjs/common';
import { TicketNoteAccessService } from '../ticketing/notes/ticket-note-access.service';
import { TicketNoteActionItemsService } from '../ticketing/notes/ticket-note-action-items.service';
import { TicketNoteQueryService } from '../ticketing/notes/ticket-note-query.service';
import { TicketNoteVisibilityService } from '../ticketing/notes/ticket-note-visibility.service';
import { TypeOrmModule } from '@nestjs/typeorm';

// Entities
import { Notification } from './entities/notification.entity';
import { NotificationPreference } from './entities/notification-preference.entity';
import { NotificationLog } from './entities/notification-log.entity';
import { PushSubscription } from './entities/push-subscription.entity';
import { ActionItemSnooze } from './entities/action-item-snooze.entity';
import { User } from '../users/entities/user.entity';

// Services
import { NotificationService } from './notification.service';
import { NotificationCenterService } from './notification-center.service';

// Channels
import { EmailChannelService } from './channels/email-channel.service';
import { InAppChannelService } from './channels/inapp-channel.service';
import { PushChannelService } from './channels/push-channel.service';
import { NotificationPushService } from './notification-push.service';

// Controllers
import { NotificationController } from './notification.controller';
import { NotificationPreferencesController } from './notification-preferences.controller';
import { PushSubscriptionController } from './push-subscription.controller';

// Related modules
import { TicketingModule } from '../ticketing/ticketing.module';
import { SjaAdapterModule } from '../sja-adapter/sja-adapter.module';
import { TicketCreateService } from '../ticketing/services/ticket-create.service';
import { TicketUpdateService } from '../ticketing/services/ticket-update.service';
import { TicketMessagingService } from '../ticketing/services/ticket-messaging.service';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            Notification,
            NotificationPreference,
            NotificationLog,
            PushSubscription,
            User,
            ActionItemSnooze,
        ]),
        forwardRef(() => TicketingModule),
        SjaAdapterModule,
    ],
    controllers: [
        NotificationController,
        NotificationPreferencesController,
        PushSubscriptionController,
    ],
    providers: [
        // Core services
        TicketNoteAccessService,
        TicketNoteVisibilityService,
        TicketNoteActionItemsService,
        TicketNoteQueryService,
        NotificationService,
        NotificationCenterService,

        // Channel services
        EmailChannelService,
        InAppChannelService,
        PushChannelService,
        NotificationPushService,
        // Note: EventsGateway is imported from TicketingModule, not provided here
    ],
    exports: [
        NotificationService,
        NotificationCenterService,
        EmailChannelService,
        InAppChannelService,
        PushChannelService,
    ],
})
export class NotificationModule { }

