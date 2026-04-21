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
    Query,
    BadRequestException,
    ParseIntPipe,
} from '@nestjs/common';
import { TicketCreateService } from '../services/ticket-create.service';
import { TicketUpdateService } from '../services/ticket-update.service';
import { TicketMessagingService } from '../services/ticket-messaging.service';
import { TicketQueryService } from '../services/ticket-query.service';
import { CreateTicketDto } from '../dto/create-ticket.dto';
import { PaginationDto } from '../dto/pagination.dto';
import { JwtAuthGuard } from '../../auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../../../shared/core/guards/roles.guard';
import { Roles } from '../../../shared/core/decorators/roles.decorator';
import { UserRole } from '../../users/enums/user-role.enum';
import { FilesInterceptor } from '@nestjs/platform-express';
import { CacheInterceptor } from '@nestjs/cache-manager';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { validateFileMagicBytes } from '../../../shared/core/validators/magic-bytes.validator';
import {
    UpdateTicketStatusDto,
    UpdateTicketPriorityDto,
    UpdateTicketCategoryDto,
    UpdateTicketDeviceDto,
    AssignTicketDto,
    CancelTicketDto
} from '../dto/update-ticket.dto';
import { BulkUpdateTicketsDto } from '../dto/bulk-update.dto';
import { MergeTicketsDto } from '../dto/ticket-merge.dto';
import { TicketMergeService } from '../services/ticket-merge.service';
import { TicketStatsService } from '../services/ticket-stats.service';

@ApiTags('Tickets')
@Controller('tickets')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TicketsController {
    constructor(
        private readonly ticketCreateService: TicketCreateService,
        private readonly ticketUpdateService: TicketUpdateService,
        private readonly ticketMessagingService: TicketMessagingService,
        private readonly ticketQueryService: TicketQueryService,
        private readonly ticketMergeService: TicketMergeService,
        private readonly ticketStatsService: TicketStatsService,
    ) { }

    @Post()
    @ApiOperation({ summary: 'Create a new ticket' })
    @ApiResponse({ status: 201, description: 'Ticket created successfully.' })
    @UseInterceptors(FilesInterceptor('files', 5, {
        storage: diskStorage({
            destination: './uploads',
            filename: (req, file, cb) => {
                const randomName = Array(32).fill(null).map(() => (Math.round(Math.random() * 16)).toString(16)).join('');
                cb(null, `${randomName}${extname(file.originalname)}`);
            },
        }),
    }))
    async createTicket(
        @Request() req: any,
        @Body() createTicketDto: CreateTicketDto,
        @UploadedFiles() files: Express.Multer.File[],
    ) {
        if (files && files.length > 0) {
            for (const file of files) {
                if (!validateFileMagicBytes(file)) {
                    throw new BadRequestException('File type not allowed or file is corrupted');
                }
            }
        }
        const filePaths = files ? files.map(f => `/uploads/${f.filename}`) : [];
        return this.ticketCreateService.createTicket(req.user.userId, createTicketDto, filePaths);
    }

    @Get()
    @ApiOperation({ summary: 'Get all tickets' })
    @ApiResponse({ status: 200, description: 'Return all tickets.' })
    async findAll(@Request() req: any) {
        return this.ticketQueryService.findAll(req.user.userId, req.user.role);
    }

    @Get('paginated')
    @ApiOperation({ summary: 'Get paginated tickets with filtering' })
    @ApiResponse({ status: 200, description: 'Return paginated tickets.' })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    @ApiQuery({ name: 'sortBy', required: false, type: String })
    @ApiQuery({ name: 'sortOrder', required: false, enum: ['ASC', 'DESC'] })
    @ApiQuery({ name: 'status', required: false, type: String })
    @ApiQuery({ name: 'priority', required: false, type: String })
    @ApiQuery({ name: 'category', required: false, type: String })
    @ApiQuery({ name: 'search', required: false, type: String })
    @ApiQuery({ name: 'siteId', required: false, type: String, description: 'Filter by site ID' })
    @ApiQuery({ name: 'siteIds', required: false, type: [String], description: 'Filter by multiple site IDs (ADMIN/MANAGER only)' })
    async findAllPaginated(@Request() req: any, @Query() pagination: PaginationDto) {
        // Pass user's siteId for site isolation (USER/AGENT)
        const userSiteId = req.user.siteId || null;
        return this.ticketQueryService.findAllPaginated(req.user.userId, req.user.role, userSiteId, pagination);
    }

    @Get('dashboard/stats')
    @Roles(UserRole.ADMIN, UserRole.AGENT, UserRole.AGENT_OPERATIONAL_SUPPORT, UserRole.AGENT_ADMIN, UserRole.AGENT_ORACLE)
    @ApiOperation({ summary: 'Get dashboard statistics' })
    @ApiResponse({ status: 200, description: 'Return dashboard statistics.' })
    async getDashboardStats(
        @Request() req: any, 
        @Query('excludeCategory') excludeCategory?: string,
        @Query('days') daysQuery?: string
    ) {
        const days = daysQuery ? parseInt(daysQuery, 10) : 7;
        return this.ticketQueryService.getDashboardStats(req.user.userId, req.user.role, excludeCategory, days);
    }

    @Get('hardware-stats')
    @Roles(UserRole.ADMIN, UserRole.AGENT)
    @ApiOperation({ summary: 'Get hardware installation statistics' })
    @ApiResponse({ status: 200, description: 'Return hardware stats.' })
    async getHardwareStats(@Request() req: any) {
        return this.ticketStatsService.getHardwareInstallationStats(req.user.userId);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get ticket details' })
    @ApiResponse({ status: 200, description: 'Return ticket details.' })
    async findOne(@Param('id') id: string) {
        return this.ticketQueryService.findOne(id);
    }

    @Get(':id/messages')
    @ApiOperation({ summary: 'Get ticket messages' })
    @ApiResponse({ status: 200, description: 'Return ticket messages.' })
    async getMessages(@Param('id') id: string) {
        return this.ticketMessagingService.getMessages(id);
    }

    @Get(':id/messages/paginated')
    @ApiOperation({ summary: 'Get ticket messages with pagination (4.2.2)' })
    @ApiResponse({ status: 200, description: 'Return paginated ticket messages.' })
    @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
    @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 20)' })
    async getMessagesPaginated(
        @Param('id') ticketId: string,
        @Query('page') page: number = 1,
        @Query('limit') limit: number = 20,
        @Request() req: any,
    ) {
        return this.ticketMessagingService.getMessagesPaginated(ticketId, +page || 1, +limit || 20, req.user.role);
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
        @Req() req: any,
        @Body('content') content: string,
        @Body('mentionedUserIds') mentionedUserIds: string | string[],
        @Body('isInternal') isInternal: string | boolean,
        @UploadedFiles() files: Express.Multer.File[],
    ) {
        if (files && files.length > 0) {
            for (const file of files) {
                if (!validateFileMagicBytes(file)) {
                    throw new BadRequestException('File type not allowed or file is corrupted');
                }
            }
        }
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

        // Parse isInternal (can come as string 'true'/'false' from FormData)
        const isInternalNote = isInternal === true || isInternal === 'true';

        return this.ticketMessagingService.replyToTicket(
            id,
            req.user.userId,
            content,
            filePaths,
            parsedMentionedUserIds,
            isInternalNote,
        );
    }

    @Patch(':id/status')
    @Roles(UserRole.ADMIN, UserRole.AGENT)
    @ApiOperation({ summary: 'Update ticket status' })
    @ApiResponse({ status: 200, description: 'Ticket status updated.' })
    async updateStatus(
        @Param('id') id: string,
        @Body() dto: UpdateTicketStatusDto,
        @Request() req: any,
    ) {
        return this.ticketUpdateService.updateTicket(id, { status: dto.status }, req.user.userId);
    }

    @Patch(':id/priority')
    @Roles(UserRole.ADMIN, UserRole.AGENT)
    @ApiOperation({ summary: 'Update ticket priority' })
    @ApiResponse({ status: 200, description: 'Ticket priority updated.' })
    async updatePriority(
        @Param('id') id: string,
        @Body() dto: UpdateTicketPriorityDto,
        @Request() req: any,
    ) {
        return this.ticketUpdateService.updateTicket(id, { priority: dto.priority }, req.user.userId);
    }

    @Patch(':id/category')
    @Roles(UserRole.ADMIN, UserRole.AGENT)
    @ApiOperation({ summary: 'Update ticket category' })
    @ApiResponse({ status: 200, description: 'Ticket category updated.' })
    async updateCategory(
        @Param('id') id: string,
        @Body() dto: UpdateTicketCategoryDto,
        @Request() req: any,
    ) {
        return this.ticketUpdateService.updateTicket(id, { category: dto.category }, req.user.userId);
    }

    @Patch(':id/device')
    @Roles(UserRole.ADMIN, UserRole.AGENT)
    @ApiOperation({ summary: 'Update ticket device' })
    @ApiResponse({ status: 200, description: 'Ticket device updated.' })
    async updateDevice(
        @Param('id') id: string,
        @Body() dto: UpdateTicketDeviceDto,
        @Request() req: any,
    ) {
        return this.ticketUpdateService.updateTicket(id, { device: dto.device }, req.user.userId);
    }
    @Patch(':id/assign')
    @Roles(UserRole.ADMIN, UserRole.AGENT)
    @ApiOperation({ summary: 'Assign ticket to an agent' })
    @ApiResponse({ status: 200, description: 'Ticket assigned successfully.' })
    async assignTicket(
        @Param('id') id: string,
        @Body() dto: AssignTicketDto,
        @Request() req: any,
    ) {
        return this.ticketUpdateService.assignTicket(id, dto.assigneeId, req.user.userId);
    }

    @Patch(':id/cancel')
    @ApiOperation({ summary: 'Cancel a ticket' })
    @ApiResponse({ status: 200, description: 'Ticket cancelled successfully.' })
    async cancelTicket(
        @Param('id') id: string,
        @Body() dto: CancelTicketDto,
        @Request() req: any,
    ) {
        return this.ticketUpdateService.cancelTicket(id, req.user.userId, req.user.role, dto.reason);
    }

    @Patch('bulk/update')
    @Roles(UserRole.ADMIN, UserRole.AGENT)
    @ApiOperation({ summary: 'Bulk update multiple tickets' })
    @ApiResponse({ status: 200, description: 'Tickets updated successfully.' })
    async bulkUpdate(
        @Body() dto: BulkUpdateTicketsDto,
        @Request() req: any,
    ): Promise<{ updated: number; failed: string[] }> {
        return this.ticketUpdateService.bulkUpdate(
            dto.ticketIds,
            {
                status: dto.status,
                priority: dto.priority,
                assigneeId: dto.assigneeId,
                category: dto.category,
            },
            req.user.userId,
        );
    }

    @Post('merge')
    @Roles(UserRole.ADMIN, UserRole.AGENT)
    @ApiOperation({ summary: 'Merge multiple tickets into one' })
    @ApiResponse({ status: 200, description: 'Tickets merged successfully.' })
    async mergeTickets(
        @Body() dto: MergeTicketsDto,
        @Request() req: any,
    ) {
        return this.ticketMergeService.mergeTickets(
            dto.primaryTicketId,
            dto.secondaryTicketIds,
            req.user.userId,
            dto.reason,
        );
    }
}
