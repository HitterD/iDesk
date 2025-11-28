import { Controller, Get, Post, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { TicketAttributesService } from '../ticket-attributes.service';
import { AttributeType } from '../entities/ticket-attribute.entity';
import { JwtAuthGuard } from '../../auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../../../shared/core/guards/roles.guard';
import { Roles } from '../../../shared/core/decorators/roles.decorator';
import { UserRole } from '../../users/enums/user-role.enum';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Ticket Attributes')
@Controller('ticket-attributes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TicketAttributesController {
    constructor(private readonly attributesService: TicketAttributesService) { }

    @Get()
    @ApiOperation({ summary: 'Get all ticket attributes' })
    async findAll() {
        return this.attributesService.findAll();
    }

    @Post()
    @Roles(UserRole.ADMIN, UserRole.AGENT)
    @ApiOperation({ summary: 'Create a new attribute' })
    async create(@Body() body: { type: AttributeType; value: string }, @Request() req) {
        console.log('Creating attribute:', body);
        console.log('User:', req.user);
        return this.attributesService.create(body.type, body.value);
    }

    @Delete(':id')
    @Roles(UserRole.ADMIN)
    @ApiOperation({ summary: 'Delete an attribute' })
    async remove(@Param('id') id: string) {
        return this.attributesService.remove(id);
    }
}
