import {
    Body,
    Controller,
    Get,
    HttpCode,
    Param,
    ParseUUIDPipe,
    Patch,
    Post,
    Query,
    Req,
    UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../auth/infrastructure/guards/jwt-auth.guard';
import { HardwareRoleGuard, pickRole } from '../guards/hardware-role.guard';
import { HardwareRequestCommandService } from '../services/hardware-request-command.service';
import { HardwareRequestQueryService } from '../services/hardware-request-query.service';
import { ProcurementDecisionService } from '../services/procurement-decision.service';
import { CreateRequestDto } from '../dto/create-request.dto';
import { UpdateDraftDto } from '../dto/update-draft.dto';
import { ListRequestsDto } from '../dto/list-requests.dto';
import { HardwareRoles } from '../guards/roles.decorator';
import { HardwareRole } from '../domain/enums/hardware-role.enum';
import { RejectRequestDto } from '../dto/reject-request.dto';
import { UpdateItemDto } from '../dto/update-item.dto';
import { ProcurementDecisionDto } from '../dto/procurement-decision.dto';
import { ProcurementCompleteDto } from '../dto/procurement-complete.dto';
import { UserRole } from '../../users/enums/user-role.enum';

@Controller('hardware-requests')
@UseGuards(JwtAuthGuard, HardwareRoleGuard)
export class HardwareRequestController {
    constructor(
        private readonly commands: HardwareRequestCommandService,
        private readonly queries: HardwareRequestQueryService,
        private readonly procurementService: ProcurementDecisionService,
    ) {}

    @Get()
    async list(@Req() req: any, @Query() dto: ListRequestsDto) {
        const role = pickRole(req.user);
        const userRole: UserRole = req.user.role;
        const siteId: string | null = req.user.siteId ?? null;
        const result = await this.queries.list({ id: req.user.userId, role, userRole, siteId }, dto);
        return {
            success: true,
            data: result.rows,
            meta: {
                total: result.total,
                page: dto.page ?? 1,
                pageSize: dto.pageSize ?? 20,
            },
        };
    }

    @Get(':id')
    async getOne(@Req() req: any, @Param('id', new ParseUUIDPipe()) id: string) {
        const role = pickRole(req.user);
        const userRole: UserRole = req.user.role;
        const siteId: string | null = req.user.siteId ?? null;
        const data = await this.queries.getById({ id: req.user.userId, role, userRole, siteId }, id);
        return { success: true, data };
    }

    @Post()
    @Throttle({ default: { limit: 10, ttl: 60000 } })
    async create(@Req() req: any, @Body() dto: CreateRequestDto) {
        const siteId: string | null = req.user.siteId ?? null;
        const userRole: UserRole = req.user.role;
        const data = await this.commands.createDraft(req.user.userId, siteId, userRole, dto);
        return { success: true, data };
    }

    @Patch(':id')
    async update(
        @Req() req: any,
        @Param('id', new ParseUUIDPipe()) id: string,
        @Body() dto: UpdateDraftDto,
    ) {
        const siteId: string | null = req.user.siteId ?? null;
        const userRole: UserRole = req.user.role;
        const data = await this.commands.updateDraft(req.user.userId, siteId, userRole, id, dto);
        return { success: true, data };
    }

    @Post(':id/submit')
    @HttpCode(200)
    @Throttle({ default: { limit: 30, ttl: 60000 } })
    async submit(@Req() req: any, @Param('id', new ParseUUIDPipe()) id: string) {
        const data = await this.commands.submit(req.user.userId, id);
        return { success: true, data };
    }

    @Post(':id/cancel')
    @HttpCode(200)
    @Throttle({ default: { limit: 30, ttl: 60000 } })
    async cancel(@Req() req: any, @Param('id', new ParseUUIDPipe()) id: string) {
        const data = await this.commands.cancel({ id: req.user.userId, role: pickRole(req.user) as string }, id);
        return { success: true, data };
    }

    @Post(':id/close')
    @HttpCode(200)
    @HardwareRoles(HardwareRole.ICT_STAFF)
    async close(@Req() req: any, @Param('id', new ParseUUIDPipe()) id: string) {
        const data = await this.commands.close(req.user.userId, id);
        return { success: true, data };
    }

    @Post(':id/review')
    @HttpCode(200)
    @HardwareRoles(HardwareRole.ICT_STAFF)
    async review(@Req() req: any, @Param('id', new ParseUUIDPipe()) id: string) {
        const data = await this.commands.review(req.user.userId, id);
        return { success: true, data };
    }

    @Post(':id/approve')
    @HttpCode(200)
    @HardwareRoles(HardwareRole.ICT_STAFF)
    @Throttle({ default: { limit: 30, ttl: 60000 } })
    async approve(@Req() req: any, @Param('id', new ParseUUIDPipe()) id: string) {
        const data = await this.commands.approve(req.user.userId, id);
        return { success: true, data };
    }

    @Post(':id/reject')
    @HttpCode(200)
    @HardwareRoles(HardwareRole.ICT_STAFF)
    @Throttle({ default: { limit: 30, ttl: 60000 } })
    async reject(
        @Req() req: any,
        @Param('id', new ParseUUIDPipe()) id: string,
        @Body() dto: RejectRequestDto,
    ) {
        const data = await this.commands.reject(req.user.userId, id, dto);
        return { success: true, data };
    }

    @Patch(':id/items/:itemId')
    @HardwareRoles(HardwareRole.ICT_STAFF)
    async updateItem(
        @Req() req: any,
        @Param('id', new ParseUUIDPipe()) id: string,
        @Param('itemId', new ParseUUIDPipe()) itemId: string,
        @Body() dto: UpdateItemDto,
    ) {
        const data = await this.commands.updateItem(req.user.userId, id, itemId, dto);
        return { success: true, data };
    }

    @Post(':id/procurement/decision')
    @HttpCode(200)
    @HardwareRoles(HardwareRole.ICT_STAFF)
    async decideProcurementItems(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: ProcurementDecisionDto,
        @Req() req: any,
    ) {
        const items = await this.procurementService.decideItems(id, dto, req.user.userId);
        return { success: true, data: items };
    }

    @Post(':id/procurement/complete')
    @HttpCode(200)
    @HardwareRoles(HardwareRole.ICT_STAFF)
    async completeProcurement(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: ProcurementCompleteDto,
        @Req() req: any,
    ) {
        const data = await this.procurementService.completeProcurement(id, dto, req.user.userId);
        return { success: true, data };
    }

    @Post(':id/confirm-installation')
    @HttpCode(200)
    async confirmInstallation(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: { kind: 'ACCEPT_AS_IS' | 'REPORT_ISSUE', comments?: string },
        @Req() req: any,
    ) {
        const data = await this.commands.confirmInstallation(id, req.user.userId, dto);
        return { success: true, data };
    }
}
