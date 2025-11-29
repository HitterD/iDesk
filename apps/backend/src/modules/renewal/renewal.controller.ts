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
import { RolesGuard } from '../../shared/core/guards/roles.guard';
import { Roles } from '../../shared/core/decorators/roles.decorator';
import { RenewalService } from './renewal.service';
import { PdfValidationService } from './services/pdf-validation.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';
import { ContractStatus } from './entities/renewal-contract.entity';
import { UserRole } from '../users/enums/user-role.enum';
import { MULTER_OPTIONS, UPLOAD_RATE_LIMITS } from '../../shared/core/config/upload.config';

@ApiTags('Renewal Contracts')
@ApiBearerAuth()
@Controller('renewal')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class RenewalController {
    constructor(
        private readonly renewalService: RenewalService,
        private readonly pdfValidationService: PdfValidationService,
    ) { }

    // === DASHBOARD STATS ===
    @Get('stats')
    async getStats() {
        return this.renewalService.getDashboardStats();
    }

    // === LIST ALL ===
    @Get()
    async findAll(
        @Query('status') status?: ContractStatus,
        @Query('search') search?: string,
    ) {
        return this.renewalService.findAll({ status, search });
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
    ) {
        return this.renewalService.update(id, dto);
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

    // === DELETE ===
    @Delete(':id')
    async delete(@Param('id', ParseUUIDPipe) id: string) {
        await this.renewalService.delete(id);
        return { message: 'Contract deleted successfully' };
    }
}
