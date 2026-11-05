import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/infrastructure/guards/jwt-auth.guard';
import { UserTicketTemplatesService } from './user-ticket-templates.service';
import { CreateUserTicketTemplateDto, UpdateUserTicketTemplateDto } from './user-ticket-template.dto';
import { USER_TEMPLATE_TICKET_TYPES, UserTemplateTicketType } from './user-ticket-template.constants';

/** Any signed-in user manages only their own templates (owner taken from the JWT, never the body). */
@ApiTags('My Ticket Templates')
@ApiBearerAuth()
@Controller('me/ticket-templates')
@UseGuards(JwtAuthGuard)
export class UserTicketTemplatesController {
    constructor(private readonly templates: UserTicketTemplatesService) { }

    @Get()
    @ApiOperation({ summary: "List the caller's ticket templates" })
    @ApiQuery({ name: 'ticketType', required: false, enum: USER_TEMPLATE_TICKET_TYPES })
    list(@Request() req: any, @Query('ticketType') ticketType?: string) {
        const type = (USER_TEMPLATE_TICKET_TYPES as readonly string[]).includes(ticketType ?? '')
            ? ticketType as UserTemplateTicketType
            : undefined;
        return this.templates.list(req.user.userId, type);
    }

    @Post()
    @ApiOperation({ summary: 'Save the current form as a template' })
    create(@Request() req: any, @Body() dto: CreateUserTicketTemplateDto) {
        return this.templates.create(req.user.userId, dto);
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Rename or update one of the caller\'s templates' })
    update(@Request() req: any, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserTicketTemplateDto) {
        return this.templates.update(req.user.userId, id, dto);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Delete one of the caller\'s templates' })
    remove(@Request() req: any, @Param('id', ParseUUIDPipe) id: string) {
        return this.templates.remove(req.user.userId, id);
    }
}
