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
import { PageAccessGuard } from '../../shared/core/guards/page-access.guard';
import { PageAccess, SkipPageAccess } from '../../shared/core/decorators/page-access.decorator';
import { Roles } from '../../shared/core/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';
import { SettingsService } from './settings.service';
import { StorageCleanupService } from './storage-cleanup.service';
import {
    UpdateStorageSettingsDto,
    ManualCleanupDto,
    CleanupPreviewDto,
} from './dto/storage-settings.dto';
import {
    UpdateTimeSlotsDto,
    UpdateHardwareTypesDto,
} from './dto/scheduling-config.dto';

@Controller('settings')
@UseGuards(JwtAuthGuard, RolesGuard, PageAccessGuard)
@PageAccess('settings')
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
        @Request() req: any,
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
    async executeCleanup(@Body() dto: ManualCleanupDto, @Request() req: any) {
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

    // =====================
    // Scheduling Settings
    // =====================

    /**
     * Get scheduling configuration (time slots and hardware types)
     * @SkipPageAccess — available to ALL authenticated users so they can populate
     * hardware-installation and other ticket forms (USER role also needs this).
     */
    @Get('scheduling')
    @SkipPageAccess()
    async getSchedulingConfig() {
        const config = await this.settingsService.getSchedulingConfig();
        return config;
    }

    /**
     * Get only time slots
     */
    @Get('scheduling/time-slots')
    @SkipPageAccess()
    async getTimeSlots() {
        const timeSlots = await this.settingsService.getTimeSlots();
        return { timeSlots };
    }

    /**
     * Update time slots (Admin only)
     */
    @Patch('scheduling/time-slots')
    @Roles(UserRole.ADMIN)
    async updateTimeSlots(
        @Body() dto: UpdateTimeSlotsDto,
        @Request() req: any,
    ) {
        const config = await this.settingsService.updateTimeSlots(dto.timeSlots, req.user.userId);
        return { success: true, config };
    }

    /**
     * Get only hardware types
     */
    @Get('scheduling/hardware-types')
    @SkipPageAccess()
    async getHardwareTypes() {
        const hardwareTypes = await this.settingsService.getHardwareTypes();
        return { hardwareTypes };
    }

    /**
     * Update hardware types (Admin only)
     */
    @Patch('scheduling/hardware-types')
    @Roles(UserRole.ADMIN)
    async updateHardwareTypes(
        @Body() dto: UpdateHardwareTypesDto,
        @Request() req: any,
    ) {
        const config = await this.settingsService.updateHardwareTypes(dto.hardwareTypes, req.user.userId);
        return { success: true, config };
    }
}
