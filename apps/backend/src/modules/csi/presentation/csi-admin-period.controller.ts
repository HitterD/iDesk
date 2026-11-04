import { BadRequestException, Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { JwtAuthGuard } from '../../auth/infrastructure/guards/jwt-auth.guard';
import { CreatePeriodDto, PeriodListQueryDto, PeriodOverlapQueryDto, SetPeriodRatersDto, SetRateesDto, SetTeamQuestionsDto, UpdatePeriodDto, UpdatePeriodRateeDto } from '../dto/period.dto';
import { CsiAdminGuard } from '../guards/csi-admin.guard';
import { CsiPeriodService } from '../services/csi-period.service';

type CsiAdminRequest = { csiScope: ServiceScope; user: { userId: string } };
const CSI_ID_PIPE = new ParseUUIDPipe({
    exceptionFactory: () => new BadRequestException('ID harus berupa UUID'),
});

@Controller('csi/admin/:scope/periods')
@UseGuards(JwtAuthGuard, CsiAdminGuard)
export class CsiAdminPeriodController {
    constructor(private readonly periods: CsiPeriodService) { }

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

    @Post(':id/unpublish')
    unpublish(@Req() req: CsiAdminRequest, @Param('id', CSI_ID_PIPE) id: string) {
        return this.periods.unpublish(req.csiScope, id);
    }

    @Put(':id/ratees')
    setRatees(@Req() req: CsiAdminRequest, @Param('id', CSI_ID_PIPE) id: string, @Body() dto: SetRateesDto) {
        return this.periods.setRatees(req.csiScope, id, dto.ratees);
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
