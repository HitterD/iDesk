import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AuditService } from '../../audit/audit.service';
import { AuditAction, AuditSeverity } from '../../audit/entities/audit-log.entity';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { JwtAuthGuard } from '../../auth/infrastructure/guards/jwt-auth.guard';
import { ConfirmPeriodActionDto, CreatePeriodDto, PeriodListQueryDto, PeriodOverlapQueryDto, SetPairModeDto, SetPeriodRatersDto, SetRateesDto, SetPeriodPicsDto, SetTeamQuestionsDto, UpdatePeriodDto, UpdatePeriodRateeDto } from '../dto/period.dto';
import { CsiAdminGuard } from '../guards/csi-admin.guard';
import { CsiPeriodService } from '../services/csi-period.service';

type CsiAdminRequest = Request & { csiScope: ServiceScope; user: { userId: string } };
const PERIOD_ENTITY = 'csi_period';
const CSI_ID_PIPE = new ParseUUIDPipe({
    exceptionFactory: () => new BadRequestException('ID harus berupa UUID'),
});

@Controller('csi/admin/:scope/periods')
@UseGuards(JwtAuthGuard, CsiAdminGuard)
export class CsiAdminPeriodController {
    constructor(private readonly periods: CsiPeriodService, private readonly audit: AuditService) { }

    @Get()
    list(@Req() req: CsiAdminRequest, @Query() query: PeriodListQueryDto) {
        return this.periods.list(req.csiScope, query.siteId);
    }

    @Post()
    create(@Req() req: CsiAdminRequest, @Body() dto: CreatePeriodDto) {
        return this.periods.create(req.csiScope, dto, req.user.userId);
    }

    // Static path before ':id'.
    @Get('overlaps')
    overlaps(@Req() req: CsiAdminRequest, @Query() query: PeriodOverlapQueryDto) {
        return this.periods.overlaps(req.csiScope, query.siteIds, query.startDate, query.endDate, query.excludeId);
    }

    @Get(':id')
    get(@Req() req: CsiAdminRequest, @Param('id', CSI_ID_PIPE) id: string) {
        return this.periods.get(req.csiScope, id);
    }

    @Patch(':id')
    update(@Req() req: CsiAdminRequest, @Param('id', CSI_ID_PIPE) id: string, @Body() dto: UpdatePeriodDto) {
        return this.periods.update(req.csiScope, id, dto);
    }

    @Delete(':id')
    remove(@Req() req: CsiAdminRequest, @Param('id', CSI_ID_PIPE) id: string) {
        return this.periods.remove(req.csiScope, id);
    }

    @Post(':id/publish')
    publish(@Req() req: CsiAdminRequest, @Param('id', CSI_ID_PIPE) id: string) {
        return this.periods.publish(req.csiScope, id);
    }

    @Post(':id/cancel')
    @HttpCode(HttpStatus.OK)
    async cancel(@Req() req: CsiAdminRequest, @Param('id', CSI_ID_PIPE) id: string, @Body() dto: ConfirmPeriodActionDto) {
        const result = await this.periods.cancel(req.csiScope, id, dto, req.user.userId);
        if (!('audit' in result)) return result;
        await this.audit.log({
            userId: req.user.userId, action: AuditAction.CSI_PERIOD_CANCEL, entityType: PERIOD_ENTITY, entityId: id, severity: AuditSeverity.HIGH,
            oldValue: { status: result.audit.previous, responses: result.audit.responses }, newValue: { status: 'CANCELLED' },
            description: `Batalkan survei CSI "${result.detail.title}" (${result.audit.responses} jawaban). Alasan: ${result.audit.reason}`, request: req,
        });
        return result.detail;
    }

    @Post(':id/restore')
    @HttpCode(HttpStatus.OK)
    async restore(@Req() req: CsiAdminRequest, @Param('id', CSI_ID_PIPE) id: string) {
        const detail = await this.periods.restore(req.csiScope, id);
        await this.audit.log({
            userId: req.user.userId, action: AuditAction.CSI_PERIOD_RESTORE, entityType: PERIOD_ENTITY, entityId: id,
            newValue: { status: detail.publishStatus }, description: `Aktifkan lagi survei CSI "${detail.title}"`, request: req,
        });
        return detail;
    }

    @Post(':id/purge')
    @HttpCode(HttpStatus.OK)
    async purge(@Req() req: CsiAdminRequest, @Param('id', CSI_ID_PIPE) id: string, @Body() dto: ConfirmPeriodActionDto) {
        const { period, audit } = await this.periods.purge(req.csiScope, id, dto);
        await this.audit.log({
            userId: req.user.userId, action: AuditAction.CSI_PERIOD_PURGE, entityType: PERIOD_ENTITY, entityId: id, severity: AuditSeverity.HIGH,
            oldValue: { title: period.title, startDate: period.startDate, endDate: period.endDate, responses: audit.responses },
            description: `Hapus permanen survei CSI "${period.title}" beserta ${audit.responses} jawaban. Alasan: ${audit.reason}`, request: req,
        });
        return { deleted: true as const };
    }

    @Put(':id/pair-mode')
    setPairMode(@Req() req: CsiAdminRequest, @Param('id', CSI_ID_PIPE) id: string, @Body() dto: SetPairModeDto) {
        return this.periods.setPairMode(req.csiScope, id, dto.mode);
    }

    @Post(':id/unpublish')
    unpublish(@Req() req: CsiAdminRequest, @Param('id', CSI_ID_PIPE) id: string) {
        return this.periods.unpublish(req.csiScope, id);
    }

    @Put(':id/ratees')
    setRatees(@Req() req: CsiAdminRequest, @Param('id', CSI_ID_PIPE) id: string, @Body() dto: SetRateesDto) {
        return this.periods.setRatees(req.csiScope, id, dto.ratees);
    }

    @Put(':id/pics')
    setPics(@Req() req: CsiAdminRequest, @Param('id', CSI_ID_PIPE) id: string, @Body() dto: SetPeriodPicsDto) {
        return this.periods.setPics(req.csiScope, id, dto.picIds, dto.dimensionIds);
    }

    @Put(':id/team')
    setTeamQuestions(@Req() req: CsiAdminRequest, @Param('id', CSI_ID_PIPE) id: string, @Body() dto: SetTeamQuestionsDto) {
        return this.periods.setTeamQuestions(req.csiScope, id, dto.siteId, dto.questionIds);
    }

    @Patch(':id/ratees/:periodRateeId')
    updateRatee(
        @Req() req: CsiAdminRequest, @Param('id', CSI_ID_PIPE) id: string,
        @Param('periodRateeId', CSI_ID_PIPE) periodRateeId: string, @Body() dto: UpdatePeriodRateeDto,
    ) {
        return this.periods.updateRatee(req.csiScope, id, periodRateeId, dto);
    }

    @Put(':id/raters')
    setRaters(@Req() req: CsiAdminRequest, @Param('id', CSI_ID_PIPE) id: string, @Body() dto: SetPeriodRatersDto) {
        return this.periods.setRaters(req.csiScope, id, dto.userIds);
    }
}
