import {
    Controller,
    Get,
    Put,
    Post,
    Delete,
    Param,
    Body,
    UseGuards,
    Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/core/guards/roles.guard';
import { Roles } from '../../shared/core/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';
import { PermissionsService } from './permissions.service';
import { UpdateUserPermissionsDto, BulkUpdatePermissionsDto } from './dto/update-permissions.dto';
import { CreatePresetDto, UpdatePresetDto } from './dto/create-preset.dto';

@Controller('permissions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PermissionsController {
    constructor(private readonly permissionsService: PermissionsService) { }

    // Get all feature definitions
    @Get('features')
    async getFeatures() {
        return this.permissionsService.getFeatureDefinitions();
    }

    // Get all permission presets
    @Get('presets')
    async getPresets() {
        return this.permissionsService.getPresets();
    }

    // Get CURRENT user's own permissions (no role restriction - any authenticated user)
    @Get('me')
    async getMyPermissions(@Req() req: any) {
        const userId = req.user?.userId || req.user?.id;
        if (!userId) {
            return { userId: null, permissions: {}, pageAccess: {}, appliedPreset: null };
        }

        // OLD: Complex permissions (for backward compatibility)
        const permissions = await this.permissionsService.getUserPermissions(userId);
        const appliedPreset = await this.permissionsService.getUserAppliedPreset(userId);

        // NEW: Simple page access
        const pageAccess = await this.permissionsService.getUserPageAccess(userId);

        return {
            userId,
            permissions,
            pageAccess,  // NEW: Simple page access map
            appliedPreset,
        };
    }

    // Get any user's permissions (ADMIN/MANAGER only)
    @Get('users/:userId')
    @Roles(UserRole.ADMIN, UserRole.MANAGER)
    async getUserPermissions(@Param('userId') userId: string) {
        const permissions = await this.permissionsService.getUserPermissions(userId);
        const features = await this.permissionsService.getFeatureDefinitions();
        const appliedPreset = await this.permissionsService.getUserAppliedPreset(userId);

        // Return merged view: all features with user's current permissions + applied preset
        return {
            userId,
            permissions,
            features,
            appliedPreset,
        };
    }

    // Update user's permissions
    @Put('users/:userId')
    @Roles(UserRole.ADMIN)
    async updateUserPermissions(
        @Param('userId') userId: string,
        @Body() dto: UpdateUserPermissionsDto,
        @Req() req: any,
    ) {
        return this.permissionsService.updateUserPermissions(userId, dto.permissions, req.user?.id || req.user?.userId);
    }

    // Apply preset to user
    @Post('users/:userId/preset/:presetId')
    @Roles(UserRole.ADMIN)
    async applyPreset(
        @Param('userId') userId: string,
        @Param('presetId') presetId: string,
    ) {
        return this.permissionsService.applyPresetToUser(userId, presetId);
    }

    // Bulk apply preset to multiple users
    @Post('bulk-apply')
    @Roles(UserRole.ADMIN)
    async bulkApplyPreset(@Body() dto: BulkUpdatePermissionsDto) {
        return this.permissionsService.bulkApplyPreset(dto.userIds, dto.presetId);
    }

    // Check permission (for testing/debugging)
    @Get('check/:userId/:featureKey')
    @Roles(UserRole.ADMIN, UserRole.MANAGER)
    async checkPermission(
        @Param('userId') userId: string,
        @Param('featureKey') featureKey: string,
    ) {
        const hasView = await this.permissionsService.hasPermission(userId, featureKey, 'view');
        const hasCreate = await this.permissionsService.hasPermission(userId, featureKey, 'create');
        const hasEdit = await this.permissionsService.hasPermission(userId, featureKey, 'edit');
        const hasDelete = await this.permissionsService.hasPermission(userId, featureKey, 'delete');

        return {
            userId,
            featureKey,
            permissions: { view: hasView, create: hasCreate, edit: hasEdit, delete: hasDelete },
        };
    }

    // === PRESET CRUD ENDPOINTS ===

    // Get single preset
    @Get('presets/:id')
    async getPresetById(@Param('id') id: string) {
        return this.permissionsService.getPresetById(id);
    }

    // Create new preset
    @Post('presets')
    @Roles(UserRole.ADMIN)
    async createPreset(@Body() dto: CreatePresetDto, @Req() req: any) {
        return this.permissionsService.createPreset(dto, req.user?.id || req.user?.userId);
    }

    // Update preset
    @Put('presets/:id')
    @Roles(UserRole.ADMIN)
    async updatePreset(@Param('id') id: string, @Body() dto: UpdatePresetDto, @Req() req: any) {
        return this.permissionsService.updatePreset(id, dto, req.user?.id || req.user?.userId);
    }

    // Delete preset
    @Delete('presets/:id')
    @Roles(UserRole.ADMIN)
    async deletePreset(@Param('id') id: string, @Req() req: any) {
        return this.permissionsService.deletePreset(id, req.user?.id || req.user?.userId);
    }

    // Clone preset
    @Post('presets/:id/clone')
    @Roles(UserRole.ADMIN)
    async clonePreset(@Param('id') id: string, @Body() dto: { name: string }) {
        return this.permissionsService.clonePreset(id, dto.name);
    }
}
