import {
    Controller, Get, Post, Body, Patch, Param, Query,
    UseGuards, Request, ParseUUIDPipe, UseInterceptors, UploadedFiles,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiConsumes } from '@nestjs/swagger';
import { LostItemService } from './lost-item.service';
import { CreateLostItemDto, UpdateLostItemStatusDto } from './dto';
import { JwtAuthGuard } from '../auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/core/guards/roles.guard';
import { Roles } from '../../shared/core/decorators/roles.decorator';
import { Public } from '../../shared/core/decorators/public.decorator';
import { UserRole } from '../users/enums/user-role.enum';
import { FILE_SIZE_LIMITS } from '../../shared/core/config/upload.config';
import { ConfigService } from '@nestjs/config';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { randomUUID } from 'crypto';

@ApiTags('Lost Item')
@ApiBearerAuth()
@Controller('lost-item')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LostItemController {
    constructor(
        private readonly lostItemService: LostItemService,
        private readonly configService: ConfigService,
    ) {}

    // NOTE: Static routes MUST come before /:id to avoid NestJS matching 'my' as a UUID param

    @Get('my')
    @ApiOperation({ summary: 'Get my lost item reports' })
    findMy(@Request() req: any) {
        return this.lostItemService.findMy(req.user.userId);
    }

    @Public()
    @Get('qr/:token')
    @ApiOperation({ summary: 'Resolve QR token to report info' })
    findByQrToken(@Param('token') token: string) {
        return this.lostItemService.findByQrToken(token);
    }

    @Post()
    @ApiOperation({ summary: 'Create Lost Item report with optional photos' })
    @ApiConsumes('multipart/form-data')
    @UseInterceptors(FilesInterceptor('photos', 5, {
        storage: diskStorage({
            destination: './uploads/lost-items',
            filename: (req, file, cb) => cb(null, `${randomUUID()}${extname(file.originalname)}`),
        }),
        limits: { fileSize: FILE_SIZE_LIMITS.IMAGE },
    }))
    async create(
        @Request() req: any,
        @Body() dto: CreateLostItemDto,
        @UploadedFiles() photos: Express.Multer.File[],
    ) {
        const baseUrl = this.configService.get<string>('API_URL', 'http://localhost:5050');
        const photoUrls = (photos || []).map(f => `${baseUrl}/uploads/lost-items/${f.filename}`);
        return this.lostItemService.create(req.user.userId, { ...dto, photoUrls });
    }

    @Get()
    @ApiOperation({ summary: 'Get all Lost Item reports (manager)' })
    @ApiQuery({ name: 'siteId', required: false })
    @ApiQuery({ name: 'status', required: false })
    @Roles(UserRole.ADMIN, UserRole.AGENT, UserRole.MANAGER)
    findAll(@Query('siteId') siteId?: string, @Query('status') status?: string) {
        return this.lostItemService.findAll({ siteId, status });
    }

    @Get('ticket/:ticketId')
    @ApiOperation({ summary: 'Get Lost Item report by ticket ID' })
    findByTicketId(@Param('ticketId', ParseUUIDPipe) ticketId: string) {
        return this.lostItemService.findByTicketId(ticketId);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get Lost Item report by ID' })
    findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.lostItemService.findOne(id);
    }

    @Patch(':id/status')
    @ApiOperation({ summary: 'Update Lost Item status' })
    @Roles(UserRole.ADMIN, UserRole.AGENT, UserRole.MANAGER)
    updateStatus(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateLostItemStatusDto,
        @Request() req: any,
    ) {
        return this.lostItemService.updateStatus(id, dto, req.user.userId);
    }

    @Post(':id/police-report')
    @ApiOperation({ summary: 'Upload police report' })
    @ApiConsumes('multipart/form-data')
    @UseInterceptors(FilesInterceptor('file', 1, {
        storage: diskStorage({
            destination: './uploads/police-reports',
            filename: (req, file, cb) => cb(null, `${randomUUID()}${extname(file.originalname)}`),
        }),
    }))
    uploadPoliceReport(
        @Param('id', ParseUUIDPipe) id: string,
        @UploadedFiles() files: Express.Multer.File[],
        @Body('reportNumber') reportNumber: string,
    ) {
        const file = files?.[0];
        if (!file) throw new Error('No file uploaded');
        return this.lostItemService.uploadPoliceReport(id, `/uploads/police-reports/${file.filename}`, reportNumber);
    }
}
