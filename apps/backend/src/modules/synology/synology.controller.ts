import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Delete,
    Query,
    UseGuards,
    UseInterceptors,
    UploadedFile,
    ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiConsumes } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { SynologyService } from './synology.service';
import {
    CreateBackupConfigDto,
    UpdateBackupConfigDto,
    TestConnectionDto,
    ManualBackupDto,
    ListFoldersDto,
    RestoreFromHistoryDto,
    RestoreFromNasDto,
    RestoreUploadDto,
} from './dto';
import { JwtAuthGuard } from '../auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/core/guards/roles.guard';
import { Roles } from '../../shared/core/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';

@ApiTags('Synology Backup')
@ApiBearerAuth()
@Controller('backup')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN) // All backup operations require admin
export class SynologyController {
    constructor(private readonly synologyService: SynologyService) { }

    // ==========================================
    // Configuration
    // ==========================================

    @Get('configs')
    @ApiOperation({ summary: 'Get all backup configurations' })
    findAllConfigurations() {
        return this.synologyService.findAllConfigurations();
    }

    @Get('configs/:id')
    @ApiOperation({ summary: 'Get backup configuration by ID' })
    findConfiguration(@Param('id', ParseUUIDPipe) id: string) {
        return this.synologyService.findConfiguration(id);
    }

    @Post('configs')
    @ApiOperation({ summary: 'Create backup configuration' })
    createConfiguration(@Body() dto: CreateBackupConfigDto) {
        return this.synologyService.createConfiguration(dto);
    }

    @Patch('configs/:id')
    @ApiOperation({ summary: 'Update backup configuration' })
    updateConfiguration(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateBackupConfigDto,
    ) {
        return this.synologyService.updateConfiguration(id, dto);
    }

    @Delete('configs/:id')
    @ApiOperation({ summary: 'Delete backup configuration' })
    deleteConfiguration(@Param('id', ParseUUIDPipe) id: string) {
        return this.synologyService.deleteConfiguration(id);
    }

    // ==========================================
    // Connection Test
    // ==========================================

    @Post('test-connection')
    @ApiOperation({ summary: 'Test Synology NAS connection' })
    testConnection(@Body() dto: TestConnectionDto) {
        return this.synologyService.testConnection(dto);
    }

    @Post('list-folders')
    @ApiOperation({ summary: 'List folders on Synology NAS via FileStation' })
    listFolders(@Body() dto: ListFoldersDto) {
        return this.synologyService.listFolders(dto);
    }

    // ==========================================
    // Backup Execution
    // ==========================================

    @Post('execute/:configId')
    @ApiOperation({ summary: 'Execute backup manually' })
    executeBackup(
        @Param('configId', ParseUUIDPipe) configId: string,
        @Body() dto: ManualBackupDto,
    ) {
        return this.synologyService.executeBackup(configId, true);
    }

    @Post('sync-uploads')
    @ApiOperation({ summary: 'Sync all local uploads (attachments, telegram, avatars) to Synology NAS' })
    @ApiQuery({ name: 'configId', required: false })
    syncUploads(@Query('configId') configId?: string) {
        return this.synologyService.syncUploadsToSynology(configId);
    }

    // ==========================================
    // History & Status
    // ==========================================

    @Get('history')
    @ApiOperation({ summary: 'Get backup history' })
    @ApiQuery({ name: 'configId', required: false })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    getHistory(
        @Query('configId') configId?: string,
        @Query('limit') limit?: number,
    ) {
        return this.synologyService.getBackupHistory(configId, limit || 50);
    }

    @Get('status')
    @ApiOperation({ summary: 'Get last backup status for all configurations' })
    getStatus() {
        return this.synologyService.getLastBackupStatus();
    }

    // ==========================================
    // Restore Operations
    // ==========================================

    @Post('restore/history/:historyId')
    @ApiOperation({ summary: 'Restore database from a backup history entry' })
    restoreFromHistory(
        @Param('historyId', ParseUUIDPipe) historyId: string,
        @Body() dto: RestoreFromHistoryDto,
    ) {
        return this.synologyService.restoreFromHistory(historyId, dto.createSnapshot ?? true);
    }

    @Post('restore/nas')
    @ApiOperation({ summary: 'Restore database from Synology NAS file path' })
    restoreFromNas(@Body() dto: RestoreFromNasDto) {
        return this.synologyService.restoreFromNas(dto);
    }

    @Post('restore/upload')
    @ApiOperation({ summary: 'Restore database from uploaded .sql or .sql.gz file' })
    @ApiConsumes('multipart/form-data')
    @UseInterceptors(FileInterceptor('file'))
    restoreFromUpload(
        @UploadedFile() file: Express.Multer.File,
        @Body() dto: RestoreUploadDto,
    ) {
        return this.synologyService.restoreFromUploadedFile(file, dto.createSnapshot ?? true);
    }
}
