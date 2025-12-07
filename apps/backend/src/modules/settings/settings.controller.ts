import {
    Controller,
    Get,
    Patch,
    Post,
    Body,
    UseGuards,
    Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/core/guards/roles.guard';
import { Roles } from '../../shared/core/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';
import { SettingsService } from './settings.service';
import { StorageCleanupService } from './storage-cleanup.service';
import {
    UpdateStorageSettingsDto,
    ManualCleanupDto,
    CleanupPreviewDto,
} from './dto/storage-settings.dto';

@Controller('settings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SettingsController {
    constructor(
        private readonly settingsService: SettingsService,
        private readonly storageCleanupService: StorageCleanupService,
    ) { }

    // =====================
    // Storage Settings
    // =====================

    @Get('storage')
    @Roles(UserRole.ADMIN)
    async getStorageSettings() {
        const settings = await this.settingsService.getStorageSettings();
        const stats = await this.storageCleanupService.getStorageStats();
        return { settings, stats };
    }

    @Patch('storage')
    @Roles(UserRole.ADMIN)
    async updateStorageSettings(
        @Body() dto: UpdateStorageSettingsDto,
        @Request() req,
    ) {
        const settings = await this.settingsService.updateStorageSettings(dto, req.user.userId);
        return { success: true, settings };
    }

    @Post('storage/preview')
    @Roles(UserRole.ADMIN)
    async previewCleanup(@Body() dto: CleanupPreviewDto) {
        const preview = await this.storageCleanupService.previewCleanup({
            fromDate: new Date(dto.fromDate),
            toDate: new Date(dto.toDate),
            deleteAttachments: dto.deleteAttachments ?? true,
            deleteNotes: dto.deleteNotes ?? true,
            deleteDiscussions: dto.deleteDiscussions ?? true,
            onlyResolvedTickets: dto.onlyResolvedTickets ?? true,
        });
        return preview;
    }

    @Post('storage/cleanup')
    @Roles(UserRole.ADMIN)
    async executeCleanup(@Body() dto: ManualCleanupDto, @Request() req) {
        const result = await this.storageCleanupService.executeManualCleanup(
            {
                fromDate: new Date(dto.fromDate),
                toDate: new Date(dto.toDate),
                deleteAttachments: dto.deleteAttachments,
                deleteNotes: dto.deleteNotes,
                deleteDiscussions: dto.deleteDiscussions,
                onlyResolvedTickets: dto.onlyResolvedTickets ?? true,
            },
            req.user.userId,
        );
        return { success: true, result };
    }

    @Get('storage/stats')
    @Roles(UserRole.ADMIN)
    async getStorageStats() {
        return this.storageCleanupService.getStorageStats();
    }
}
