import {
    Controller,
    Post,
    UseInterceptors,
    UploadedFiles,
    BadRequestException,
    UseGuards,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/infrastructure/guards/jwt-auth.guard';
import { MULTER_OPTIONS, UPLOAD_RATE_LIMITS, FILE_SIZE_LIMITS } from '../../shared/core/config/upload.config';

@ApiTags('Uploads')
@ApiBearerAuth()
@Controller('uploads')
export class UploadsController {
    @Post()
    @UseGuards(JwtAuthGuard)
    @Throttle({ default: UPLOAD_RATE_LIMITS.attachment })
    @UseInterceptors(
        FilesInterceptor('files', 10, {
            ...MULTER_OPTIONS.image,
            limits: { fileSize: FILE_SIZE_LIMITS.IMAGE },
        }),
    )
    @ApiOperation({ summary: 'Upload multiple image files' })
    @ApiConsumes('multipart/form-data')
    @ApiResponse({ status: 201, description: 'Files uploaded successfully.' })
    @ApiResponse({ status: 400, description: 'Invalid file type or size.' })
    @ApiResponse({ status: 429, description: 'Too many upload requests.' })
    uploadFiles(@UploadedFiles() files: Array<Express.Multer.File>) {
        if (!files || files.length === 0) {
            throw new BadRequestException('No files uploaded');
        }
        
        const baseUrl = process.env.API_URL || 'http://localhost:5050';
        const urls = files.map((file) => `${baseUrl}/uploads/${file.filename}`);
        return { 
            success: true,
            urls,
            count: files.length,
        };
    }
}
