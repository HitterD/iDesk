import { Body, Controller, Param, ParseUUIDPipe, Post, Get, Query, UseGuards, Req, Patch, HttpCode, ForbiddenException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../auth/infrastructure/guards/jwt-auth.guard';
import { HardwareRoleGuard, pickRole } from '../guards/hardware-role.guard';
import { HardwareRoles } from '../guards/roles.decorator';
import { HardwareRole } from '../domain/enums/hardware-role.enum';
import { InstallationScheduleService } from '../services/installation-schedule.service';
import { HardwareAssetService } from '../services/hardware-asset.service';
import { HardwareRequestCommandService } from '../services/hardware-request-command.service';
import { MutualSchedulingService } from '../services/mutual-scheduling.service';
import { DeliveryTrackingService } from '../services/delivery-tracking.service';
import { HardwareRequestQueryService } from '../services/hardware-request-query.service';
import { ScheduleInstallDto } from '../dto/schedule-install.dto';
import { RescheduleInstallDto } from '../dto/reschedule-install.dto';
import { BarcodeDto } from '../dto/barcode.dto';
import { CalendarQueryDto } from '../dto/calendar-query.dto';
import { ItemDeliveryDto } from '../dto/item-delivery.dto';
import { ScheduleProposeDto } from '../dto/schedule-propose.dto';
import { SelectSlotDto } from '../dto/select-slot.dto';
import { RequestRescheduleDto } from '../dto/request-reschedule.dto';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '../../users/enums/user-role.enum';

@ApiTags('hardware-requests/installation')
@Controller('hardware-requests')
@UseGuards(JwtAuthGuard, HardwareRoleGuard)
export class InstallationController {
    constructor(
        private readonly scheduleSvc: InstallationScheduleService,
        private readonly assetSvc: HardwareAssetService,
        private readonly cmdSvc: HardwareRequestCommandService,
        private readonly mutualSchedService: MutualSchedulingService,
        private readonly deliveryService: DeliveryTrackingService,
        private readonly queryService: HardwareRequestQueryService,
    ) {}

    private getActingUser(req: any) {
        return {
            id: req.user.userId,
            role: pickRole(req.user),
            siteId: req.user.siteId ?? null,
            userRole: req.user.role as UserRole,
        };
    }

    @Post(':id/schedule')
    @HardwareRoles(HardwareRole.USER, HardwareRole.ICT_STAFF)
    async propose(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ScheduleInstallDto, @Req() req: any) {
        const data = await this.scheduleSvc.propose(id, dto, this.getActingUser(req) as any);
        return { success: true, data };
    }

    @Post(':id/schedule/confirm')
    @HardwareRoles(HardwareRole.USER, HardwareRole.ICT_STAFF)
    async confirm(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
        const data = await this.scheduleSvc.confirm(id, this.getActingUser(req) as any);
        return { success: true, data };
    }

    @Post(':id/schedule/reschedule')
    @HardwareRoles(HardwareRole.USER, HardwareRole.ICT_STAFF)
    async reschedule(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RescheduleInstallDto, @Req() req: any) {
        const data = await this.scheduleSvc.reschedule(id, dto, this.getActingUser(req) as any);
        return { success: true, data };
    }

    @Post(':id/install/start')
    @HardwareRoles(HardwareRole.ICT_STAFF)
    async start(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
        const data = await this.scheduleSvc.startInstallation(id, this.getActingUser(req) as any);
        return { success: true, data };
    }

    @Post(':id/items/:itemId/barcode')
    @HardwareRoles(HardwareRole.ICT_STAFF)
    @Throttle({ default: { limit: 60, ttl: 60000 } })
    async scan(
        @Param('id', ParseUUIDPipe) id: string,
        @Param('itemId', ParseUUIDPipe) itemId: string,
        @Body() dto: BarcodeDto,
        @Req() req: any,
    ) {
        const data = await this.assetSvc.createAsset(id, itemId, dto.barcode, req.user.userId);
        return { success: true, data };
    }

    @Post(':id/install/complete')
    @HardwareRoles(HardwareRole.ICT_STAFF)
    async complete(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: { items?: { itemId: string; assetCode: string }[] },
        @Req() req: any,
    ) {
        const user = this.getActingUser(req);
        if (dto?.items?.length) {
            for (const item of dto.items) {
                if (item.assetCode) {
                    await this.assetSvc.createAsset(id, item.itemId, item.assetCode, user.id);
                }
            }
        }
        await this.scheduleSvc.completeInstallation(id, user as any);
        const data = await this.cmdSvc.completeInstallation(id, user as any);
        return { success: true, data };
    }

    @Get('calendar')
    @HardwareRoles(HardwareRole.ICT_STAFF)
    async calendar(@Query() q: CalendarQueryDto) {
        const data = await this.scheduleSvc.calendar(q);
        return { success: true, data };
    }

    @Get('my-schedules')
    async mySchedules(@Req() req: any, @Query() q: CalendarQueryDto) {
        const userId = req.user.userId;
        const data = await this.scheduleSvc.calendar({ ...q, requesterId: userId });
        return { success: true, data };
    }

    @Get('unscheduled')
    @HardwareRoles(HardwareRole.ICT_STAFF)
    async unscheduled() {
        const data = await this.scheduleSvc.unscheduled();
        return { success: true, data };
    }

    @Get('my-today')
    @HardwareRoles(HardwareRole.ICT_STAFF)
    async myToday(@Req() req: any) {
        const data = await this.scheduleSvc.myToday(req.user.userId);
        return { success: true, data };
    }

    @Get('assets/by-barcode/:code')
    @HardwareRoles(HardwareRole.ICT_STAFF)
    async byBarcode(@Param('code') code: string) {
        const data = await this.assetSvc.findByBarcode(code);
        return { success: true, data };
    }

    @Patch(':id/items/:itemId/delivery')
    @HttpCode(200)
    @HardwareRoles(HardwareRole.ICT_STAFF)
    async updateItemDelivery(
        @Param('id', ParseUUIDPipe) id: string,
        @Param('itemId', ParseUUIDPipe) itemId: string,
        @Body() dto: ItemDeliveryDto,
        @Req() req: any,
    ) {
        const user = this.getActingUser(req);
        const item = await this.deliveryService.updateDelivery(id, itemId, dto, user as any);
        return { success: true, data: item };
    }

    @Post(':id/schedule/propose')
    @HttpCode(201)
    @HardwareRoles(HardwareRole.ICT_STAFF)
    async proposeSchedule(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: ScheduleProposeDto,
        @Req() req: any,
    ) {
        const user = this.getActingUser(req);
        const sched = await this.mutualSchedService.proposeSchedule(id, dto, user as any);
        return { success: true, data: sched };
    }

    @Post(':id/schedule/:scheduleId/select-slot')
    @HttpCode(200)
    async selectSlot(
        @Param('id', ParseUUIDPipe) id: string,
        @Param('scheduleId', ParseUUIDPipe) scheduleId: string,
        @Body() dto: SelectSlotDto,
        @Req() req: any,
    ) {
        const user = this.getActingUser(req);
        await this.guardOwnerOrIct(id, req.user);
        const sched = await this.mutualSchedService.selectSlot(id, scheduleId, dto, user as any);
        return { success: true, data: sched };
    }

    @Post(':id/schedule/:scheduleId/request-reschedule')
    @HttpCode(200)
    async requestReschedule(
        @Param('id', ParseUUIDPipe) id: string,
        @Param('scheduleId', ParseUUIDPipe) scheduleId: string,
        @Body() dto: RequestRescheduleDto,
        @Req() req: any,
    ) {
        const user = this.getActingUser(req);
        await this.guardOwnerOrIct(id, req.user);
        const sched = await this.mutualSchedService.requestReschedule(id, scheduleId, dto, user as any);
        return { success: true, data: sched };
    }

    private async guardOwnerOrIct(requestId: string, user: { userId: string; role: string }) {
        const role = (user.role as string)?.toUpperCase();
        if (role === 'ICT_STAFF' || role === 'ADMIN' || role === 'MANAGER' || role === 'AGENT') return;
        const siteId = (user as any).siteId ?? null;
        const userRole = (user as any).userRole as UserRole;
        const req = await this.queryService.getById({ id: user.userId, role: HardwareRole.USER, siteId, userRole }, requestId);
        if (req?.requesterId !== user.userId) {
            throw new ForbiddenException('not request owner');
        }
    }
}
