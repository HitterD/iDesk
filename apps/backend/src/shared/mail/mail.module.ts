import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SettingsModule } from '../../modules/settings/settings.module';
import { MailConfigService } from './mail-config.service';
import { MailTransportService } from './mail-transport.service';
import { MailDispatchService } from './mail-dispatch.service';
import { MailSettingsController } from './mail-settings.controller';
import { EmailProcessor } from './email.processor';

/**
 * Database-backed email infrastructure.
 *
 * Global because email is a cross-cutting side effect: many services across
 * ticketing, users, reports, zoom and hardware-request send mail.
 * AuditModule is already @Global so the controller can inject AuditService.
 */
@Global()
@Module({
    imports: [ConfigModule, SettingsModule],
    controllers: [MailSettingsController],
    providers: [MailConfigService, MailTransportService, MailDispatchService, EmailProcessor],
    exports: [MailConfigService, MailTransportService, MailDispatchService],
})
export class MailModule {}
