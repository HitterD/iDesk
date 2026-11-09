import { BadRequestException, Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { JwtAuthGuard } from '../../auth/infrastructure/guards/jwt-auth.guard';
import { AddTemplatePicDto, AddTemplateRaterDto, CreatePeriodFromTemplateDto, SetTemplateRaterAccountDto, UpdateTemplatePicDto } from '../dto/template.dto';
import { CsiAdminGuard } from '../guards/csi-admin.guard';
import { CsiAssignmentTemplateService } from '../services/csi-assignment-template.service';
import { CsiTemplateApplyService } from '../services/csi-template-apply.service';
import { XLSX_UPLOAD } from './csi-admin-org.controller';
import { assertHcScope } from '../services/csi-scope.util';

type CsiAdminRequest = { csiScope: ServiceScope; user: { userId: string } };
/** Templates are an HC feature: the ICT scope is refused. */
const hc = (req: CsiAdminRequest) => assertHcScope(req.csiScope);
const ID_PIPE = new ParseUUIDPipe({ exceptionFactory: () => new BadRequestException('ID harus berupa UUID') });

/** Pengaturan → Template penugasan: per-location "siapa menilai siapa" with each PIC's service function. */
@Controller('csi/admin/:scope/templates')
@UseGuards(JwtAuthGuard, CsiAdminGuard)
export class CsiAdminTemplateController {
    constructor(private readonly templates: CsiAssignmentTemplateService, private readonly applier: CsiTemplateApplyService) { }

    /** Add-only sync into an existing survey; dry run by default, `?commit=true` writes. */
    @Post(':id/apply/:periodId')
    apply(@Req() req: CsiAdminRequest, @Param('id', ID_PIPE) id: string, @Param('periodId', ID_PIPE) periodId: string, @Query('commit') commit?: string) {
        return this.applier.applyToPeriod(hc(req), id, periodId, commit === 'true');
    }

    /** New draft survey for the template's location with the template applied. */
    @Post(':id/create-period')
    createPeriod(@Req() req: CsiAdminRequest, @Param('id', ID_PIPE) id: string, @Body() dto: CreatePeriodFromTemplateDto) {
        return this.applier.createPeriodFromTemplate(hc(req), id, dto, req.user.userId);
    }

    @Get()
    list(@Req() req: CsiAdminRequest) {
        return this.templates.list(hc(req));
    }

    @Get(':id')
    get(@Req() req: CsiAdminRequest, @Param('id', ID_PIPE) id: string) {
        return this.templates.get(hc(req), id);
    }

    /** Loads (or merges) the template bundled with the app for a location, e.g. SMG. */
    @Post('bundled/:location')
    loadBundled(@Req() req: CsiAdminRequest, @Param('location') location: string) {
        return this.templates.loadBundled(hc(req), location);
    }

    /** Dry run by default; `?commit=true` merges the workbook into the location's template. */
    @Post('import/:location')
    @UseInterceptors(FileInterceptor('file', XLSX_UPLOAD))
    importExcel(@Req() req: CsiAdminRequest, @Param('location') location: string, @UploadedFile() file: Express.Multer.File, @Query('commit') commit?: string) {
        if (!file?.buffer?.length) throw new BadRequestException('File Excel wajib diunggah');
        return this.templates.importExcel(hc(req), location, file.buffer, commit === 'true');
    }

    @Post(':id/pics')
    addPic(@Req() req: CsiAdminRequest, @Param('id', ID_PIPE) id: string, @Body() dto: AddTemplatePicDto) {
        return this.templates.addPic(hc(req), id, dto);
    }

    @Patch('pics/:picId')
    updatePic(@Req() req: CsiAdminRequest, @Param('picId', ID_PIPE) picId: string, @Body() dto: UpdateTemplatePicDto) {
        return this.templates.updatePic(hc(req), picId, dto);
    }

    @Delete('pics/:picId')
    removePic(@Req() req: CsiAdminRequest, @Param('picId', ID_PIPE) picId: string) {
        return this.templates.removePic(hc(req), picId);
    }

    @Post('pics/:picId/raters')
    addRater(@Req() req: CsiAdminRequest, @Param('picId', ID_PIPE) picId: string, @Body() dto: AddTemplateRaterDto) {
        if (!dto.name && !dto.userId) throw new BadRequestException('Isi nama penilai atau pilih akun');
        return this.templates.addRater(hc(req), picId, dto);
    }

    @Put('raters/:raterId/account')
    setRaterAccount(@Req() req: CsiAdminRequest, @Param('raterId', ID_PIPE) raterId: string, @Body() dto: SetTemplateRaterAccountDto) {
        return this.templates.setRaterAccount(hc(req), raterId, dto.userId);
    }

    @Delete('raters/:raterId')
    removeRater(@Req() req: CsiAdminRequest, @Param('raterId', ID_PIPE) raterId: string) {
        return this.templates.removeRater(hc(req), raterId);
    }
}
