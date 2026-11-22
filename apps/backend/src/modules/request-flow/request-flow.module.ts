import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EFormRequestModule } from '../eform-request/eform-request.module';
import { HardwareRequestModule } from '../hardware-request/hardware-request.module';
import { TicketingModule } from '../ticketing/ticketing.module';
import { User } from '../users/entities/user.entity';
import { RequestDocumentRevision } from './entities/request-document-revision.entity';
import { RequestFlow } from './entities/request-flow.entity';
import { RequestFlowController } from './presentation/request-flow.controller';
import { RequestFlowService } from './services/request-flow.service';

@Module({
    imports: [
        TypeOrmModule.forFeature([RequestFlow, RequestDocumentRevision, User]),
        forwardRef(() => TicketingModule),
        HardwareRequestModule,
        EFormRequestModule,
    ],
    controllers: [RequestFlowController],
    providers: [RequestFlowService],
})
export class RequestFlowModule {}
