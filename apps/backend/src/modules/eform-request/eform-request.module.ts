import { Module } from '@nestjs/common';
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
import { EFormNotificationListener } from './listeners/eform-notification.listener';
import { EFormExpirationReminderCron } from './listeners/eform-expiration-reminder.cron';
import { AuditModule } from '../audit/audit.module';

import { SynologyModule } from '../synology/synology.module';
import { SynologyNasBrowseService } from './synology-nas-browse.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EFormRequest,
      EFormApproval,
      EFormSignature,
      EFormCredential,
      User,
      Site,
    ]),
    NotificationModule,
    SettingsModule,
    AuditModule,
    ConfigModule,
    SynologyModule,
  ],
  controllers: [EFormRequestController],
  providers: [
    EFormRequestService, 
    EFormCredentialService, 
    EFormPdfService,
    SynologyNasBrowseService,
    EFormNotificationListener,
    EFormExpirationReminderCron,
  ],
  exports: [EFormRequestService, EFormPdfService, SynologyNasBrowseService],
})
export class EFormRequestModule {}
