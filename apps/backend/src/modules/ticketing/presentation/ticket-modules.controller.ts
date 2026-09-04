import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Body,
    Param,
    UseGuards,
    Req,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../../../shared/core/guards/roles.guard';
import { Roles } from '../../../shared/core/decorators/roles.decorator';
import { UserRole } from '../../users/enums/user-role.enum';
import { TicketModulesService } from '../services/ticket-modules.service';
import { CreateTicketModuleDto, UpdateTicketModuleDto, ReorderTicketModulesDto } from '../dto/ticket-module.dto';

@ApiTags('Ticket Modules')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('ticket-modules')
export class TicketModulesController {
    constructor(private readonly ticketModulesService: TicketModulesService) { }

    @Get()
    @ApiOperation({ summary: 'Get active ticket modules for current user' })
    async findAllForUser(@Req() req: any) {
        const userRole = req.user.role as UserRole;
        return this.ticketModulesService.findAllForUser(userRole);
    }

    @Get('admin')
    @Roles(UserRole.ADMIN)
    @ApiOperation({ summary: 'Get all ticket modules (Admin Settings)' })
    async findAllForAdmin() {
        return this.ticketModulesService.findAllForAdmin();
    }

    @Get('slug/:slug')
    @ApiOperation({ summary: 'Get ticket module by slug' })
    async findBySlug(@Param('slug') slug: string) {
        return this.ticketModulesService.findBySlug(slug);
    }

    @Post()
    @Roles(UserRole.ADMIN)
    @ApiOperation({ summary: 'Create new ticket module (Admin only)' })
    async create(@Body() dto: CreateTicketModuleDto) {
        return this.ticketModulesService.create(dto);
    }

    @Patch('reorder')
    @Roles(UserRole.ADMIN)
    @ApiOperation({ summary: 'Reorder ticket modules (Admin only)' })
    async reorder(@Body() dto: ReorderTicketModulesDto) {
        return this.ticketModulesService.reorder(dto.orderedIds);
    }

    @Patch(':id')
    @Roles(UserRole.ADMIN)
    @ApiOperation({ summary: 'Update ticket module (Admin only)' })
    async update(@Param('id') id: string, @Body() dto: UpdateTicketModuleDto) {
        return this.ticketModulesService.update(id, dto);
    }

    @Delete(':id')
    @Roles(UserRole.ADMIN)
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Delete custom ticket module (Admin only)' })
    async delete(@Param('id') id: string) {
        return this.ticketModulesService.delete(id);
    }
}
