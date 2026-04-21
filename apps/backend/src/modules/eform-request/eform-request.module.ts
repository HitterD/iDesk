import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationModule } from '../notifications/notification.module';
import { SettingsModule } from '../settings/settings.module';
import { EFormRequest, EFormApproval, EFormSignature, EFormCredential } from './entities';
import { EFormRequestService } from './eform-request.service';
import { EFormCredentialService } from './eform-credential.service';
import { EFormPdfService } from './eform-pdf.service';
import { EFormRequestController } from './eform-request.controller';
import { EFormNotificationListener } from './listeners/eform-notification.listener';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EFormRequest,
      EFormApproval,
      EFormSignature,
      EFormCredential,
    ]),
    NotificationModule,
    SettingsModule,
    AuditModule,
  ],
  controllers: [EFormRequestController],
  providers: [
    EFormRequestService, 
    EFormCredentialService, 
    EFormPdfService,
    EFormNotificationListener
  ],
  exports: [EFormRequestService, EFormPdfService],
})
export class EFormRequestModule {}
