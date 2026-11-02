import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationModule } from '../notifications/notification.module';
import { SettingsModule } from '../settings/settings.module';
import { User } from '../users/entities/user.entity';
import { Site } from '../sites/entities/site.entity';
import { EFormRequest, EFormApproval, EFormSignature, EFormCredential } from './entities';
import { EFormRequestService } from './eform-request.service';
import { EFormCredentialService } from './eform-credential.service';
import { EFormPdfService } from './eform-pdf.service';
import { EFormRequestController } from './eform-request.controller';
import { EFormDocumentController } from './eform-document.controller';
import { EFormDocumentService } from './eform-document.service';
import { EFormGmService } from './eform-gm.service';
import { EFormNotificationListener } from './listeners/eform-notification.listener';
import { EFormExpirationReminderCron } from './listeners/eform-expiration-reminder.cron';
import { AuditModule } from '../audit/audit.module';

import { SynologyModule } from '../synology/synology.module';
import { SynologyNasBrowseService } from './synology-nas-browse.service';
import { Ticket } from '../ticketing/entities/ticket.entity';
import { TicketingModule } from '../ticketing/ticketing.module';
import { TicketEFormController } from './ticket-link/ticket-eform.controller';
import { TicketEFormService } from './ticket-link/ticket-eform.service';
import { TicketEFormLinkService } from './ticket-link/ticket-eform-link.service';
import { TicketEFormSyncListener } from './ticket-link/ticket-eform-sync.listener';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EFormRequest,
      EFormApproval,
      EFormSignature,
      EFormCredential,
      User,
      Site,
      Ticket,
    ]),
    NotificationModule,
    SettingsModule,
    AuditModule,
    ConfigModule,
    SynologyModule,
    forwardRef(() => TicketingModule),
  ],
  controllers: [EFormRequestController, EFormDocumentController, TicketEFormController],
  providers: [
    EFormRequestService, 
    EFormCredentialService, 
    EFormPdfService,
    EFormDocumentService,
    EFormGmService,
    SynologyNasBrowseService,
    EFormNotificationListener,
    EFormExpirationReminderCron,
    // Access proposed from IT support tickets, mirrored back onto the ticket.
    TicketEFormService,
    TicketEFormLinkService,
    TicketEFormSyncListener,
  ],
  exports: [EFormRequestService, EFormPdfService, SynologyNasBrowseService],
})
export class EFormRequestModule {}
