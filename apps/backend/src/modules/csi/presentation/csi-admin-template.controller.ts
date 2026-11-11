import { BadRequestException, Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query, Req, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { JwtAuthGuard } from '../../auth/infrastructure/guards/jwt-auth.guard';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AddTemplatePicDto, AddTemplateRaterDto, CreatePeriodFromTemplateDto, CreatePeriodFromTemplatesDto, ConfirmTemplateRatersDto, ImportOptionsDto, PicResolutionInput,
    PreviewPeriodFromTemplatesDto, SetTemplateRaterAccountsDto, SetTemplateRaterAccountDto, UpdateTemplatePicDto } from '../dto/template.dto';
import { PicResolution } from '../org/csi-template-identity';
import { CsiAdminGuard } from '../guards/csi-admin.guard';
import { CsiAssignmentTemplateService } from '../services/csi-assignment-template.service';
import { CsiTemplateApplyService } from '../services/csi-template-apply.service';
import { CsiTemplateImportService } from '../services/csi-template-import.service';
import { XLSX_CONTENT_TYPE, XLSX_UPLOAD } from './csi-admin-org.controller';
import { assertHcScope } from '../services/csi-scope.util';

type CsiAdminRequest = { csiScope: ServiceScope; user: { userId: string } };
/** Templates are an HC feature: the ICT scope is refused. */
const hc = (req: CsiAdminRequest) => assertHcScope(req.csiScope);
const INVALID_OPTIONS_MESSAGE = 'Opsi impor tidak valid';

/** Multipart fields arrive as text: the JSON is parsed and validated here (unknown keys are refused). */
export async function parseImportOptions(raw: string | undefined): Promise<ImportOptionsDto> {
    if (raw === undefined || raw === '') return new ImportOptionsDto();
    let plain: unknown;
    try {
        plain = JSON.parse(raw);
    } catch {
        throw new BadRequestException(INVALID_OPTIONS_MESSAGE);
    }
    if (!plain || typeof plain !== 'object' || Array.isArray(plain)) throw new BadRequestException(INVALID_OPTIONS_MESSAGE);
    const options = plainToInstance(ImportOptionsDto, plain);
    if ((await validate(options, { whitelist: true, forbidNonWhitelisted: true })).length) throw new BadRequestException(INVALID_OPTIONS_MESSAGE);
    return options;
}

const toResolutions = (input: Record<string, PicResolutionInput> = {}): Record<string, PicResolution> => Object.fromEntries(
    Object.entries(input).map(([name, { as, picName }]) => [name, as === 'rename' ? { as, picName: picName! } : { as }]));
const ID_PIPE = new ParseUUIDPipe({ exceptionFactory: () => new BadRequestException('ID harus berupa UUID') });

/** Pengaturan → Template penugasan: per-location "siapa menilai siapa" with each PIC's service function. */
@Controller('csi/admin/:scope/templates')
@UseGuards(JwtAuthGuard, CsiAdminGuard)
export class CsiAdminTemplateController {
    constructor(private readonly templates: CsiAssignmentTemplateService, private readonly applier: CsiTemplateApplyService,
        private readonly importer: CsiTemplateImportService) { }

    /** One new draft survey for several locations (1-4 templates), all applied in one transaction. */
    @Post('create-period')
    createPeriodFromTemplates(@Req() req: CsiAdminRequest, @Body() dto: CreatePeriodFromTemplatesDto) {
        const { templateIds, title, startDate, endDate } = dto;
        return this.applier.createPeriodFromTemplates(hc(req), templateIds, { title, startDate, endDate }, req.user.userId);
    }

    /** Merged dry run of `create-period` (nothing is written, no survey is created). */
    @Post('preview-period')
    previewPeriod(@Req() req: CsiAdminRequest, @Body() dto: PreviewPeriodFromTemplatesDto) {
        return this.applier.previewPeriod(hc(req), dto.templateIds);
    }

    /** Add-only sync into an existing survey; dry run by default, `?commit=true` writes. */
    @Post(':id/apply/:periodId')
    apply(@Req() req: CsiAdminRequest, @Param('id', ID_PIPE) id: string, @Param('periodId', ID_PIPE) periodId: string, @Query('commit') commit?: string) {
        return this.applier.applyToPeriod(hc(req), id, periodId, commit === 'true');
    }

    /** New draft survey for the template's location with the template applied (single-location form of `create-period`). */
    @Post(':id/create-period')
    createPeriod(@Req() req: CsiAdminRequest, @Param('id', ID_PIPE) id: string, @Body() dto: CreatePeriodFromTemplateDto) {
        const { title, startDate, endDate } = dto;
        return this.applier.createPeriodFromTemplates(hc(req), [id], { title, startDate, endDate }, req.user.userId);
    }

    @Get()
    list(@Req() req: CsiAdminRequest) {
        return this.templates.list(hc(req));
    }

    @Get(':id/account-suggestions')
    accountSuggestions(@Req() req: CsiAdminRequest, @Param('id', ID_PIPE) id: string, @Query('name') name: string) {
        return this.templates.accountSuggestions(hc(req), id, name);
    }

    /** Empty workbook to fill in for a location (SMG/SPJ/KRW/JTB), with its active employees to copy names from. */
    @Get('blank/:location')
    async blankTemplate(@Req() req: CsiAdminRequest, @Param('location') location: string, @Res() res: Response) {
        const { filename, buffer } = await this.templates.blankWorkbook(hc(req), location);
        res.set({ 'Content-Type': XLSX_CONTENT_TYPE, 'Content-Disposition': `attachment; filename="${filename}"` });
        res.send(buffer);
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

    /**
     * Dry run by default. Multipart field `options` (JSON) carries commit / resolutions / prune; the legacy
     * `?commit=true` query is still honoured when `options.commit` is absent.
     */
    @Post('import/:location')
    @UseInterceptors(FileInterceptor('file', XLSX_UPLOAD))
    async importExcel(@Req() req: CsiAdminRequest, @Param('location') location: string, @UploadedFile() file: Express.Multer.File,
        @Body('options') rawOptions?: string, @Query('commit') commit?: string) {
        const scope = hc(req);
        if (!file?.buffer?.length) throw new BadRequestException('File Excel wajib diunggah');
        const options = await parseImportOptions(rawOptions);
        return this.importer.importExcel(scope, location, file.buffer, {
            commit: options.commit ?? commit === 'true', resolutions: toResolutions(options.resolutions),
            prune: options.prune ?? false, pruneConfirmed: options.pruneConfirmed ?? false,
        });
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
        return this.templates.addRater(hc(req), picId, dto, req.user.userId);
    }

    @Put('raters/account')
    setRaterAccounts(@Req() req: CsiAdminRequest, @Body() dto: SetTemplateRaterAccountsDto) {
        return this.templates.setRaterAccounts(hc(req), dto.raterIds, dto.userId ?? null, req.user.userId);
    }

    @Put('raters/confirm')
    confirmRaters(@Req() req: CsiAdminRequest, @Body() dto: ConfirmTemplateRatersDto) {
        return this.templates.confirmRaters(hc(req), dto.raterIds, dto.confirmed, req.user.userId);
    }

    @Put('raters/:raterId/account')
    setRaterAccount(@Req() req: CsiAdminRequest, @Param('raterId', ID_PIPE) raterId: string, @Body() dto: SetTemplateRaterAccountDto) {
        return this.templates.setRaterAccount(hc(req), raterId, dto.userId, req.user.userId);
    }

    @Delete('raters/:raterId')
    removeRater(@Req() req: CsiAdminRequest, @Param('raterId', ID_PIPE) raterId: string) {
        return this.templates.removeRater(hc(req), raterId);
    }
}
