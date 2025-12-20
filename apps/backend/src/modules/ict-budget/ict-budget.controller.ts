import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Query,
    UseGuards,
    Request,
    ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { IctBudgetService } from './ict-budget.service';
import { CreateIctBudgetDto, ApproveIctBudgetDto, RealizeIctBudgetDto } from './dto';
import { JwtAuthGuard } from '../auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/core/guards/roles.guard';
import { Roles } from '../../shared/core/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';

@ApiTags('ICT Budget')
@ApiBearerAuth()
@Controller('ict-budget')
@UseGuards(JwtAuthGuard, RolesGuard)
export class IctBudgetController {
    constructor(private readonly ictBudgetService: IctBudgetService) { }

    @Post()
    @ApiOperation({ summary: 'Create ICT Budget request' })
    create(@Request() req, @Body() dto: CreateIctBudgetDto) {
        return this.ictBudgetService.create(req.user.userId, dto);
    }

    @Get()
    @ApiOperation({ summary: 'Get all ICT Budget requests' })
    @ApiQuery({ name: 'siteId', required: false })
    @ApiQuery({ name: 'status', required: false })
    @Roles(UserRole.ADMIN, UserRole.AGENT, UserRole.MANAGER)
    findAll(
        @Query('siteId') siteId?: string,
        @Query('status') status?: string,
    ) {
        return this.ictBudgetService.findAll({ siteId, status });
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get ICT Budget request by ID' })
    findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.ictBudgetService.findOne(id);
    }

    @Get('ticket/:ticketId')
    @ApiOperation({ summary: 'Get ICT Budget request by ticket ID' })
    findByTicketId(@Param('ticketId', ParseUUIDPipe) ticketId: string) {
        return this.ictBudgetService.findByTicketId(ticketId);
    }

    @Patch(':id/approve')
    @ApiOperation({ summary: 'Approve or reject ICT Budget request (Superior)' })
    @Roles(UserRole.ADMIN, UserRole.MANAGER)
    approve(
        @Param('id', ParseUUIDPipe) id: string,
        @Request() req,
        @Body() dto: ApproveIctBudgetDto,
    ) {
        return this.ictBudgetService.approve(id, req.user.userId, dto);
    }

    @Patch(':id/purchasing')
    @ApiOperation({ summary: 'Start purchasing process' })
    @Roles(UserRole.ADMIN, UserRole.AGENT)
    startPurchasing(
        @Param('id', ParseUUIDPipe) id: string,
        @Request() req,
    ) {
        return this.ictBudgetService.startPurchasing(id, req.user.userId);
    }

    @Patch(':id/realize')
    @ApiOperation({ summary: 'Mark ICT Budget request as realized' })
    @Roles(UserRole.ADMIN, UserRole.AGENT)
    realize(
        @Param('id', ParseUUIDPipe) id: string,
        @Request() req,
        @Body() dto: RealizeIctBudgetDto,
    ) {
        return this.ictBudgetService.realize(id, req.user.userId, dto);
    }
}
