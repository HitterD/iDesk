import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Body,
    Param,
    Query,
    UseGuards,
    ParseUUIDPipe,
    Req,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/core/guards/roles.guard';
import { Roles } from '../../shared/core/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';
import { GoogleSyncService } from './google-sync.service';
import { SyncSchedulerService } from './services/sync-scheduler.service';
import { SyncEngineService } from './services/sync-engine.service';
import {
    CreateSpreadsheetConfigDto,
    UpdateSpreadsheetConfigDto,
    CreateSheetMappingDto,
    UpdateSheetMappingDto,
} from './dto';

@ApiTags('Google Sync')
@ApiBearerAuth()
@Controller('google-sync')
@UseGuards(JwtAuthGuard, RolesGuard)
export class GoogleSyncController {
    constructor(
        private readonly service: GoogleSyncService,
        private readonly scheduler: SyncSchedulerService,
        private readonly syncEngine: SyncEngineService,
    ) { }

    // === STATUS ===

    @Get('status')
    @ApiOperation({ summary: 'Get Google Sync integration status' })
    @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.AGENT)
    async getStatus() {
        return this.service.getStatus();
    }

    // === SPREADSHEET CONFIGS ===

    @Get('configs')
    @ApiOperation({ summary: 'Get all spreadsheet configurations' })
    @Roles(UserRole.ADMIN)
    async findAllConfigs() {
        return this.service.findAllConfigs();
    }

    @Get('configs/:id')
    @ApiOperation({ summary: 'Get spreadsheet config by ID' })
    @Roles(UserRole.ADMIN)
    async findConfigById(@Param('id', ParseUUIDPipe) id: string) {
        return this.service.findConfigById(id);
    }

    @Post('configs')
    @ApiOperation({ summary: 'Create a new spreadsheet configuration' })
    @Roles(UserRole.ADMIN)
    async createConfig(@Body() dto: CreateSpreadsheetConfigDto) {
        return this.service.createConfig(dto);
    }

    @Put('configs/:id')
    @ApiOperation({ summary: 'Update spreadsheet configuration' })
    @Roles(UserRole.ADMIN)
    async updateConfig(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateSpreadsheetConfigDto,
        @Req() req: any,
    ) {
        return this.service.updateConfig(id, dto, req.user?.id || req.user?.userId);
    }

    @Delete('configs/:id')
    @ApiOperation({ summary: 'Delete spreadsheet configuration' })
    @Roles(UserRole.ADMIN)
    async deleteConfig(@Param('id', ParseUUIDPipe) id: string) {
        await this.service.deleteConfig(id);
        return { success: true };
    }

    // === SHEET MAPPINGS ===

    @Get('sheets')
    @ApiOperation({ summary: 'Get all sheet mappings' })
    @ApiQuery({ name: 'configId', required: false })
    @Roles(UserRole.ADMIN, UserRole.MANAGER)
    async findAllSheets(@Query('configId') configId?: string) {
        return this.service.findAllSheets(configId);
    }

    @Get('sheets/:id')
    @ApiOperation({ summary: 'Get sheet mapping by ID' })
    @Roles(UserRole.ADMIN, UserRole.MANAGER)
    async findSheetById(@Param('id', ParseUUIDPipe) id: string) {
        return this.service.findSheetById(id);
    }

    @Post('sheets')
    @ApiOperation({ summary: 'Create a new sheet mapping' })
    @Roles(UserRole.ADMIN)
    async createSheetMapping(@Body() dto: CreateSheetMappingDto) {
        return this.service.createSheetMapping(dto);
    }

    @Put('sheets/:id')
    @ApiOperation({ summary: 'Update sheet mapping' })
    @Roles(UserRole.ADMIN)
    async updateSheetMapping(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateSheetMappingDto,
    ) {
        return this.service.updateSheetMapping(id, dto);
    }

    @Delete('sheets/:id')
    @ApiOperation({ summary: 'Delete sheet mapping' })
    @Roles(UserRole.ADMIN)
    async deleteSheetMapping(@Param('id', ParseUUIDPipe) id: string) {
        await this.service.deleteSheetMapping(id);
        return { success: true };
    }

    // === SYNC TRIGGERS ===

    @Post('sheets/:id/sync')
    @ApiOperation({ summary: 'Trigger manual sync for a specific sheet' })
    @Roles(UserRole.ADMIN, UserRole.MANAGER)
    async triggerSync(
        @Param('id', ParseUUIDPipe) id: string,
        @Req() req: any,
    ) {
        await this.scheduler.triggerSync(id, req.user?.userId || req.user?.id);
        return { success: true, message: 'Sync job queued' };
    }

    @Post('sync-all')
    @ApiOperation({ summary: 'Trigger sync for all enabled sheets' })
    @Roles(UserRole.ADMIN)
    async syncAll(@Req() req: any) {
        const count = await this.scheduler.syncAll(req.user?.userId || req.user?.id);
        return { success: true, message: `${count} sync jobs queued` };
    }

    @Post('sheets/:id/sync-now')
    @ApiOperation({ summary: 'Execute immediate sync (blocking)' })
    @Roles(UserRole.ADMIN)
    async syncNow(
        @Param('id', ParseUUIDPipe) id: string,
        @Req() req: any,
    ) {
        const result = await this.syncEngine.syncSheet(id, req.user?.userId || req.user?.id);
        if (req.user?.userId || req.user?.id) {
            await this.service.logSyncTrigger(id, req.user?.userId || req.user?.id);
        }
        return result;
    }

    @Post('sheets/:id/reset-errors')
    @ApiOperation({ summary: 'Reset error count to re-enable syncing' })
    @Roles(UserRole.ADMIN)
    async resetErrors(@Param('id', ParseUUIDPipe) id: string) {
        await this.scheduler.resetErrorCount(id);
        return { success: true };
    }

    // === SYNC LOGS ===

    @Get('logs')
    @ApiOperation({ summary: 'Get sync logs' })
    @ApiQuery({ name: 'sheetId', required: false })
    @ApiQuery({ name: 'limit', required: false })
    @Roles(UserRole.ADMIN, UserRole.MANAGER)
    async getSyncLogs(
        @Query('sheetId') sheetId?: string,
        @Query('limit') limit?: number,
    ) {
        return this.service.getSyncLogs(sheetId, limit || 50);
    }

    // === SPREADSHEET DISCOVERY ===

    @Get('discover/:spreadsheetId')
    @ApiOperation({ summary: 'Get available sheets from a spreadsheet' })
    @Roles(UserRole.ADMIN)
    async discoverSheets(@Param('spreadsheetId') spreadsheetId: string) {
        return this.service.getAvailableSheets(spreadsheetId);
    }

    @Get('headers/:spreadsheetId/:sheetName')
    @ApiOperation({ summary: 'Get column headers from a sheet' })
    @ApiQuery({ name: 'headerRow', required: false })
    @Roles(UserRole.ADMIN)
    async getSheetHeaders(
        @Param('spreadsheetId') spreadsheetId: string,
        @Param('sheetName') sheetName: string,
        @Query('headerRow') headerRow?: number,
    ) {
        const headers = await this.service.getSheetHeaders(
            spreadsheetId,
            sheetName,
            headerRow || 1,
        );
        return { headers };
    }
}
