import { Module, forwardRef, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Entities
import { Notification } from './entities/notification.entity';
import { NotificationPreference } from './entities/notification-preference.entity';
import { NotificationLog } from './entities/notification-log.entity';
import { User } from '../users/entities/user.entity';

// Services
import { NotificationService } from './notification.service';
import { NotificationCenterService } from './notification-center.service';

// Channels
import { EmailChannelService } from './channels/email-channel.service';
import { TelegramChannelService } from './channels/telegram-channel.service';
import { InAppChannelService } from './channels/inapp-channel.service';

// Controllers
import { NotificationController } from './notification.controller';
import { NotificationPreferencesController } from './notification-preferences.controller';

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
            User,
        ]),
        forwardRef(() => TicketingModule),
        forwardRef(() => TelegramModule),
    ],
    controllers: [
        NotificationController,
        NotificationPreferencesController,
    ],
    providers: [
        // Core services
        NotificationService,
        NotificationCenterService,

        // Channel services
        EmailChannelService,
        TelegramChannelService,
        InAppChannelService,
        // Note: EventsGateway is imported from TicketingModule, not provided here
    ],
    exports: [
        NotificationService,
        NotificationCenterService,
        EmailChannelService,
        TelegramChannelService,
        InAppChannelService,
    ],
})
export class NotificationModule { }
