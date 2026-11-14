import { BadRequestException, Body, Controller, Get, Optional, Param, ParseUUIDPipe, Patch, Post, Put, Query, Req, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { extname } from 'path';
import { MULTER_OPTIONS } from '../../../shared/core/config/upload.config';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { JwtAuthGuard } from '../../auth/infrastructure/guards/jwt-auth.guard';
import { MasterListQueryDto } from '../dto/master.dto';
import { PicAccountSuggestionsQueryDto, UpdatePicDto } from '../dto/pic.dto';
import { CsiAdminGuard } from '../guards/csi-admin.guard';
import { CsiOrgService } from '../org/csi-org.service';
import { CsiUnitRulesService } from '../org/csi-unit-rules.service';
import { SetRaterPicsDto, SetUnitRulesDto } from '../dto/unit-rules.dto';
import { CsiPairsExcelService } from '../org/csi-pairs-excel.service';
import { Response } from 'express';
import { CsiPicRenameService } from '../services/csi-pic-rename.service';
import { assertHcScope } from '../services/csi-scope.util';
import { CSI_PHOTO_URL_PREFIX, CsiSubjectService } from '../services/csi-subject.service';

type CsiAdminRequest = { csiScope: ServiceScope };
const hc = (req: CsiAdminRequest) => assertHcScope(req.csiScope);
/** The approver hierarchy workbook is ~4.5 MB; read in memory and streamed sheet by sheet (never written to disk). */
const DIRECTORY_MAX_BYTES = 15 * 1024 * 1024;
const XLSX_EXTENSION = '.xlsx';
export const XLSX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const ID_PIPE = new ParseUUIDPipe({ exceptionFactory: () => new BadRequestException('ID harus berupa UUID') });

export const XLSX_UPLOAD = {
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
    constructor(private readonly org: CsiOrgService, private readonly subjects: CsiSubjectService, private readonly rules: CsiUnitRulesService, private readonly pairsExcel: CsiPairsExcelService,
        private readonly rename: CsiPicRenameService, @Optional() @InjectDataSource() private readonly dataSource?: DataSource) { }

    /** "Siapa menilai siapa" as Excel (one row per rater → PIC). */
    @Get('periods/:periodId/pairs.xlsx')
    async exportPairs(@Req() req: CsiAdminRequest, @Param('periodId', ID_PIPE) periodId: string, @Res() res: Response) {
        const { filename, buffer } = await this.pairsExcel.exportWorkbook(hc(req), periodId);
        res.set({ 'Content-Type': XLSX_CONTENT_TYPE, 'Content-Disposition': `attachment; filename="${filename}"` });
        res.send(buffer);
    }

    /** Dry run by default; `?commit=true` replaces the period's raters and pairs. */
    @Post('periods/:periodId/pairs/import')
    @UseInterceptors(FileInterceptor('file', XLSX_UPLOAD))
    importPairs(@Req() req: CsiAdminRequest, @Param('periodId', ID_PIPE) periodId: string, @UploadedFile() file: Express.Multer.File, @Query('commit') commit?: string) {
        const scope = hc(req);
        if (!file?.buffer?.length) throw new BadRequestException('File Excel wajib diunggah');
        return this.pairsExcel.importWorkbook(scope, periodId, file.buffer, commit === 'true');
    }

    /** Respondent units of the directory (division / department / bagian) with their active account count. */
    @Get('units')
    units(@Req() req: CsiAdminRequest) {
        hc(req);
        return this.rules.unitOptions();
    }

    @Post('periods/:periodId/unit-rules/preview')
    previewRules(@Req() req: CsiAdminRequest, @Param('periodId', ID_PIPE) periodId: string, @Body() dto: SetUnitRulesDto) {
        return this.rules.preview(hc(req), periodId, dto.rules);
    }

    @Get('periods/:periodId/raters')
    raterList(@Req() req: CsiAdminRequest, @Param('periodId', ID_PIPE) periodId: string) {
        return this.rules.raterList(hc(req), periodId);
    }

    @Put('periods/:periodId/raters/:userId')
    setRater(@Req() req: CsiAdminRequest, @Param('periodId', ID_PIPE) periodId: string, @Param('userId', ID_PIPE) userId: string, @Body() dto: SetRaterPicsDto) {
        return this.rules.setRater(hc(req), periodId, userId, dto.periodRateeIds);
    }

    @Put('periods/:periodId/unit-rules')
    applyRules(@Req() req: CsiAdminRequest, @Param('periodId', ID_PIPE) periodId: string, @Body() dto: SetUnitRulesDto) {
        return this.rules.apply(hc(req), periodId, dto.rules);
    }

    @Get('directory')
    async directory(@Req() req: CsiAdminRequest) {
        hc(req);
        return { people: await this.org.directoryCount() };
    }

    @Post('directory/import')
    @UseInterceptors(FileInterceptor('file', XLSX_UPLOAD))
    importDirectory(@Req() req: CsiAdminRequest, @UploadedFile() file: Express.Multer.File) {
        const scope = hc(req);
        if (!file?.buffer?.length) throw new BadRequestException('File Excel wajib diunggah');
        return this.org.importWorkbook(scope, file.buffer);
    }

    @Get('pics')
    listPics(@Req() req: CsiAdminRequest, @Query() query: MasterListQueryDto) {
        return this.org.listPics(hc(req), query.includeInactive);
    }

    @Get('pics/account-suggestions')
    picAccountSuggestions(@Req() req: CsiAdminRequest, @Query() query: PicAccountSuggestionsQueryDto) {
        hc(req);
        return this.org.accountSuggestions(query.search, query.siteId);
    }

    /** A `fullName` renames the PIC everywhere it is still editable (template rows, draft surveys); see CsiPicRenameService. */
    @Patch('pics/:id')
    async updatePic(@Req() req: CsiAdminRequest, @Param('id', ID_PIPE) id: string, @Body() dto: UpdatePicDto) {
        const scope = hc(req);
        const { fullName, ...rest } = dto;
        const hasOrgPatch = rest.isActive !== undefined || rest.serviceFunction !== undefined || rest.userId !== undefined;
        if (fullName !== undefined && hasOrgPatch && this.dataSource) {
            return this.dataSource.transaction(async (manager) => {
                await this.rename.rename(scope, id, fullName, manager);
                return this.org.updatePic(scope, id, rest, manager);
            });
        }
        const renamed = fullName === undefined ? null : await this.rename.rename(scope, id, fullName);
        if (renamed && !hasOrgPatch) return renamed;
        return this.org.updatePic(scope, id, rest);
    }

    @Post('pics/:id/photo')
    @UseInterceptors(FileInterceptor('file', MULTER_OPTIONS.csiPhoto))
    async uploadPicPhoto(@Req() req: CsiAdminRequest, @Param('id', ID_PIPE) id: string, @UploadedFile() file: Express.Multer.File) {
        const scope = hc(req);
        if (!file) throw new BadRequestException('File foto wajib diunggah');
        try {
            const { view, previous } = await this.org.setPicPhoto(scope, id, `${CSI_PHOTO_URL_PREFIX}${file.filename}`);
            await this.subjects.removeCsiPhoto(previous);
            return view;
        } catch (error) {
            await this.subjects.removeCsiPhoto(`${CSI_PHOTO_URL_PREFIX}${file.filename}`);
            throw error;
        }
    }
}
