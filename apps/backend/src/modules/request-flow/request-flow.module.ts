import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EFormRequestModule } from '../eform-request/eform-request.module';
import { HardwareRequestModule } from '../hardware-request/hardware-request.module';
import { TicketingModule } from '../ticketing/ticketing.module';
import { User } from '../users/entities/user.entity';
import { RequestDocumentRevision } from './entities/request-document-revision.entity';
import { RequestFlow } from './entities/request-flow.entity';
import { RequestFlowController } from './presentation/request-flow.controller';
import { RequestDocumentService } from './services/request-document.service';
import { RequestFlowNotifier } from './services/request-flow-notifier';
import { RequestFlowQueryService } from './services/request-flow-query.service';
import { RequestFlowReader } from './services/request-flow-reader';
import { RequestFlowReviewService } from './services/request-flow-review.service';
import { RequestFlowStepper } from './services/request-flow-stepper';
import { RequestFlowService } from './services/request-flow.service';
import { NotificationModule } from '../notifications/notification.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([RequestFlow, RequestDocumentRevision, User]),
        forwardRef(() => TicketingModule),
        HardwareRequestModule,
        EFormRequestModule,
        NotificationModule,
    ],
    controllers: [RequestFlowController],
    providers: [
        RequestFlowService, RequestFlowReviewService, RequestFlowReader, RequestFlowQueryService, RequestFlowStepper, RequestFlowNotifier, RequestDocumentService,
    ],
})
export class RequestFlowModule {}
