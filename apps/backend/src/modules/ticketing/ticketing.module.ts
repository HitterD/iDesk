import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { TicketsController } from './presentation/tickets.controller';
import { TicketTemplatesController } from './presentation/ticket-templates.controller';
import { TicketModulesController } from './presentation/ticket-modules.controller';
import { Ticket } from './entities/ticket.entity';
import { TicketMessage } from './entities/ticket-message.entity';
import { TicketParticipant } from './entities/ticket-participant.entity';
import { TicketTemplate } from './entities/ticket-template.entity';
import { TicketModule as TicketModuleEntity } from './entities/ticket-module.entity';
import { User } from '../users/entities/user.entity';
import { CustomerSession } from '../users/entities/customer-session.entity';
import { EventsGateway } from './presentation/gateways/events.gateway';
import { SlaCheckerService } from './sla-checker.service';
import { TicketSlaExtendService } from './services/ticket-sla-extend.service';
import { TicketForwardService } from './services/ticket-forward.service';
import { ReportsModule } from '../reports/reports.module';
import { KnowledgeBaseModule } from '../knowledge-base/knowledge-base.module';
import { MailerModule } from '@nestjs-modules/mailer';
import { SlaConfig } from './entities/sla-config.entity';
import { SlaConfigService } from './sla-config.service';
import { SlaConfigController } from './presentation/sla-config.controller';
import { AuthModule } from '../auth/auth.module';
import { TelegramModule } from '../telegram/telegram.module';
import { NotificationModule } from '../notifications/notification.module';
import { SlaConfigModule } from '../sla-config/sla-config.module';
import { WorkloadModule } from '../workload/workload.module';
import { ModuleAssignmentPolicyModule } from './module-assignment-policy.module';

import { SavedReply } from './entities/saved-reply.entity';
import { SlaAdjustment } from './entities/sla-adjustment.entity';
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
import { TicketModulesService } from './services/ticket-modules.service';
import { TicketMergeService } from './services/ticket-merge.service';
import { TicketParticipantService } from './services/ticket-participant.service';
import { TimeTrackingService } from './services/time-tracking.service';
import { TimeEntry } from './entities/time-entry.entity';
import { TimeTrackingController } from './presentation/time-tracking.controller';
import { NotificationPreference } from '../notifications/entities/notification-preference.entity';


// Legacy/Partial refactored services (keeping for safety if used elsewhere)
import { TicketRepository } from './repositories/ticket.repository';
import { TicketNotificationService } from './services/ticket-notification.service';
import { TicketStatsService } from './services/ticket-stats.service';
import { TicketNotificationListener } from './listeners/ticket-notification.listener';

import { TicketReminder } from './entities/ticket-reminder.entity';
import { TicketReminderService } from './services/ticket-reminder.service';
import { TicketReminderSchedulerService } from './services/ticket-reminder-scheduler.service';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            Ticket,
            TicketMessage,
            TicketParticipant,
            TicketTemplate,
            TicketModuleEntity,
            User,
            CustomerSession,
            SlaConfig,
            SavedReply,
            TicketSurvey,
            TicketAttribute,
            TimeEntry,
            NotificationPreference,
            SlaAdjustment,
            TicketReminder,
        ]),
        ReportsModule,
        KnowledgeBaseModule,
        MailerModule,
        AuthModule,
        SlaConfigModule,  // Provides BusinessHoursService for SLA calculation
        WorkloadModule,   // Provides WorkloadService for auto-assignment
        ModuleAssignmentPolicyModule, // Provides the per-module assignment guard
        forwardRef(() => TelegramModule),
        forwardRef(() => NotificationModule),
        CacheModule.register(),
    ],
    controllers: [
        TicketsController,
        TicketTemplatesController,
        TicketModulesController,
        SlaConfigController,
        SavedRepliesController,
        SurveysController,
        TicketAttributesController,
        TimeTrackingController,
    ],
    providers: [
        // Core services (Split)
        TicketCreateService,
        TicketUpdateService,
        TicketMessagingService,
        TicketQueryService,
        TicketTemplateService,
        TicketModulesService,
        TicketMergeService,
        TicketParticipantService,
        TicketSlaExtendService,
        TicketForwardService,
        TicketReminderService,
        TicketReminderSchedulerService,
        TimeTrackingService,

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
        TicketModulesService,
        TicketMergeService,
        TicketParticipantService,
        TicketReminderService,
        TimeTrackingService,
        EventsGateway,
        TicketRepository,
        TicketNotificationService,
        TicketStatsService,
    ],
})
export class TicketingModule { }

