import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Param,
    Body,
    Query,
    UploadedFile,
    UseInterceptors,
    UseGuards,
    Req,
    ParseUUIDPipe,
    BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiBearerAuth, ApiConsumes, ApiBody, ApiQuery, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/infrastructure/guards/jwt-auth.guard';
import { PageAccessGuard } from '../../shared/core/guards/page-access.guard';
import { PageAccess } from '../../shared/core/decorators/page-access.decorator';
import { RenewalService } from './renewal.service';
import { PdfValidationService } from './services/pdf-validation.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';
import { ContractStatus, ContractCategory } from './entities/renewal-contract.entity';
import { MULTER_OPTIONS, UPLOAD_RATE_LIMITS } from '../../shared/core/config/upload.config';
import { ContractAuditService } from './services/contract-audit.service';

@ApiTags('Renewal Contracts')
@ApiBearerAuth()
@Controller('renewal')
@UseGuards(JwtAuthGuard, PageAccessGuard) // V9: Use PageAccessGuard instead of RolesGuard
@PageAccess('renewal') // V9: Requires 'renewal' page access from user's preset
export class RenewalController {
    constructor(
        private readonly renewalService: RenewalService,
        private readonly pdfValidationService: PdfValidationService,
        private readonly auditService: ContractAuditService,
    ) { }

    // === DASHBOARD STATS ===
    @Get('stats')
    async getStats() {
        return this.renewalService.getDashboardStats();
    }

    // === CONTRACT HISTORY ===
    @Get(':id/history')
    @ApiOperation({ summary: 'Get contract change history' })
    async getContractHistory(@Param('id', ParseUUIDPipe) id: string) {
        return this.auditService.getContractHistory(id);
    }

    // === RECENT ACTIVITY ===
    @Get('activity/recent')
    @ApiOperation({ summary: 'Get recent contract activity' })
    async getRecentActivity() {
        return this.auditService.getRecentActivity();
    }

    // === DUPLICATE CHECK ===
    @Get('check-duplicate')
    @ApiOperation({ summary: 'Check if a PO number already exists' })
    @ApiQuery({ name: 'poNumber', required: true, type: String })
    async checkDuplicate(@Query('poNumber') poNumber: string) {
        return this.renewalService.checkDuplicate(poNumber);
    }

    // === LIST ALL (Paginated) ===
    @Get()
    @ApiQuery({ name: 'status', required: false, enum: ContractStatus })
    @ApiQuery({ name: 'category', required: false, enum: ContractCategory })
    @ApiQuery({ name: 'search', required: false, type: String })
    @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
    @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 25, max: 100)' })
    @ApiQuery({ name: 'fromDate', required: false, type: String, description: 'Filter contracts with endDate >= fromDate (ISO format)' })
    @ApiQuery({ name: 'toDate', required: false, type: String, description: 'Filter contracts with endDate <= toDate (ISO format)' })
    async findAll(
        @Query('status') status?: ContractStatus,
        @Query('category') category?: ContractCategory,
        @Query('search') search?: string,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
        @Query('fromDate') fromDate?: string,
        @Query('toDate') toDate?: string,
    ) {
        return this.renewalService.findAll({
            status,
            category,
            search,
            page: page ? parseInt(page, 10) : undefined,
            limit: limit ? parseInt(limit, 10) : undefined,
            fromDate,
            toDate,
        });
    }

    // === GET ONE ===
    @Get(':id')
    async findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.renewalService.findOne(id);
    }

    // === CREATE MANUAL (No PDF) ===
    @Post('manual')
    async createManual(
        @Body() dto: CreateContractDto,
        @Req() req: any,
    ) {
        return this.renewalService.createManual(dto, req.user.userId);
    }

    // === UPLOAD & EXTRACT ===
    @Post('upload')
    @Throttle({ default: UPLOAD_RATE_LIMITS.contract })
    @ApiOperation({ summary: 'Upload and extract contract PDF' })
    @ApiConsumes('multipart/form-data')
    @ApiQuery({ name: 'forceUpload', required: false, type: Boolean, description: 'Override scanned image warning' })
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                file: {
                    type: 'string',
                    format: 'binary',
                },
            },
        },
    })
    @ApiResponse({ status: 201, description: 'Contract uploaded and extracted successfully.' })
    @ApiResponse({ status: 400, description: 'Invalid file type or scanned image detected.' })
    @ApiResponse({ status: 429, description: 'Too many upload requests.' })
    @UseInterceptors(FileInterceptor('file', MULTER_OPTIONS.contract))
    async upload(
        @UploadedFile() file: Express.Multer.File,
        @Req() req: any,
        @Query('forceUpload') forceUpload?: string,
    ) {
        if (!file) {
            throw new BadRequestException('No file uploaded');
        }

        const isForceUpload = forceUpload === 'true';

        // Step 1: Validate PDF for scanned images
        const validation = await this.pdfValidationService.validatePdf(file.path);

        if (!validation.isValid && !isForceUpload) {
            // Return warning but don't reject - let user decide
            return {
                success: false,
                warning: validation.warningMessage,
                validation: {
                    characterCount: validation.characterCount,
                    isScannedImage: validation.isScannedImage,
                    rawTextPreview: validation.rawTextPreview,
                },
                message: 'Add ?forceUpload=true to proceed with manual entry',
            };
        }

        // Step 2: Continue with normal extraction
        const result = await this.renewalService.uploadAndExtract(file, req.user.userId);

        // Include validation info in response
        return {
            ...result,
            validation: {
                characterCount: validation.characterCount,
                isScannedImage: validation.isScannedImage,
                wasForced: isForceUpload && !validation.isValid,
            },
        };
    }

    // === UPDATE (Manual Override) ===
    @Patch(':id')
    async update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateContractDto,
        @Req() req: any,
    ) {
        return this.renewalService.update(id, dto, req.user.userId);
    }

    // === ACKNOWLEDGE ===
    @Post(':id/acknowledge')
    async acknowledge(
        @Param('id', ParseUUIDPipe) id: string,
        @Req() req: any,
    ) {
        return this.renewalService.acknowledgeContract(id, req.user.userId);
    }

    @Post(':id/unacknowledge')
    async unacknowledge(@Param('id', ParseUUIDPipe) id: string) {
        return this.renewalService.unacknowledgeContract(id);
    }

    // === BULK OPERATIONS ===
    @Post('bulk/acknowledge')
    @ApiOperation({ summary: 'Bulk acknowledge multiple contracts' })
    @ApiBody({ schema: { type: 'object', properties: { ids: { type: 'array', items: { type: 'string' } } } } })
    async bulkAcknowledge(
        @Body() body: { ids: string[] },
        @Req() req: any,
    ) {
        return this.renewalService.bulkAcknowledge(body.ids, req.user.userId);
    }

    @Post('bulk/delete')
    @ApiOperation({ summary: 'Bulk delete multiple contracts with file cleanup' })
    @ApiBody({ schema: { type: 'object', properties: { ids: { type: 'array', items: { type: 'string' } } } } })
    async bulkDelete(@Body() body: { ids: string[] }, @Req() req: any) {
        return this.renewalService.bulkDelete(body.ids, req.user.userId);
    }

    // === DELETE ===
    @Delete(':id')
    async delete(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
        await this.renewalService.delete(id, req.user.userId);
        return { message: 'Contract deleted successfully' };
    }

    // === RENEWAL WORKFLOW ===
    @Post(':id/renew')
    @ApiOperation({ summary: 'Create a renewal of an existing contract' })
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                newEndDate: { type: 'string', format: 'date', description: 'New contract end date' },
                newStartDate: { type: 'string', format: 'date', description: 'New contract start date (optional)' },
                newContractValue: { type: 'number', description: 'New contract value (optional)' },
                notes: { type: 'string', description: 'Notes for the renewal (optional)' },
            },
            required: ['newEndDate'],
        },
    })
    async renewContract(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() body: { newEndDate: string; newStartDate?: string; newContractValue?: number; notes?: string },
        @Req() req: any,
    ) {
        return this.renewalService.renewContract(
            id,
            {
                newEndDate: new Date(body.newEndDate),
                newStartDate: body.newStartDate ? new Date(body.newStartDate) : undefined,
                newContractValue: body.newContractValue,
                notes: body.notes,
            },
            req.user.userId,
        );
    }

    // === EXPORT AUDIT LOGS ===
    @Get('audit/export')
    @ApiOperation({ summary: 'Export audit logs as CSV' })
    @ApiQuery({ name: 'fromDate', required: false, type: String })
    @ApiQuery({ name: 'toDate', required: false, type: String })
    @ApiQuery({ name: 'contractId', required: false, type: String })
    async exportAuditLogs(
        @Query('fromDate') fromDate?: string,
        @Query('toDate') toDate?: string,
        @Query('contractId') contractId?: string,
    ) {
        return this.auditService.exportAuditLogs({ fromDate, toDate, contractId });
    }
}
