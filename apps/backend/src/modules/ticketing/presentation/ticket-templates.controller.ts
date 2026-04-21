import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Delete,
    UseGuards,
    Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../../../shared/core/guards/roles.guard';
import { Roles } from '../../../shared/core/decorators/roles.decorator';
import { UserRole } from '../../users/enums/user-role.enum';
import { TicketTemplateService } from '../services/ticket-template.service';
import { CreateTicketTemplateDto, UpdateTicketTemplateDto } from '../dto/ticket-template.dto';

@ApiTags('Ticket Templates')
@Controller('ticket-templates')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class TicketTemplatesController {
    constructor(private readonly templateService: TicketTemplateService) {}

    @Post()
    @Roles(UserRole.ADMIN)
    @ApiOperation({ summary: 'Create a new ticket template' })
    @ApiResponse({ status: 201, description: 'Template created successfully.' })
    async create(@Body() dto: CreateTicketTemplateDto) {
        return this.templateService.create(dto);
    }

    @Get()
    @ApiOperation({ summary: 'Get all ticket templates' })
    @ApiQuery({ name: 'activeOnly', required: false, type: Boolean })
    async findAll(@Query('activeOnly') activeOnly?: string) {
        return this.templateService.findAll(activeOnly === 'true');
    }

    @Get('popular')
    @ApiOperation({ summary: 'Get popular templates' })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    async getPopular(@Query('limit') limit?: number) {
        return this.templateService.getPopularTemplates(limit || 5);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get a template by ID' })
    async findOne(@Param('id') id: string) {
        return this.templateService.findOne(id);
    }

    @Patch(':id')
    @Roles(UserRole.ADMIN)
    @ApiOperation({ summary: 'Update a template' })
    async update(@Param('id') id: string, @Body() dto: UpdateTicketTemplateDto) {
        return this.templateService.update(id, dto);
    }

    @Delete(':id')
    @Roles(UserRole.ADMIN)
    @ApiOperation({ summary: 'Delete a template' })
    async remove(@Param('id') id: string) {
        return this.templateService.remove(id);
    }

    @Post(':id/use')
    @ApiOperation({ summary: 'Mark template as used (increment usage count)' })
    async incrementUsage(@Param('id') id: string) {
        await this.templateService.incrementUsage(id);
        return { success: true };
    }
}
