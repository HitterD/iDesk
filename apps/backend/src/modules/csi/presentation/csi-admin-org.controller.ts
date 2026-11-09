import { BadRequestException, Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query, Req, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { extname } from 'path';
import { MULTER_OPTIONS } from '../../../shared/core/config/upload.config';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { JwtAuthGuard } from '../../auth/infrastructure/guards/jwt-auth.guard';
import { MasterListQueryDto } from '../dto/master.dto';
import { UpdatePicDto } from '../dto/pic.dto';
import { CsiAdminGuard } from '../guards/csi-admin.guard';
import { CsiOrgService } from '../org/csi-org.service';
import { CsiUnitRulesService } from '../org/csi-unit-rules.service';
import { SetRaterPicsDto, SetUnitRulesDto } from '../dto/unit-rules.dto';
import { CsiPairsExcelService } from '../org/csi-pairs-excel.service';
import { Response } from 'express';
import { CSI_PHOTO_URL_PREFIX, CsiSubjectService } from '../services/csi-subject.service';

type CsiAdminRequest = { csiScope: ServiceScope };
/** The approver hierarchy workbook is ~4.5 MB; read in memory and streamed sheet by sheet (never written to disk). */
const DIRECTORY_MAX_BYTES = 15 * 1024 * 1024;
const XLSX_EXTENSION = '.xlsx';
const XLSX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const ID_PIPE = new ParseUUIDPipe({ exceptionFactory: () => new BadRequestException('ID harus berupa UUID') });

const DIRECTORY_UPLOAD = {
    storage: memoryStorage(),
    limits: { fileSize: DIRECTORY_MAX_BYTES, files: 1 },
    fileFilter: (_req: unknown, file: Express.Multer.File, callback: (error: Error | null, accept: boolean) => void) => {
        if (extname(file.originalname ?? '').toLowerCase() !== XLSX_EXTENSION) {
            callback(new BadRequestException('File harus berformat .xlsx'), false);
            return;
        }
        callback(null, true);
    },
};

/** HC organisation data: the employee directory import and the PIC master (layanan / bagian / orang). */
@Controller('csi/admin/:scope/org')
@UseGuards(JwtAuthGuard, CsiAdminGuard)
export class CsiAdminOrgController {
    constructor(private readonly org: CsiOrgService, private readonly subjects: CsiSubjectService, private readonly rules: CsiUnitRulesService, private readonly pairsExcel: CsiPairsExcelService) { }

    /** "Siapa menilai siapa" as Excel (one row per rater → PIC). */
    @Get('periods/:periodId/pairs.xlsx')
    async exportPairs(@Req() req: CsiAdminRequest, @Param('periodId', ID_PIPE) periodId: string, @Res() res: Response) {
        const { filename, buffer } = await this.pairsExcel.exportWorkbook(req.csiScope, periodId);
        res.set({ 'Content-Type': XLSX_CONTENT_TYPE, 'Content-Disposition': `attachment; filename="${filename}"` });
        res.send(buffer);
    }

    /** Dry run by default; `?commit=true` replaces the period's raters and pairs. */
    @Post('periods/:periodId/pairs/import')
    @UseInterceptors(FileInterceptor('file', DIRECTORY_UPLOAD))
    importPairs(@Req() req: CsiAdminRequest, @Param('periodId', ID_PIPE) periodId: string, @UploadedFile() file: Express.Multer.File, @Query('commit') commit?: string) {
        if (!file?.buffer?.length) throw new BadRequestException('File Excel wajib diunggah');
        return this.pairsExcel.importWorkbook(req.csiScope, periodId, file.buffer, commit === 'true');
    }

    /** Respondent units of the directory (division / department / bagian) with their active account count. */
    @Get('units')
    units() {
        return this.rules.unitOptions();
    }

    @Post('periods/:periodId/unit-rules/preview')
    previewRules(@Req() req: CsiAdminRequest, @Param('periodId', ID_PIPE) periodId: string, @Body() dto: SetUnitRulesDto) {
        return this.rules.preview(req.csiScope, periodId, dto.rules);
    }

    @Get('periods/:periodId/raters')
    raterList(@Req() req: CsiAdminRequest, @Param('periodId', ID_PIPE) periodId: string) {
        return this.rules.raterList(req.csiScope, periodId);
    }

    @Put('periods/:periodId/raters/:userId')
    setRater(@Req() req: CsiAdminRequest, @Param('periodId', ID_PIPE) periodId: string, @Param('userId', ID_PIPE) userId: string, @Body() dto: SetRaterPicsDto) {
        return this.rules.setRater(req.csiScope, periodId, userId, dto.periodRateeIds);
    }

    @Put('periods/:periodId/unit-rules')
    applyRules(@Req() req: CsiAdminRequest, @Param('periodId', ID_PIPE) periodId: string, @Body() dto: SetUnitRulesDto) {
        return this.rules.apply(req.csiScope, periodId, dto.rules);
    }

    @Get('directory')
    async directory() {
        return { people: await this.org.directoryCount() };
    }

    @Post('directory/import')
    @UseInterceptors(FileInterceptor('file', DIRECTORY_UPLOAD))
    importDirectory(@Req() req: CsiAdminRequest, @UploadedFile() file: Express.Multer.File) {
        if (!file?.buffer?.length) throw new BadRequestException('File Excel wajib diunggah');
        return this.org.importWorkbook(req.csiScope, file.buffer);
    }

    @Get('pics')
    listPics(@Req() req: CsiAdminRequest, @Query() query: MasterListQueryDto) {
        return this.org.listPics(req.csiScope, query.includeInactive);
    }

    @Patch('pics/:id')
    updatePic(@Req() req: CsiAdminRequest, @Param('id', ID_PIPE) id: string, @Body() dto: UpdatePicDto) {
        return this.org.updatePic(req.csiScope, id, dto);
    }

    @Post('pics/:id/photo')
    @UseInterceptors(FileInterceptor('file', MULTER_OPTIONS.csiPhoto))
    async uploadPicPhoto(@Req() req: CsiAdminRequest, @Param('id', ID_PIPE) id: string, @UploadedFile() file: Express.Multer.File) {
        if (!file) throw new BadRequestException('File foto wajib diunggah');
        try {
            const { view, previous } = await this.org.setPicPhoto(req.csiScope, id, `${CSI_PHOTO_URL_PREFIX}${file.filename}`);
            await this.subjects.removeCsiPhoto(previous);
            return view;
        } catch (error) {
            await this.subjects.removeCsiPhoto(`${CSI_PHOTO_URL_PREFIX}${file.filename}`);
            throw error;
        }
    }
}
