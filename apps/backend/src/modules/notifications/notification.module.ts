import { Module, forwardRef, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Entities
import { Notification } from './entities/notification.entity';
import { NotificationPreference } from './entities/notification-preference.entity';
import { NotificationLog } from './entities/notification-log.entity';
import { PushSubscription } from './entities/push-subscription.entity';
import { User } from '../users/entities/user.entity';

// Services
import { NotificationService } from './notification.service';
import { NotificationCenterService } from './notification-center.service';

// Channels
import { EmailChannelService } from './channels/email-channel.service';
import { TelegramChannelService } from './channels/telegram-channel.service';
import { InAppChannelService } from './channels/inapp-channel.service';
import { PushChannelService } from './channels/push-channel.service';

// Controllers
import { NotificationController } from './notification.controller';
import { NotificationPreferencesController } from './notification-preferences.controller';
import { PushSubscriptionController } from './push-subscription.controller';

// Related modules
import { TicketingModule } from '../ticketing/ticketing.module';
import { TelegramModule } from '../telegram/telegram.module';
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
        ]),
        forwardRef(() => TicketingModule),
        forwardRef(() => TelegramModule),
    ],
    controllers: [
        NotificationController,
        NotificationPreferencesController,
        PushSubscriptionController,
    ],
    providers: [
        // Core services
        NotificationService,
        NotificationCenterService,

        // Channel services
        EmailChannelService,
        TelegramChannelService,
        InAppChannelService,
        PushChannelService,
        // Note: EventsGateway is imported from TicketingModule, not provided here
    ],
    exports: [
        NotificationService,
        NotificationCenterService,
        EmailChannelService,
        TelegramChannelService,
        InAppChannelService,
        PushChannelService,
    ],
})
export class NotificationModule { }

