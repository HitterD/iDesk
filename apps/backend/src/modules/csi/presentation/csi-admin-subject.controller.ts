import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Put, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MULTER_OPTIONS } from '../../../shared/core/config/upload.config';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { JwtAuthGuard } from '../../auth/infrastructure/guards/jwt-auth.guard';
import { CsiTeamKind } from '../csi.constants';
import { AddRatersDto } from '../dto/master.dto';
import { CreateTeamDto, SetTeamMembersDto, UpdateSubjectDto, UpdateTeamDto } from '../dto/subject.dto';
import { CsiAdminGuard } from '../guards/csi-admin.guard';
import { assertHcScope } from '../services/csi-scope.util';
import { CSI_PHOTO_URL_PREFIX, CsiSubjectService } from '../services/csi-subject.service';
import { CsiTeamService } from '../services/csi-team.service';

type CsiAdminRequest = { csiScope: ServiceScope; user: { userId: string } };
const ID_PIPE = new ParseUUIDPipe({ exceptionFactory: () => new BadRequestException('ID harus berupa UUID') });

@Controller('csi/admin/:scope/subjects')
@UseGuards(JwtAuthGuard, CsiAdminGuard)
export class CsiAdminSubjectController {
    constructor(private readonly subjects: CsiSubjectService, private readonly teams: CsiTeamService) { }

    @Get()
    list(@Req() req: CsiAdminRequest) {
        return this.subjects.list(req.csiScope);
    }

    // Literal routes are declared before ':key' routes so "teams" / "members" are never read as a subject key.
    /** SITE team (default; any scope, idempotent per site) or an HC custom team (refused outside HC). */
    @Post('teams')
    createTeam(@Req() req: CsiAdminRequest, @Body() dto: CreateTeamDto) {
        if (dto.kind === CsiTeamKind.CUSTOM) return this.teams.createCustom(assertHcScope(req.csiScope), dto);
        return this.subjects.createTeam(req.csiScope, dto.siteId);
    }

    @Patch('teams/:id')
    updateTeam(@Req() req: CsiAdminRequest, @Param('id', ID_PIPE) id: string, @Body() dto: UpdateTeamDto) {
        return this.teams.update(req.csiScope, id, dto);
    }

    /** Dry run of the delete below: surveys that block it, draft surveys the team leaves, finished surveys that keep it. */
    @Get('teams/:id/delete-impact')
    teamDeleteImpact(@Req() req: CsiAdminRequest, @Param('id', ID_PIPE) id: string) {
        return this.teams.deleteImpact(assertHcScope(req.csiScope), id);
    }

    @Delete('teams/:id')
    @HttpCode(HttpStatus.NO_CONTENT)
    removeTeam(@Req() req: CsiAdminRequest, @Param('id', ID_PIPE) id: string) {
        return this.teams.remove(assertHcScope(req.csiScope), id);
    }

    @Put('teams/:id/members')
    setTeamMembers(@Req() req: CsiAdminRequest, @Param('id', ID_PIPE) id: string, @Body() dto: SetTeamMembersDto) {
        return this.teams.replaceMembers(assertHcScope(req.csiScope), id, dto.members);
    }

    @Post('members')
    addMembers(@Req() req: CsiAdminRequest, @Body() dto: AddRatersDto) {
        return this.subjects.addMembers(req.csiScope, dto.userIds);
    }

    @Delete('members/:userId')
    removeMember(@Req() req: CsiAdminRequest, @Param('userId', ID_PIPE) userId: string) {
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
