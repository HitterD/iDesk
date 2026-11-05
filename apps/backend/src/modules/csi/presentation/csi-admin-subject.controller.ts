import { BadRequestException, Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Put, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MULTER_OPTIONS } from '../../../shared/core/config/upload.config';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { JwtAuthGuard } from '../../auth/infrastructure/guards/jwt-auth.guard';
import { AddRatersDto } from '../dto/master.dto';
import { CreateTeamDto, UpdateSubjectDto } from '../dto/subject.dto';
import { CsiAdminGuard } from '../guards/csi-admin.guard';
import { CSI_PHOTO_URL_PREFIX, CsiSubjectService } from '../services/csi-subject.service';

type CsiAdminRequest = { csiScope: ServiceScope; user: { userId: string } };

@Controller('csi/admin/:scope/subjects')
@UseGuards(JwtAuthGuard, CsiAdminGuard)
export class CsiAdminSubjectController {
    constructor(private readonly subjects: CsiSubjectService) { }

    @Get()
    list(@Req() req: CsiAdminRequest) {
        return this.subjects.list(req.csiScope);
    }

    // Declared before ':key' routes so "teams" is never read as a subject key.
    @Post('teams')
    createTeam(@Req() req: CsiAdminRequest, @Body() dto: CreateTeamDto) {
        return this.subjects.createTeam(req.csiScope, dto.siteId);
    }

    @Post('members')
    addMembers(@Req() req: CsiAdminRequest, @Body() dto: AddRatersDto) {
        return this.subjects.addMembers(req.csiScope, dto.userIds);
    }

    @Delete('members/:userId')
    removeMember(@Req() req: CsiAdminRequest, @Param('userId', new ParseUUIDPipe({ exceptionFactory: () => new BadRequestException('ID harus berupa UUID') })) userId: string) {
        return this.subjects.removeMember(req.csiScope, userId);
    }

    @Put(':key')
    update(@Req() req: CsiAdminRequest, @Param('key') key: string, @Body() dto: UpdateSubjectDto) {
        return this.subjects.update(req.csiScope, key, dto);
    }

    @Post(':key/photo')
    @UseInterceptors(FileInterceptor('file', MULTER_OPTIONS.csiPhoto))
    uploadPhoto(@Req() req: CsiAdminRequest, @Param('key') key: string, @UploadedFile() file: Express.Multer.File) {
        if (!file) throw new BadRequestException('File foto wajib diunggah');
        return this.subjects.setPhoto(req.csiScope, key, `${CSI_PHOTO_URL_PREFIX}${file.filename}`, file.path);
    }
}
