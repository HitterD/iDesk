import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Query,
    UseGuards,
    Request,
    ParseUUIDPipe,
    UseInterceptors,
    UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiConsumes } from '@nestjs/swagger';
import { AccessRequestService } from './access-request.service';
import { CreateAccessRequestDto, VerifyAccessRequestDto, CreateAccessCredentialsDto, RejectAccessRequestDto } from './dto';
import { JwtAuthGuard } from '../auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/core/guards/roles.guard';
import { Roles } from '../../shared/core/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';
import { SiteActor } from '../../shared/core/utils/site-scope.util';

@ApiTags('Access Request')
@ApiBearerAuth()
@Controller('access-request')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AccessRequestController {
    constructor(private readonly accessRequestService: AccessRequestService) { }

    @Post()
    @ApiOperation({ summary: 'Create Access Request' })
    create(@Request() req: any, @Body() dto: CreateAccessRequestDto) {
        return this.accessRequestService.create(req.user.userId, dto);
    }

    @Get()
    @ApiOperation({ summary: 'Get all Access Requests' })
    @ApiQuery({ name: 'siteId', required: false })
    @ApiQuery({ name: 'status', required: false })
    @Roles(UserRole.ADMIN, UserRole.AGENT, UserRole.MANAGER)
    findAll(
        @Query('siteId') siteId?: string,
        @Query('status') status?: string,
        @Request() req?: any,
    ) {
        const actor: SiteActor = { role: req?.user?.role, siteId: req?.user?.siteId ?? null };
        return this.accessRequestService.findAll(actor, { siteId, status });
    }

    @Get('types')
    @ApiOperation({ summary: 'Get all Access Types (WiFi, VPN, Website)' })
    findAccessTypes() {
        return this.accessRequestService.findAccessTypes();
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get Access Request by ID' })
    @Roles(UserRole.ADMIN, UserRole.AGENT, UserRole.MANAGER)
    findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
        const actor: SiteActor = { role: req.user.role, siteId: req.user.siteId ?? null };
        return this.accessRequestService.findOne(id, actor);
    }

    @Get('ticket/:ticketId')
    @ApiOperation({ summary: 'Get Access Request by ticket ID' })
    @Roles(UserRole.ADMIN, UserRole.AGENT, UserRole.MANAGER)
    findByTicketId(@Param('ticketId', ParseUUIDPipe) ticketId: string, @Request() req: any) {
        const actor: SiteActor = { role: req.user.role, siteId: req.user.siteId ?? null };
        return this.accessRequestService.findByTicketId(ticketId, actor);
    }

    @Patch(':id/download-form')
    @ApiOperation({ summary: 'Mark form as downloaded' })
    @Roles(UserRole.ADMIN, UserRole.AGENT)
    markFormDownloaded(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
        const actor: SiteActor = { role: req.user.role, siteId: req.user.siteId ?? null };
        return this.accessRequestService.markFormDownloaded(id, actor);
    }

    @Post(':id/upload-signed-form')
    @ApiOperation({ summary: 'Upload signed form' })
    @ApiConsumes('multipart/form-data')
    @UseInterceptors(FileInterceptor('file', {
        storage: diskStorage({
            destination: './uploads/access-forms',
            filename: (req, file, cb) => {
                const randomName = Array(32).fill(null).map(() => (Math.round(Math.random() * 16)).toString(16)).join('');
                cb(null, `${randomName}${extname(file.originalname)}`);
            },
        }),
    }))
    uploadSignedForm(
        @Param('id', ParseUUIDPipe) id: string,
        @UploadedFile() file: Express.Multer.File,
        @Request() req: any,
    ) {
        const actor: SiteActor = { role: req.user.role, siteId: req.user.siteId ?? null };
        const filePath = `/uploads/access-forms/${file.filename}`;
        return this.accessRequestService.uploadSignedForm(id, filePath, actor);
    }

    @Patch(':id/verify')
    @ApiOperation({ summary: 'Verify Access Request (Agent)' })
    @Roles(UserRole.ADMIN, UserRole.AGENT)
    verify(
        @Param('id', ParseUUIDPipe) id: string,
        @Request() req: any,
        @Body() dto: VerifyAccessRequestDto,
    ) {
        const actor: SiteActor = { role: req.user.role, siteId: req.user.siteId ?? null };
        return this.accessRequestService.verify(id, req.user.userId, dto, actor);
    }

    @Patch(':id/create-access')
    @ApiOperation({ summary: 'Create access credentials (Agent)' })
    @Roles(UserRole.ADMIN, UserRole.AGENT)
    createAccess(
        @Param('id', ParseUUIDPipe) id: string,
        @Request() req: any,
        @Body() dto: CreateAccessCredentialsDto,
    ) {
        const actor: SiteActor = { role: req.user.role, siteId: req.user.siteId ?? null };
        return this.accessRequestService.createAccess(id, req.user.userId, dto, actor);
    }

    @Patch(':id/reject')
    @ApiOperation({ summary: 'Reject Access Request' })
    @Roles(UserRole.ADMIN, UserRole.AGENT)
    reject(
        @Param('id', ParseUUIDPipe) id: string,
        @Request() req: any,
        @Body() dto: RejectAccessRequestDto,
    ) {
        const actor: SiteActor = { role: req.user.role, siteId: req.user.siteId ?? null };
        return this.accessRequestService.reject(id, req.user.userId, dto, actor);
    }

    // ==========================================
    // Access Type Form Template Management
    // ==========================================

    @Post('types/:typeId/upload-template')
    @ApiOperation({ summary: 'Upload form template for Access Type (Admin only)' })
    @ApiConsumes('multipart/form-data')
    @Roles(UserRole.ADMIN)
    @UseInterceptors(FileInterceptor('template', {
        storage: diskStorage({
            destination: './uploads/templates',
            filename: (req, file, cb) => {
                const typeId = req.params.typeId;
                const ext = extname(file.originalname);
                cb(null, `access-form-${typeId}${ext}`);
            },
        }),
        fileFilter: (req, file, cb) => {
            // Only allow PDF files
            if (file.mimetype === 'application/pdf') {
                cb(null, true);
            } else {
                cb(new Error('Only PDF files are allowed'), false);
            }
        },
    }))
    uploadTemplate(
        @Param('typeId', ParseUUIDPipe) typeId: string,
        @UploadedFile() file: Express.Multer.File,
    ) {
        const filePath = `/uploads/templates/${file.filename}`;
        return this.accessRequestService.updateAccessTypeFormTemplate(typeId, filePath);
    }

    @Get('types/:typeId/download-template')
    @ApiOperation({ summary: 'Download form template for Access Type' })
    async downloadTemplate(
        @Param('typeId', ParseUUIDPipe) typeId: string,
        @Request() req: any,
        @Query('inline') inline?: string,
    ) {
        return this.accessRequestService.getAccessTypeFormTemplate(typeId);
    }

    @Patch('types/:typeId')
    @ApiOperation({ summary: 'Update Access Type (Admin only)' })
    @Roles(UserRole.ADMIN)
    updateAccessType(
        @Param('typeId', ParseUUIDPipe) typeId: string,
        @Request() req: any,
        @Body() dto: { validityDays?: number; requiresSuperiorSignature?: boolean; requiresUserSignature?: boolean; description?: string },
    ) {
        return this.accessRequestService.updateAccessType(typeId, req.user.userId, dto);
    }
}
