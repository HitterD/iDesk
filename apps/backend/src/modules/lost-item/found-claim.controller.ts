import {
    Controller, Get, Post, Body, Patch, Param, Query,
    UseGuards, Request, ParseUUIDPipe, UseInterceptors, UploadedFiles,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { FoundClaimService } from './found-claim.service';
import { CreateFoundClaimDto, MatchFoundClaimDto, RejectFoundClaimDto } from './dto';
import { JwtAuthGuard } from '../auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/core/guards/roles.guard';
import { Roles } from '../../shared/core/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';
import { FILE_SIZE_LIMITS } from '../../shared/core/config/upload.config';
import { ConfigService } from '@nestjs/config';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { randomUUID } from 'crypto';
import { SiteActor } from '../../shared/core/utils/site-scope.util';

@ApiTags('Found Claims')
@ApiBearerAuth()
@Controller('found-claim')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FoundClaimController {
    constructor(
        private readonly foundClaimService: FoundClaimService,
        private readonly configService: ConfigService,
    ) {}

    @Get('my')
    @ApiOperation({ summary: 'Get my found claims' })
    findMy(@Request() req: any) {
        return this.foundClaimService.findMy(req.user.userId);
    }

    @Post()
    @ApiOperation({ summary: 'Submit a found item claim' })
    @UseInterceptors(FilesInterceptor('photos', 5, {
        storage: diskStorage({
            destination: './uploads/found-items',
            filename: (req, file, cb) => cb(null, `${randomUUID()}${extname(file.originalname)}`),
        }),
        limits: { fileSize: FILE_SIZE_LIMITS.IMAGE },
    }))
    async create(
        @Request() req: any,
        @Body() dto: CreateFoundClaimDto,
        @UploadedFiles() photos: Express.Multer.File[],
    ) {
        const photoUrls = (photos || []).map(f => `/uploads/found-items/${f.filename}`);
        const actor: SiteActor = { role: req.user.role, siteId: req.user.siteId ?? null };
        return this.foundClaimService.create(req.user.userId, { ...dto, photoUrls }, actor);
    }

    @Get()
    @ApiOperation({ summary: 'List all found claims (manager)' })
    @ApiQuery({ name: 'status', required: false })
    @Roles(UserRole.ADMIN, UserRole.AGENT, UserRole.MANAGER)
    findAll(@Query('status') status?: string, @Request() req?: any) {
        const actor: SiteActor = { role: req?.user?.role, siteId: req?.user?.siteId ?? null };
        return this.foundClaimService.findAll(actor, { status });
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get found claim by ID' })
    findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
        const actor: SiteActor = { role: req.user.role, siteId: req.user.siteId ?? null };
        return this.foundClaimService.findOne(id, actor);
    }

    @Patch(':id/match')
    @ApiOperation({ summary: 'Match found claim to lost report' })
    @Roles(UserRole.ADMIN, UserRole.AGENT, UserRole.MANAGER)
    match(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: MatchFoundClaimDto,
        @Request() req: any,
    ) {
        const actor: SiteActor = { role: req.user.role, siteId: req.user.siteId ?? null };
        return this.foundClaimService.match(id, dto, req.user.userId, actor);
    }

    @Patch(':id/reject')
    @ApiOperation({ summary: 'Reject found claim' })
    @Roles(UserRole.ADMIN, UserRole.AGENT, UserRole.MANAGER)
    reject(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: RejectFoundClaimDto,
        @Request() req: any,
    ) {
        const actor: SiteActor = { role: req.user.role, siteId: req.user.siteId ?? null };
        return this.foundClaimService.reject(id, dto, req.user.userId, actor);
    }

    @Patch(':id/returned')
    @ApiOperation({ summary: 'Confirm physical handover' })
    @Roles(UserRole.ADMIN, UserRole.AGENT, UserRole.MANAGER)
    confirmReturn(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
        const actor: SiteActor = { role: req.user.role, siteId: req.user.siteId ?? null };
        return this.foundClaimService.confirmReturn(id, req.user.userId, actor);
    }
}
