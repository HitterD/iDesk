import {
    Controller,
    Get,
    Put,
    Patch,
    Body,
    Request,
    UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/infrastructure/guards/jwt-auth.guard';
import { NotificationCenterService } from './notification-center.service';
import { NotificationPreference, DigestFrequency } from './entities/notification-preference.entity';
import { NotificationType } from './entities/notification.entity';

// DTO for updating preferences
class UpdatePreferencesDto {
    inAppEnabled?: boolean;
    emailEnabled?: boolean;
    telegramEnabled?: boolean;
    pushEnabled?: boolean;
    emailAddress?: string;
    telegramChatId?: string;
    digestEnabled?: boolean;
    digestFrequency?: DigestFrequency;
    digestTime?: string;
    quietHoursEnabled?: boolean;
    quietHoursStart?: string;
    quietHoursEnd?: string;
    timezone?: string;
}

class UpdateTypePreferenceDto {
    notificationType: NotificationType;
    channels: {
        inApp?: boolean;
        email?: boolean;
        telegram?: boolean;
        push?: boolean;
    };
}

@ApiTags('Notification Preferences')
@ApiBearerAuth()
@Controller('notifications/preferences')
@UseGuards(JwtAuthGuard)
export class NotificationPreferencesController {
    constructor(private readonly notificationCenter: NotificationCenterService) { }

    @Get()
    @ApiOperation({ summary: 'Get current user notification preferences' })
    @ApiResponse({ status: 200, description: 'Returns notification preferences' })
    async getPreferences(@Request() req: any): Promise<NotificationPreference> {
        return this.notificationCenter.getOrCreatePreferences(req.user.userId);
    }

    @Put()
    @ApiOperation({ summary: 'Update notification preferences' })
    @ApiResponse({ status: 200, description: 'Preferences updated successfully' })
    async updatePreferences(
        @Request() req: any,
        @Body() dto: UpdatePreferencesDto
    ): Promise<NotificationPreference> {
        return this.notificationCenter.updatePreferences(req.user.userId, dto);
    }

    @Patch('channels')
    @ApiOperation({ summary: 'Toggle notification channels' })
    @ApiResponse({ status: 200, description: 'Channel settings updated' })
    async updateChannels(
        @Request() req: any,
        @Body() dto: Partial<Pick<UpdatePreferencesDto, 'inAppEnabled' | 'emailEnabled' | 'telegramEnabled' | 'pushEnabled'>>
    ): Promise<NotificationPreference> {
        return this.notificationCenter.updatePreferences(req.user.userId, dto);
    }

    @Patch('digest')
    @ApiOperation({ summary: 'Update digest settings' })
    @ApiResponse({ status: 200, description: 'Digest settings updated' })
    async updateDigest(
        @Request() req: any,
        @Body() dto: Pick<UpdatePreferencesDto, 'digestEnabled' | 'digestFrequency' | 'digestTime'>
    ): Promise<NotificationPreference> {
        return this.notificationCenter.updatePreferences(req.user.userId, dto);
    }

    @Patch('quiet-hours')
    @ApiOperation({ summary: 'Update quiet hours settings' })
    @ApiResponse({ status: 200, description: 'Quiet hours settings updated' })
    async updateQuietHours(
        @Request() req: any,
        @Body() dto: Pick<UpdatePreferencesDto, 'quietHoursEnabled' | 'quietHoursStart' | 'quietHoursEnd' | 'timezone'>
    ): Promise<NotificationPreference> {
        return this.notificationCenter.updatePreferences(req.user.userId, dto);
    }

    @Patch('type-settings')
    @ApiOperation({ summary: 'Update per-notification-type channel settings' })
    @ApiResponse({ status: 200, description: 'Type settings updated' })
    async updateTypeSettings(
        @Request() req: any,
        @Body() dto: UpdateTypePreferenceDto
    ): Promise<NotificationPreference> {
        const channelSettings: Record<string, boolean> = {};

        if (dto.channels.inApp !== undefined) channelSettings['in_app'] = dto.channels.inApp;
        if (dto.channels.email !== undefined) channelSettings['email'] = dto.channels.email;
        if (dto.channels.telegram !== undefined) channelSettings['telegram'] = dto.channels.telegram;
        if (dto.channels.push !== undefined) channelSettings['push'] = dto.channels.push;

        return this.notificationCenter.updateTypePreference(
            req.user.userId,
            dto.notificationType,
            channelSettings
        );
    }

    @Get('available-types')
    @ApiOperation({ summary: 'Get all available notification types' })
    @ApiResponse({ status: 200, description: 'Returns available notification types' })
    getAvailableTypes(): { types: NotificationType[]; descriptions: Record<NotificationType, string> } {
        return {
            types: Object.values(NotificationType),
            descriptions: {
                [NotificationType.TICKET_CREATED]: 'When a new ticket is created',
                [NotificationType.TICKET_ASSIGNED]: 'When a ticket is assigned to you',
                [NotificationType.TICKET_UPDATED]: 'When a ticket status or details change',
                [NotificationType.TICKET_RESOLVED]: 'When a ticket is resolved',
                [NotificationType.TICKET_CANCELLED]: 'When a ticket is cancelled',
                [NotificationType.TICKET_REPLY]: 'When someone replies to a ticket',
                [NotificationType.CHAT_MESSAGE_RECEIVED]: 'When someone sends a message in a ticket chat',
                [NotificationType.MENTION]: 'When you are mentioned in a ticket',
                [NotificationType.SLA_WARNING]: 'When a ticket is approaching SLA breach',
                [NotificationType.SLA_BREACHED]: 'When a ticket has breached SLA',
                [NotificationType.SYSTEM]: 'System announcements and updates',
                [NotificationType.RENEWAL_D60_WARNING]: 'Contract expiring in 60 days (2 months)',
                [NotificationType.RENEWAL_D30_WARNING]: 'Contract expiring in 30 days',
                [NotificationType.RENEWAL_D7_WARNING]: 'Contract expiring in 7 days',
                [NotificationType.RENEWAL_D1_WARNING]: 'Contract expiring tomorrow',
                [NotificationType.RENEWAL_EXPIRED]: 'Contract has expired',
                [NotificationType.HARDWARE_REQUEST_SUBMITTED]: 'Hardware request submitted',
                [NotificationType.HARDWARE_REQUEST_APPROVED]: 'Hardware request approved (management)',
                [NotificationType.HARDWARE_REQUEST_APPROVED_PROC]: 'Hardware request approved (procurement)',
                [NotificationType.HARDWARE_REQUEST_REJECTED]: 'Hardware request rejected',
                [NotificationType.HARDWARE_REQUEST_CANCELLED]: 'Hardware request cancelled',
                [NotificationType.HARDWARE_REQUEST_PROC_DONE]: 'Hardware procurement completed',
                [NotificationType.HARDWARE_REQUEST_PROC_DONE_TECH]: 'Hardware procurement completed (technician)',
                [NotificationType.HARDWARE_REQUEST_SCHEDULE_PROPOSED]: 'Installation schedule proposed',
                [NotificationType.HARDWARE_REQUEST_SCHEDULE_CONFIRMED]: 'Installation schedule confirmed',
                [NotificationType.HARDWARE_REQUEST_SCHEDULE_RESCHEDULED]: 'Installation schedule rescheduled',
                [NotificationType.HARDWARE_REQUEST_INSTALL_STARTED]: 'Hardware installation started',
                [NotificationType.HARDWARE_REQUEST_COMPLETED]: 'Hardware request completed',
                [NotificationType.HARDWARE_REQUEST_COMPLETED_LEAD]: 'Hardware request completed (lead)',
                [NotificationType.HARDWARE_REQUEST_COMMENTED]: 'New comment on hardware request',
                [NotificationType.ZOOM_BOOKING_CONFIRMED]: 'Zoom booking confirmed',
                [NotificationType.ZOOM_BOOKING_CANCELLED]: 'Zoom booking cancelled',
                [NotificationType.ZOOM_BOOKING_REMINDER]: 'Zoom meeting reminder',
                [NotificationType.VPN_EXPIRY_D60]: 'VPN access expiring in 60 days',
                [NotificationType.VPN_EXPIRY_D30]: 'VPN access expiring in 30 days',
                [NotificationType.VPN_EXPIRY_D7]: 'VPN access expiring in 7 days',
                [NotificationType.VPN_EXPIRY_D1]: 'VPN access expiring tomorrow',
                [NotificationType.EFORM_SUBMITTED]: 'E-Form request submitted',
                [NotificationType.EFORM_MANAGER1_APPROVED]: 'E-Form request approved by Manager 1',
                [NotificationType.EFORM_MANAGER2_APPROVED]: 'E-Form request approved by Manager 2',
                [NotificationType.EFORM_ICT_CONFIRMED]: 'E-Form request confirmed by ICT',
                [NotificationType.EFORM_REJECTED]: 'E-Form request rejected',
                [NotificationType.EFORM_CREDENTIALS_READY]: 'E-Form VPN credentials are ready',
            },
        };
    }
}
