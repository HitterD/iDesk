import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TicketService } from './ticket.service';
import { TelegramAdapter } from './infrastructure/adapters/telegram.adapter';
import { TelegramController } from './presentation/telegram.controller';
import { TicketsController } from './presentation/tickets.controller';
import { WebhookController } from './presentation/webhook.controller';
import { Ticket } from './entities/ticket.entity';
import { TicketMessage } from './entities/ticket-message.entity';
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

import { SavedReply } from './entities/saved-reply.entity';
import { SavedRepliesService } from './saved-replies.service';
import { SavedRepliesController } from './presentation/saved-replies.controller';
import { TicketSurvey } from './entities/ticket-survey.entity';
import { SurveysService } from './surveys.service';
import { SurveysController } from './presentation/surveys.controller';

@Module({
    imports: [
        TypeOrmModule.forFeature([Ticket, TicketMessage, User, CustomerSession, SlaConfig, SavedReply, TicketSurvey]),
        ReportsModule,
        KnowledgeBaseModule,
        MailerModule,
        AuthModule,
    ],
    controllers: [TelegramController, TicketsController, WebhookController, SlaConfigController, SavedRepliesController, SurveysController],
    providers: [
        TicketService,
        SlaCheckerService,
        SlaConfigService,
        SavedRepliesService,
        SurveysService,
        EventsGateway,
        {
            provide: 'ChatPlatform',
            useClass: TelegramAdapter,
        },
    ],
    exports: [TicketService],
})
export class TicketingModule { }
