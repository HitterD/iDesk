import {
    Controller,
    Get,
    Post,
    Body,
    Param,
    UseGuards,
    Request,
    UseInterceptors,
    UploadedFiles,
    Patch,
    Req,
} from '@nestjs/common';
import { TicketService } from '../ticket.service';
import { CreateTicketDto } from '../dto/create-ticket.dto';
import { JwtAuthGuard } from '../../auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../../../shared/core/guards/roles.guard';
import { Roles } from '../../../shared/core/decorators/roles.decorator';
import { UserRole } from '../../users/enums/user-role.enum';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ReplyMessageDto } from '../dto/reply-message.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { extname } from 'path';

@ApiTags('Tickets')
@Controller('tickets')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TicketsController {
    constructor(private readonly ticketService: TicketService) { }

    @Post()
    @ApiOperation({ summary: 'Create a new ticket' })
    @ApiResponse({ status: 201, description: 'Ticket created successfully.' })
    async createTicket(@Request() req, @Body() createTicketDto: CreateTicketDto) {
        return this.ticketService.createTicket(req.user.userId, createTicketDto);
    }

    @Get()
    @ApiOperation({ summary: 'Get all tickets' })
    @ApiResponse({ status: 200, description: 'Return all tickets.' })
    async findAll(@Request() req) {
        return this.ticketService.findAll(req.user.userId, req.user.role);
    }

    @Get(':id/messages')
    @ApiOperation({ summary: 'Get ticket messages' })
    @ApiResponse({ status: 200, description: 'Return ticket messages.' })
    async getMessages(@Param('id') id: string) {
        return this.ticketService.getMessages(id);
    }

    @Post(':id/reply')
    @UseGuards(JwtAuthGuard)
    @UseInterceptors(FilesInterceptor('files', 5, {
        storage: diskStorage({
            destination: './uploads',
            filename: (req, file, cb) => {
                const randomName = Array(32).fill(null).map(() => (Math.round(Math.random() * 16)).toString(16)).join('');
                cb(null, `${randomName}${extname(file.originalname)}`);
            },
        }),
    }))
    async replyToTicket(
        @Param('id') id: string,
        @Req() req,
        @Body('content') content: string,
        @Body('mentionedUserIds') mentionedUserIds: string | string[],
        @UploadedFiles() files: Express.Multer.File[],
    ) {
        const filePaths = files ? files.map(f => `/uploads/${f.filename}`) : [];

        let parsedMentionedUserIds: string[] = [];
        if (typeof mentionedUserIds === 'string') {
            try {
                parsedMentionedUserIds = JSON.parse(mentionedUserIds);
            } catch (e) {
                parsedMentionedUserIds = [];
            }
        } else if (Array.isArray(mentionedUserIds)) {
            parsedMentionedUserIds = mentionedUserIds;
        }

        return this.ticketService.replyToTicket(id, req.user.userId, content, filePaths, parsedMentionedUserIds);
    }

    @Patch(':id/status')
    @Roles(UserRole.ADMIN, UserRole.AGENT)
    @ApiOperation({ summary: 'Update ticket status' })
    @ApiResponse({ status: 200, description: 'Ticket status updated.' })
    async updateStatus(
        @Param('id') id: string,
        @Body('status') status: any,
        @Request() req,
    ) {
        return this.ticketService.updateTicket(id, { status }, req.user.userId);
    }

    @Patch(':id/priority')
    @Roles(UserRole.ADMIN, UserRole.AGENT)
    @ApiOperation({ summary: 'Update ticket priority' })
    @ApiResponse({ status: 200, description: 'Ticket priority updated.' })
    async updatePriority(
        @Param('id') id: string,
        @Body('priority') priority: any,
        @Request() req,
    ) {
        return this.ticketService.updateTicket(id, { priority }, req.user.userId);
    }
    @Patch(':id/assign')
    @Roles(UserRole.ADMIN, UserRole.AGENT)
    @ApiOperation({ summary: 'Assign ticket to an agent' })
    @ApiResponse({ status: 200, description: 'Ticket assigned successfully.' })
    async assignTicket(
        @Param('id') id: string,
        @Body('assigneeId') assigneeId: string,
        @Request() req,
    ) {
        return this.ticketService.assignTicket(id, assigneeId, req.user.userId);
    }
}
