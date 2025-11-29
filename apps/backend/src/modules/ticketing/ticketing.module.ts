import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { TicketsController } from './presentation/tickets.controller';
import { TicketTemplatesController } from './presentation/ticket-templates.controller';
import { Ticket } from './entities/ticket.entity';
import { TicketMessage } from './entities/ticket-message.entity';
import { TicketTemplate } from './entities/ticket-template.entity';
import { User } from '../users/entities/user.entity';
import { CustomerSession } from '../users/entities/customer-session.entity';
import { EventsGateway } from './presentation/gateways/events.gateway';
import { SlaCheckerService } from './sla-checker.service';
import { ReportsModule } from '../reports/reports.module';
import { KnowledgeBaseModule } from '../knowledge-base/knowledge-base.module';
import { MailerModule } from '@nestjs-modules/mailer';
import { SlaConfig } from './entities/sla-config.entity';
import { SlaConfigService } from './sla-config.service';
import { SlaConfigController } from './presentation/sla-config.controller';
import { AuthModule } from '../auth/auth.module';
import { TelegramModule } from '../telegram/telegram.module';
import { NotificationModule } from '../notifications/notification.module';

import { SavedReply } from './entities/saved-reply.entity';
import { SavedRepliesService } from './saved-replies.service';
import { SavedRepliesController } from './presentation/saved-replies.controller';
import { TicketSurvey } from './entities/ticket-survey.entity';
import { SurveysService } from './surveys.service';
import { SurveysController } from './presentation/surveys.controller';
import { TicketAttribute } from './entities/ticket-attribute.entity';
import { TicketAttributesService } from './ticket-attributes.service';
import { TicketAttributesController } from './presentation/ticket-attributes.controller';

// New refactored services
import { TicketCreateService } from './services/ticket-create.service';
import { TicketUpdateService } from './services/ticket-update.service';
import { TicketMessagingService } from './services/ticket-messaging.service';
import { TicketQueryService } from './services/ticket-query.service';
import { TicketTemplateService } from './services/ticket-template.service';
import { TicketMergeService } from './services/ticket-merge.service';

// Legacy/Partial refactored services (keeping for safety if used elsewhere)
import { TicketRepository } from './repositories/ticket.repository';
import { TicketNotificationService } from './services/ticket-notification.service';
import { TicketStatsService } from './services/ticket-stats.service';
import { TicketNotificationListener } from './listeners/ticket-notification.listener';

@Module({
    imports: [
        TypeOrmModule.forFeature([Ticket, TicketMessage, TicketTemplate, User, CustomerSession, SlaConfig, SavedReply, TicketSurvey, TicketAttribute]),
        ReportsModule,
        KnowledgeBaseModule,
        MailerModule,
        AuthModule,
        forwardRef(() => TelegramModule),
        forwardRef(() => TelegramModule),
        forwardRef(() => NotificationModule),
        CacheModule.register(),
    ],
    controllers: [TicketsController, TicketTemplatesController, SlaConfigController, SavedRepliesController, SurveysController, TicketAttributesController],
    providers: [
        // Core services (Split)
        TicketCreateService,
        TicketUpdateService,
        TicketMessagingService,
        TicketQueryService,
        TicketTemplateService,
        TicketMergeService,

        SlaCheckerService,
        SlaConfigService,
        SavedRepliesService,
        SurveysService,
        TicketAttributesService,
        EventsGateway,
        // Refactored services (Repository Pattern)
        TicketRepository,
        TicketNotificationService,
        TicketStatsService,
        TicketNotificationListener,
    ],
    exports: [
        TicketCreateService,
        TicketUpdateService,
        TicketMessagingService,
        TicketQueryService,
        TicketTemplateService,
        TicketMergeService,
        EventsGateway,
        TicketRepository,
        TicketNotificationService,
        TicketStatsService
    ],
})
export class TicketingModule { }
