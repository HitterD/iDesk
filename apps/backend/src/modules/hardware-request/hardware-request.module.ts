import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { NotificationModule } from '../notifications/notification.module';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { HardwareCatalog } from './domain/entities/hardware-catalog.entity';
import { HardwareRequest } from './domain/entities/hardware-request.entity';
import { HardwareRequestItem } from './domain/entities/hardware-request-item.entity';
import { HardwareRequestActivity } from './domain/entities/hardware-request-activity.entity';
import { HardwareRequestComment } from './domain/entities/hardware-request-comment.entity';
import { InstallationSchedule } from './domain/entities/installation-schedule.entity';
import { InstallationScheduleItem } from './domain/entities/installation-schedule-item.entity';
import { HardwareAsset } from './domain/entities/hardware-asset.entity';
import { HardwareCatalogService } from './services/hardware-catalog.service';
import { RequestNumberService } from './services/request-number.service';
import { HardwareRequestCommandService } from './services/hardware-request-command.service';
import { HardwareRequestQueryService } from './services/hardware-request-query.service';
import { HardwareCommentService } from './services/hardware-comment.service';
import { HardwareActivityService } from './services/hardware-activity.service';
import { InstallationScheduleService } from './services/installation-schedule.service';
import { HardwareAssetService } from './services/hardware-asset.service';
import { ProcurementDecisionService } from './services/procurement-decision.service';
import { DeliveryTrackingService } from './services/delivery-tracking.service';
import { MutualSchedulingService } from './services/mutual-scheduling.service';
import { HardwareDashboardService } from './services/hardware-dashboard.service';
import { HardwareCatalogController } from './presentation/hardware-catalog.controller';
import { HardwareRequestController } from './presentation/hardware-request.controller';
import { HardwareCommentController } from './presentation/hardware-comment.controller';
import { HardwareActivityController } from './presentation/hardware-activity.controller';
import { InstallationController } from './presentation/installation.controller';
import { HardwareDashboardController } from './presentation/hardware-dashboard.controller';
import { IctBudgetRedirectController } from './presentation/ict-budget-redirect.controller';
import { InAppNotifierListener } from './listeners/in-app-notifier.listener';
import { EmailNotifierListener } from './listeners/email-notifier.listener';
import { AgingReminderCron } from './listeners/aging-reminder.cron';
import { InstallAutoConfirmCron } from './listeners/install-auto-confirm.cron';
import { HardwareRequestGateway } from './realtime/hardware-request.gateway';
import { WsAuthGuard } from './realtime/ws-auth.guard';
import { HardwareScheduleTicketListener } from './listeners/hardware-schedule-ticket.listener';
import { Ticket } from '../ticketing/entities/ticket.entity';
import { TicketMessage } from '../ticketing/entities/ticket-message.entity';
import { User } from '../users/entities/user.entity';
import { WorkloadModule } from '../workload/workload.module';
import { TicketingModule } from '../ticketing/ticketing.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            HardwareCatalog,
            HardwareRequest,
            HardwareRequestItem,
            HardwareRequestActivity,
            HardwareRequestComment,
            InstallationSchedule,
            InstallationScheduleItem,
            HardwareAsset,
            Ticket,
            TicketMessage,
            User,
        ]),
        EventEmitterModule,
        forwardRef(() => AuthModule),
        forwardRef(() => NotificationModule),
        forwardRef(() => UsersModule),
        forwardRef(() => PermissionsModule),
        forwardRef(() => TicketingModule),
        WorkloadModule,
    ],
    controllers: [
        InstallationController,
        HardwareCatalogController,
        HardwareDashboardController,
        HardwareCommentController,
        HardwareActivityController,
        HardwareRequestController,
        IctBudgetRedirectController,
    ],
    providers: [
        HardwareCatalogService,
        RequestNumberService,
        HardwareRequestCommandService,
        HardwareRequestQueryService,
        HardwareCommentService,
        HardwareActivityService,
        InstallationScheduleService,
        HardwareAssetService,
        ProcurementDecisionService,
        DeliveryTrackingService,
        MutualSchedulingService,
        InAppNotifierListener,
        EmailNotifierListener,
        HardwareScheduleTicketListener,
        AgingReminderCron,
        InstallAutoConfirmCron,
        HardwareRequestGateway,
        WsAuthGuard,
        HardwareDashboardService,
    ],
    exports: [
        HardwareRequestCommandService,
        HardwareRequestQueryService,
        HardwareCommentService,
        HardwareActivityService,
        InstallationScheduleService,
        HardwareAssetService,
        ProcurementDecisionService,
        DeliveryTrackingService,
        MutualSchedulingService,
    ],
})
export class HardwareRequestModule {}
