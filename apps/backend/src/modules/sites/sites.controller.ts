import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Delete,
    UseGuards,
    UseInterceptors,
    UploadedFile,
    ParseUUIDPipe,
    BadRequestException,
    Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { SitesService } from './sites.service';
import { CreateSiteDto, UpdateSiteDto } from './dto';
import { JwtAuthGuard } from '../auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/core/guards/roles.guard';
import { Roles } from '../../shared/core/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';

@ApiTags('Sites')
@ApiBearerAuth()
@Controller('sites')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SitesController {
    constructor(private readonly sitesService: SitesService) { }

    @Get()
    @ApiOperation({ summary: 'Get all sites' })
    @Roles(
        UserRole.ADMIN,
        UserRole.MANAGER,
        UserRole.AGENT_ORACLE,
        UserRole.AGENT_OPERATIONAL_SUPPORT,
        UserRole.AGENT_ADMIN,
        UserRole.AGENT,
    )
    findAll() {
        return this.sitesService.findAll();
    }

    @Get('active')
    @ApiOperation({ summary: 'Get all active sites' })
    @Roles(
        UserRole.ADMIN,
        UserRole.MANAGER,
        UserRole.AGENT,
        UserRole.AGENT_OPERATIONAL_SUPPORT,
        UserRole.AGENT_ORACLE,
        UserRole.AGENT_ADMIN,
        UserRole.USER,
    )
    findActive() {
        return this.sitesService.findActive();
    }

    @Get('stats')
    @ApiOperation({ summary: 'Get site statistics' })
    @Roles(
        UserRole.ADMIN,
        UserRole.MANAGER,
        UserRole.AGENT_ORACLE,
        UserRole.AGENT_OPERATIONAL_SUPPORT,
        UserRole.AGENT_ADMIN,
        UserRole.AGENT,
    )
    getSiteStats() {
        return this.sitesService.getSiteStats();
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get site by ID' })
    @Roles(
        UserRole.ADMIN,
        UserRole.MANAGER,
        UserRole.AGENT_ORACLE,
        UserRole.AGENT_OPERATIONAL_SUPPORT,
        UserRole.AGENT_ADMIN,
        UserRole.AGENT,
    )
    findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.sitesService.findOne(id);
    }

    @Get('code/:code')
    @ApiOperation({ summary: 'Get site by code' })
    findByCode(@Param('code') code: string) {
        return this.sitesService.findByCode(code);
    }

    @Post()
    @ApiOperation({ summary: 'Create a new site' })
    @Roles(UserRole.ADMIN)
    create(@Body() createSiteDto: CreateSiteDto, @Req() req: any) {
        return this.sitesService.create(createSiteDto, req.user?.id || req.user?.userId);
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Update a site' })
    @Roles(UserRole.ADMIN)
    update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() updateSiteDto: UpdateSiteDto,
        @Req() req: any,
    ) {
        return this.sitesService.update(id, updateSiteDto, req.user?.id || req.user?.userId);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Delete a site' })
    @Roles(UserRole.ADMIN)
    remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
        return this.sitesService.remove(id, req.user?.id || req.user?.userId);
    }

    @Post(':id/tv-token')
    @ApiOperation({ summary: 'Generate/regenerate TV board token for a site (invalidates old token)' })
    @Roles(UserRole.ADMIN)
    generateTvToken(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
        return this.sitesService.generateTvToken(id, req.user?.id || req.user?.userId);
    }

    @Delete(':id/tv-token')
    @ApiOperation({ summary: 'Revoke TV board token for a site' })
    @Roles(UserRole.ADMIN)
    revokeTvToken(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
        return this.sitesService.revokeTvToken(id, req.user?.id || req.user?.userId);
    }

    @Post(':id/tv-ringtone')
    @ApiOperation({ summary: 'Upload a TV board ringtone for one slot (newTicket | inProgress | closing)' })
    @ApiConsumes('multipart/form-data')
    @Roles(UserRole.ADMIN)
    @UseInterceptors(FileInterceptor('file', {
        storage: diskStorage({
            destination: './uploads/sounds',
            filename: (req, file, cb) => {
                const randomName = Array(32).fill(null).map(() => (Math.round(Math.random() * 16)).toString(16)).join('');
                cb(null, `${randomName}${extname(file.originalname)}`);
            },
        }),
        fileFilter: (req, file, cb) => {
            if (!file.mimetype.startsWith('audio/')) {
                return cb(new Error('Hanya file audio yang diizinkan'), false);
            }
            cb(null, true);
        },
        limits: {
            fileSize: 5 * 1024 * 1024,
        },
    }))
    uploadTvRingtone(
        @Param('id', ParseUUIDPipe) id: string,
        @UploadedFile() file: Express.Multer.File,
        @Body('slot') slot: string,
        @Req() req: any,
    ) {
        if (!file) {
            throw new BadRequestException('File audio wajib diunggah');
        }
        const url = `/uploads/sounds/${file.filename}`;
        return this.sitesService.setTvRingtone(id, slot, url, req.user?.id || req.user?.userId);
    }

    @Delete(':id/tv-ringtone/:slot')
    @ApiOperation({ summary: 'Remove a TV board ringtone from one slot' })
    @Roles(UserRole.ADMIN)
    clearTvRingtone(
        @Param('id', ParseUUIDPipe) id: string,
        @Param('slot') slot: string,
        @Req() req: any,
    ) {
        return this.sitesService.clearTvRingtone(id, slot, req.user?.id || req.user?.userId);
    }
}
