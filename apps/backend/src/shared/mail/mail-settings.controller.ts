import { Body, Controller, Get, Patch, Post, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../modules/auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/core/guards/roles.guard';
import { Roles } from '../../shared/core/decorators/roles.decorator';
import { UserRole } from '../../modules/users/enums/user-role.enum';
import { AuditService } from '../../modules/audit/audit.service';
import { AuditAction } from '../../modules/audit/entities/audit-log.entity';
import { MailConfigService } from './mail-config.service';
import { MailTransportService } from './mail-transport.service';
import { TestMailDto, UpdateMailSettingsDto, VerifyMailDto } from './dto/mail-settings.dto';

@Controller('settings/mail')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MailSettingsController {
    constructor(
        private readonly mailConfig: MailConfigService,
        private readonly transport: MailTransportService,
        private readonly audit: AuditService,
    ) {}

    @Get()
    @Roles(UserRole.ADMIN)
    async getConfig() {
        return this.mailConfig.getRedactedConfig();
    }

    @Patch()
    @Roles(UserRole.ADMIN)
    async updateConfig(
        @Body() dto: UpdateMailSettingsDto,
        @Request() req: any,
    ) {
        const { current, previous } = await this.mailConfig.saveConfig(dto, req.user?.userId);

        // Verify before invalidating cache — inform caller but allow force-save.
        const verify = await this.transport.verifyConfig(current);
        if (!verify.success) {
            // Do not roll back; admin may be saving intentionally unreachable config.
            // Invalidate so next real send uses new values.
            this.transport.invalidate();
            this.audit.logAsync({
                userId: req.user?.userId || 'system',
                action: AuditAction.SETTINGS_CHANGE,
                entityType: 'settings',
                entityId: 'mail.smtp',
                oldValue: { ...previous, password: previous.password ? '***' : '' },
                newValue: { ...current, password: current.password ? '***' : '' },
                description: `SMTP settings updated (verify failed: ${verify.error})`,
            });
            return { success: true, verifyFailed: true, verifyError: verify.error, config: await this.mailConfig.getRedactedConfig() };
        }

        this.transport.invalidate();
        this.audit.logAsync({
            userId: req.user?.userId || 'system',
            action: AuditAction.SETTINGS_CHANGE,
            entityType: 'settings',
            entityId: 'mail.smtp',
            oldValue: { ...previous, password: previous.password ? '***' : '' },
            newValue: { ...current, password: current.password ? '***' : '' },
            description: 'SMTP settings updated',
        });
        return { success: true, config: await this.mailConfig.getRedactedConfig() };
    }

    @Post('verify')
    @Roles(UserRole.ADMIN)
    async verify(@Body() dto: VerifyMailDto) {
        const effective = await this.mailConfig.getConfig();
        const candidate = { ...effective, ...Object.fromEntries(Object.entries(dto).filter(([, v]) => v !== undefined)) } as any;
        // Empty password in verify payload keeps stored one
        if (dto.password === undefined || dto.password === '') candidate.password = effective.password;
        const result = await this.transport.verifyConfig(candidate);
        return result;
    }

    @Post('test')
    @Roles(UserRole.ADMIN)
    async sendTest(@Body() dto: TestMailDto) {
        const result = await this.transport.send({
            to: dto.to,
            subject: '[iDesk] Test email — SMTP configuration',
            html: `<p>This is a test email from iDesk. If you received this, SMTP is configured correctly.</p><p>Time: ${new Date().toISOString()}</p>`,
        });
        if (result.skipped) return { success: false, skipped: true, error: result.error };
        if (!result.success) return { success: false, error: result.error };
        return { success: true, messageId: result.messageId };
    }
}
