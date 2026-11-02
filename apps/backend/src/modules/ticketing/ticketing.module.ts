import { Module, forwardRef } from '@nestjs/common';
import { TicketNotesController } from './notes/ticket-notes.controller';
import { TicketNoteNotificationService } from './notes/ticket-note-notification.service';
import { TicketNotePublicShareService } from './notes/ticket-note-public-share.service';
import { TicketNoteUploadGuard } from './notes/ticket-note-upload.guard';
import { TicketNoteAccessService } from './notes/ticket-note-access.service';
import { TicketNoteCommandService } from './notes/ticket-note-command.service';
import { TicketNoteQueryService } from './notes/ticket-note-query.service';
import { TicketNoteDocumentService } from './notes/ticket-note-document.service';
import { TicketNoteDiscussionService } from './notes/ticket-note-discussion.service';
import { TicketNoteAttachmentService } from './notes/ticket-note-attachment.service';
import { TicketNote } from './notes/entities/ticket-note.entity';
import { TicketNoteMember } from './notes/entities/ticket-note-member.entity';
import { TicketNoteMessage } from './notes/entities/ticket-note-message.entity';
import { TicketNoteEditSession } from './notes/entities/ticket-note-edit-session.entity';
import { TicketNoteRevision } from './notes/entities/ticket-note-revision.entity';
import { TicketNoteAttachment } from './notes/entities/ticket-note-attachment.entity';
import { TicketNoteDelivery } from './notes/entities/ticket-note-delivery.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { TicketsController } from './presentation/tickets.controller';
import { TicketTemplatesController } from './presentation/ticket-templates.controller';
import { TicketModulesController } from './presentation/ticket-modules.controller';
import { Ticket } from './entities/ticket.entity';
import { TicketMessage } from './entities/ticket-message.entity';
import { TicketMessageEdit } from './entities/ticket-message-edit.entity';
import { TicketMessageEditService } from './services/ticket-message-edit.service';
import { TicketMessagePinService } from './services/ticket-message-pin.service';
import { TicketMessagesController } from './presentation/ticket-messages.controller';
import { TicketParticipant } from './entities/ticket-participant.entity';
import { TicketTemplate } from './entities/ticket-template.entity';
import { TicketModule as TicketModuleEntity } from './entities/ticket-module.entity';
import { User } from '../users/entities/user.entity';
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
import { NotificationModule } from '../notifications/notification.module';
import { SlaConfigModule } from '../sla-config/sla-config.module';
import { SlaClockService } from './services/sla-clock.service';
import { WorkloadModule } from '../workload/workload.module';
import { TicketLinkedRequestService } from './services/ticket-linked-request.service';
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
import { TicketAttachmentAccessService } from './services/ticket-attachment-access.service';
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
import { TicketChatPushListener } from './listeners/ticket-chat-push.listener';

import { TicketReminder } from './entities/ticket-reminder.entity';
import { TicketReminderService } from './services/ticket-reminder.service';
import { TicketVendorVisitService } from './services/ticket-vendor-visit.service';
import { TicketReminderSchedulerService } from './services/ticket-reminder-scheduler.service';
import { TicketAssignment } from './entities/ticket-assignment.entity';
import { AgentRating } from './entities/agent-rating.entity';
import { TicketResolutionService } from './services/ticket-resolution.service';
import { AgentRatingService } from './services/agent-rating.service';
import { TicketAutoCloseCron } from './services/ticket-auto-close.cron';
import { AgentRatingsController } from './presentation/agent-ratings.controller';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            TicketNote, TicketNoteMember, TicketNoteMessage, TicketNoteEditSession,
            TicketNoteRevision, TicketNoteAttachment, TicketNoteDelivery,
            Ticket,
            TicketMessage,
            TicketMessageEdit,
            TicketParticipant,
            TicketTemplate,
            TicketModuleEntity,
            User,
            SlaConfig,
            SavedReply,
            TicketSurvey,
            TicketAttribute,
            TimeEntry,
            NotificationPreference,
            SlaAdjustment,
            TicketReminder,
            TicketAssignment,
            AgentRating,
        ]),
        ReportsModule,
        KnowledgeBaseModule,
        MailerModule,
        AuthModule,
        SlaConfigModule,  // Provides BusinessHoursService for SLA calculation
        WorkloadModule,   // Provides WorkloadService for auto-assignment
        ModuleAssignmentPolicyModule, // Provides the per-module assignment guard
        forwardRef(() => NotificationModule),
        CacheModule.register(),
    ],
    controllers: [
        TicketNotesController,
        TicketsController,
        TicketMessagesController,
        TicketTemplatesController,
        TicketModulesController,
        SlaConfigController,
        SavedRepliesController,
        SurveysController,
        TicketAttributesController,
        TimeTrackingController,
        AgentRatingsController,
    ],
    providers: [
        TicketNoteUploadGuard, TicketNoteAccessService, TicketNoteCommandService, TicketNoteQueryService,
        TicketNoteDocumentService, TicketNoteDiscussionService, TicketNoteAttachmentService, TicketNoteNotificationService, TicketNotePublicShareService,
        // Core services (Split)
        TicketMessageEditService,
        TicketMessagePinService,
        TicketLinkedRequestService,
        TicketCreateService,
        TicketUpdateService,
        SlaClockService,
        TicketMessagingService,
        TicketQueryService,
        TicketAttachmentAccessService,
        TicketTemplateService,
        TicketModulesService,
        TicketMergeService,
        TicketParticipantService,
        TicketSlaExtendService,
        TicketForwardService,
        TicketReminderService,
        TicketReminderSchedulerService,
        TicketVendorVisitService,
        TimeTrackingService,
        TicketResolutionService,
        AgentRatingService,
        TicketAutoCloseCron,

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
        TicketChatPushListener,
    ],
    exports: [
        TicketLinkedRequestService,
        TicketCreateService,
        TicketUpdateService,
        SlaClockService,
        TicketVendorVisitService,
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

