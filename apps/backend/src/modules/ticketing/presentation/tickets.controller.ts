import {
    Controller,
    Get,
    Post,
    Delete,
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
    Optional,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
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
import { CacheInterceptor } from '@nestjs/cache-manager';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { validateFileMagicBytes } from '../../../shared/core/validators/magic-bytes.validator';
import {
    UpdateTicketStatusDto,
    UpdateTicketPriorityDto,
    UpdateTicketCategoryDto,
    UpdateTicketDeviceDto,
    AssignTicketDto,
    CancelTicketDto
} from '../dto/update-ticket.dto';
import { BulkUpdateTicketsDto, BulkDeleteTicketsDto } from '../dto/bulk-update.dto';
import { BulkAssignTicketsDto } from '../dto/bulk-assign.dto';
import { MergeTicketsDto } from '../dto/ticket-merge.dto';
import { TicketMergeService } from '../services/ticket-merge.service';
import { TicketSlaExtendService } from '../services/ticket-sla-extend.service';
import { TicketForwardService } from '../services/ticket-forward.service';
import { KnowledgeBaseService } from '../../knowledge-base/knowledge-base.service';
import { TicketParticipantService } from '../services/ticket-participant.service';
import { TicketStatsService } from '../services/ticket-stats.service';
import { AttachmentMultiInterceptor, getRelativeUploadPath } from './interceptors/attachment-upload.interceptor';
import { AddParticipantsDto } from '../dto/ticket-participant.dto';
import { ExtendSlaDto } from '../dto/extend-sla.dto';
import { ForwardTicketDto } from '../dto/forward-ticket.dto';
import { CreateTicketReminderDto } from '../dto/ticket-reminder.dto';
import { TicketReminderService } from '../services/ticket-reminder.service';

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
        private readonly ticketParticipantService: TicketParticipantService,
        private readonly ticketStatsService: TicketStatsService,
        private readonly ticketSlaExtendService: TicketSlaExtendService,
        private readonly ticketForwardService: TicketForwardService,
        private readonly ticketReminderService: TicketReminderService,
        private readonly kbService: KnowledgeBaseService,
        @Optional() private readonly eventEmitter?: EventEmitter2,
    ) { }

    @Post()
    @ApiOperation({ summary: 'Create a new ticket' })
    @ApiResponse({ status: 201, description: 'Ticket created successfully.' })
    @UseInterceptors(AttachmentMultiInterceptor())
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
        const filePaths = files ? files.map(f => getRelativeUploadPath(f)) : [];
        const result = await this.ticketCreateService.createTicket(req.user.userId, createTicketDto, filePaths);

        if (files && files.length > 0 && this.eventEmitter) {
            for (const f of files) {
                this.eventEmitter.emit('file.uploaded', {
                    filePath: f.path,
                    relativePath: getRelativeUploadPath(f),
                    filename: f.filename,
                    originalName: f.originalname,
                    size: f.size,
                });
            }
        }

        return result;
    }

    @Get()
    @ApiOperation({ summary: 'Get all tickets (supports queue isolation: it-support, oracle, web-dev, mobile-dev)' })
    @ApiResponse({ status: 200, description: 'Return all tickets.' })
    @ApiQuery({ name: 'queue', required: false, enum: ['it-support', 'oracle', 'web-dev', 'mobile-dev'] })
    async findAll(@Request() req: any, @Query('queue') queue?: string) {
        return this.ticketQueryService.findAll(req.user.userId, req.user.role, req.user.siteId ?? null, queue);
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
        // Pass user's siteId for site isolation (site-locked roles)
        const userSiteId = req.user.siteId ?? null;
        return this.ticketQueryService.findAllPaginated(req.user.userId, req.user.role, userSiteId, pagination);
    }

    @Get(['paginated/oracle', 'oracle-k2'])
    @Roles(UserRole.ADMIN, UserRole.AGENT_ORACLE, UserRole.AGENT_WEB_DEV, UserRole.AGENT_MOBILE_DEV)
    @ApiOperation({ summary: 'Get paginated Oracle/K2 tickets (Oracle agent queue)' })
    @ApiResponse({ status: 200, description: 'Return paginated Oracle/K2 tickets.' })
    @ApiResponse({ status: 403, description: 'Forbidden — AGENT_ORACLE, AGENT_WEB_DEV, AGENT_MOBILE_DEV or ADMIN role required.' })
    async findAllPaginatedOracle(@Request() req: any, @Query() pagination: PaginationDto) {
        const userSiteId = req.user.siteId ?? null;
        return this.ticketQueryService.findAllPaginatedOracle(
            req.user.userId,
            req.user.role,
            userSiteId,
            pagination,
        );
    }

    @Get(['paginated/web-dev', 'web-developer'])
    @Roles(UserRole.ADMIN, UserRole.AGENT_WEB_DEV, UserRole.AGENT_ORACLE, UserRole.AGENT_MOBILE_DEV)
    @ApiOperation({ summary: 'Get paginated Web Developer tickets (Developer queue)' })
    @ApiResponse({ status: 200, description: 'Return paginated Web Developer tickets.' })
    @ApiResponse({ status: 403, description: 'Forbidden — AGENT_WEB_DEV, AGENT_ORACLE, AGENT_MOBILE_DEV or ADMIN role required.' })
    async findAllPaginatedWebDev(@Request() req: any, @Query() pagination: PaginationDto) {
        const userSiteId = req.user.siteId ?? null;
        return this.ticketQueryService.findAllPaginatedWebDev(
            req.user.userId,
            req.user.role,
            userSiteId,
            pagination,
        );
    }

    @Get(['paginated/mobile-dev', 'mobile-developer'])
    @Roles(UserRole.ADMIN, UserRole.AGENT_MOBILE_DEV, UserRole.AGENT_ORACLE, UserRole.AGENT_WEB_DEV)
    @ApiOperation({ summary: 'Get paginated Mobile Developer tickets (Developer queue)' })
    @ApiResponse({ status: 200, description: 'Return paginated Mobile Developer tickets.' })
    @ApiResponse({ status: 403, description: 'Forbidden — AGENT_MOBILE_DEV, AGENT_ORACLE, AGENT_WEB_DEV or ADMIN role required.' })
    async findAllPaginatedMobileDev(@Request() req: any, @Query() pagination: PaginationDto) {
        const userSiteId = req.user.siteId ?? null;
        return this.ticketQueryService.findAllPaginatedMobileDev(
            req.user.userId,
            req.user.role,
            userSiteId,
            pagination,
        );
    }

    @Get(['paginated/module/:slug', 'queue/:slug'])
    @ApiOperation({ summary: 'Get paginated tickets by dynamic ticket module slug' })
    @ApiResponse({ status: 200, description: 'Return paginated tickets filtered by module config.' })
    async findAllPaginatedByModule(
        @Request() req: any,
        @Param('slug') slug: string,
        @Query() pagination: PaginationDto,
    ) {
        const userSiteId = req.user.siteId ?? null;
        return this.ticketQueryService.findAllPaginatedByModule(
            slug,
            req.user.userId,
            req.user.role,
            userSiteId,
            pagination,
        );
    }

    @Get('dashboard/stats')
    @Roles(
        UserRole.ADMIN,
        UserRole.AGENT,
        UserRole.AGENT_OPERATIONAL_SUPPORT,
        UserRole.AGENT_ADMIN,
        UserRole.AGENT_ORACLE,
        UserRole.AGENT_WEB_DEV,
        UserRole.AGENT_MOBILE_DEV,
        UserRole.MANAGER,
        UserRole.USER,
    )
    @ApiOperation({ summary: 'Get dashboard statistics' })
    @ApiResponse({ status: 200, description: 'Return dashboard statistics.' })
    async getDashboardStats(
        @Request() req: any, 
        @Query('excludeCategory') excludeCategory?: string,
        @Query('days') daysQuery?: string
    ) {
        const days = daysQuery ? parseInt(daysQuery, 10) : 7;
        return this.ticketQueryService.getDashboardStats(
            req.user.userId,
            req.user.role,
            req.user.siteId ?? null,
            excludeCategory,
            days,
        );
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
    async findOne(@Param('id') id: string, @Request() req: any) {
        if (req?.user) {
            await this.ticketMessagingService.markAsRead(id, req.user.userId || req.user.id, req.user.role, req.user.siteId ?? null);
        }
        if (req?.user && (req.user.role || req.user.siteId !== undefined)) {
            return this.ticketQueryService.findOne(id, {
                id: req.user.userId || req.user.id,
                role: req.user.role,
                siteId: req.user.siteId ?? null,
            });
        }
        return this.ticketQueryService.findOne(id);
    }

    @Get(':id/kb-suggestions')
    @Roles(UserRole.ADMIN, UserRole.AGENT)
    @ApiOperation({ summary: 'Suggest most relevant KB articles for a ticket' })
    @ApiResponse({ status: 200, description: 'Top relevant articles (max 3)' })
    async getKbSuggestions(@Param('id') id: string, @Request() req: any) {
        const ticket = await this.ticketQueryService.findOne(id, {
            id: req.user?.userId || req.user?.id,
            role: req.user?.role,
            siteId: req.user?.siteId ?? null,
        });
        const text = `${ticket?.title || ''} ${ticket?.description || ''}`.trim();
        return this.kbService.suggestForTicket(text, req.user);
    }

    @Get(':id/messages')
    @ApiOperation({ summary: 'Get ticket messages' })
    @ApiResponse({ status: 200, description: 'Return ticket messages.' })
    async getMessages(@Param('id') id: string, @Request() req: any) {
        return this.ticketMessagingService.getMessages(id, req.user.role, req.user.siteId ?? null);
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
        return this.ticketMessagingService.getMessagesPaginated(
            ticketId,
            +page || 1,
            +limit || 20,
            req.user.role,
            req.user.siteId ?? null,
            req.user.userId || req.user.id,
        );
    }

    @Post(':id/reply')
    @UseGuards(JwtAuthGuard)
    @UseInterceptors(AttachmentMultiInterceptor())
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
        const filePaths = files ? files.map(f => getRelativeUploadPath(f)) : [];

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

        const result = await this.ticketMessagingService.replyToTicket(
            id,
            req.user.userId,
            content,
            filePaths,
            parsedMentionedUserIds,
            isInternalNote,
        );

        if (files && files.length > 0 && this.eventEmitter) {
            for (const f of files) {
                this.eventEmitter.emit('file.uploaded', {
                    filePath: f.path,
                    relativePath: getRelativeUploadPath(f),
                    filename: f.filename,
                    originalName: f.originalname,
                    size: f.size,
                });
            }
        }

        return result;
    }

    @Get(':id/participants')
    @ApiOperation({ summary: 'Get participants of a ticket' })
    @ApiResponse({ status: 200, description: 'Return participants.' })
    async getParticipants(@Param('id') id: string) {
        return this.ticketParticipantService.getParticipants(id);
    }

    @Post(':id/participants')
    @ApiOperation({ summary: 'Add participants to a ticket' })
    @ApiResponse({ status: 200, description: 'Participants added successfully.' })
    async addParticipants(
        @Param('id') id: string,
        @Body() body: AddParticipantsDto,
        @Request() req: any,
    ) {
        const actorUserId = req.user.userId || req.user.id;
        const actorRole = req.user.role;
        return this.ticketParticipantService.addParticipants(id, body.userIds, actorUserId, actorRole);
    }

    @Delete(':id/participants/:userId')
    @Roles(UserRole.ADMIN, UserRole.AGENT_ORACLE, UserRole.AGENT_WEB_DEV, UserRole.AGENT_MOBILE_DEV)
    @ApiOperation({ summary: 'Remove a participant from a ticket (Developer Agent / Admin only)' })
    @ApiResponse({ status: 200, description: 'Participant removed successfully.' })
    async removeParticipant(
        @Param('id') id: string,
        @Param('userId') targetUserId: string,
        @Request() req: any,
    ) {
        const actorUserId = req.user.userId || req.user.id;
        const actorRole = req.user.role;
        return this.ticketParticipantService.removeParticipant(id, targetUserId, actorUserId, actorRole);
    }

    @Patch(':id/status')
    @Roles(UserRole.ADMIN, UserRole.AGENT, UserRole.AGENT_OPERATIONAL_SUPPORT, UserRole.AGENT_ORACLE, UserRole.AGENT_WEB_DEV, UserRole.AGENT_MOBILE_DEV)
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
    @Roles(UserRole.ADMIN, UserRole.AGENT, UserRole.AGENT_OPERATIONAL_SUPPORT, UserRole.AGENT_ORACLE, UserRole.AGENT_WEB_DEV, UserRole.AGENT_MOBILE_DEV)
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
    @Roles(UserRole.ADMIN, UserRole.AGENT, UserRole.AGENT_OPERATIONAL_SUPPORT, UserRole.AGENT_ORACLE, UserRole.AGENT_WEB_DEV, UserRole.AGENT_MOBILE_DEV)
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
    @Roles(UserRole.ADMIN, UserRole.AGENT, UserRole.AGENT_OPERATIONAL_SUPPORT, UserRole.AGENT_ORACLE, UserRole.AGENT_WEB_DEV, UserRole.AGENT_MOBILE_DEV)
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
    @Roles(UserRole.ADMIN, UserRole.AGENT, UserRole.AGENT_OPERATIONAL_SUPPORT, UserRole.AGENT_ORACLE, UserRole.AGENT_WEB_DEV, UserRole.AGENT_MOBILE_DEV)
    @ApiOperation({ summary: 'Assign ticket to an agent' })
    @ApiResponse({ status: 200, description: 'Ticket assigned successfully.' })
    async assignTicket(
        @Param('id') id: string,
        @Body() dto: AssignTicketDto,
        @Request() req: any,
    ) {
        return this.ticketUpdateService.assignTicket(id, dto.assigneeId, req.user.userId, dto.reason);
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

    @Post(':id/sla/extend')
    @Roles(UserRole.ADMIN, UserRole.AGENT, UserRole.AGENT_OPERATIONAL_SUPPORT, UserRole.AGENT_ORACLE, UserRole.AGENT_WEB_DEV, UserRole.AGENT_MOBILE_DEV)
    @ApiOperation({ summary: 'Extend the SLA target of a ticket, recording the reason' })
    @ApiResponse({ status: 201, description: 'SLA extended' })
    async extendSla(
        @Param('id') id: string,
        @Body() dto: ExtendSlaDto,
        @Request() req: any,
    ) {
        return this.ticketSlaExtendService.extendSla(id, dto, {
            userId: req.user.userId,
            role: req.user.role,
            fullName: req.user.fullName || req.user.username,
        });
    }

    @Post(':id/forward')
    @Roles(UserRole.ADMIN, UserRole.AGENT, UserRole.AGENT_OPERATIONAL_SUPPORT, UserRole.AGENT_ORACLE, UserRole.AGENT_WEB_DEV, UserRole.AGENT_MOBILE_DEV)
    @ApiOperation({ summary: 'Forward a ticket to the other handling team (ops <-> oracle)' })
    @ApiResponse({ status: 201, description: 'Ticket forwarded' })
    async forwardTicket(
        @Param('id') id: string,
        @Body() dto: ForwardTicketDto,
        @Request() req: any,
    ) {
        return this.ticketForwardService.forwardTicket(id, dto, {
            userId: req.user.userId,
            fullName: req.user.fullName || req.user.username,
        });
    }

    @Post(':id/reminders')
    @Roles(UserRole.ADMIN, UserRole.AGENT, UserRole.AGENT_OPERATIONAL_SUPPORT, UserRole.AGENT_ORACLE, UserRole.AGENT_WEB_DEV, UserRole.AGENT_MOBILE_DEV)
    @ApiOperation({ summary: 'Create a scheduled email reminder for this ticket' })
    @ApiResponse({ status: 201, description: 'Reminder created successfully' })
    async createReminder(
        @Param('id') id: string,
        @Body() dto: CreateTicketReminderDto,
        @Request() req: any,
    ) {
        return this.ticketReminderService.createReminder(id, dto, {
            userId: req.user.userId,
            fullName: req.user.fullName || req.user.username,
        });
    }

    @Get(':id/reminders')
    @Roles(UserRole.ADMIN, UserRole.AGENT, UserRole.AGENT_OPERATIONAL_SUPPORT, UserRole.AGENT_ORACLE, UserRole.AGENT_WEB_DEV, UserRole.AGENT_MOBILE_DEV)
    @ApiOperation({ summary: 'Get all scheduled reminders for this ticket' })
    @ApiResponse({ status: 200, description: 'Return all reminders for ticket' })
    async getReminders(@Param('id') id: string) {
        return this.ticketReminderService.getReminders(id);
    }

    @Delete(':id/reminders/:reminderId')
    @Roles(UserRole.ADMIN, UserRole.AGENT, UserRole.AGENT_OPERATIONAL_SUPPORT, UserRole.AGENT_ORACLE, UserRole.AGENT_WEB_DEV, UserRole.AGENT_MOBILE_DEV)
    @ApiOperation({ summary: 'Cancel/delete an unsent reminder for this ticket' })
    @ApiResponse({ status: 200, description: 'Reminder cancelled successfully' })
    async deleteReminder(
        @Param('id') id: string,
        @Param('reminderId') reminderId: string,
        @Request() req: any,
    ) {
        return this.ticketReminderService.deleteReminder(id, reminderId, {
            userId: req.user.userId,
            fullName: req.user.fullName || req.user.username,
            role: req.user.role,
        });
    }

    @Patch('bulk/update')
    @Roles(UserRole.ADMIN, UserRole.AGENT, UserRole.AGENT_OPERATIONAL_SUPPORT, UserRole.AGENT_ORACLE, UserRole.AGENT_WEB_DEV, UserRole.AGENT_MOBILE_DEV)
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
                reason: dto.reason,
            },
            req.user.userId,
        );
    }

    @Patch('bulk/assign')
    @Roles(UserRole.ADMIN, UserRole.AGENT, UserRole.AGENT_OPERATIONAL_SUPPORT, UserRole.AGENT_ORACLE, UserRole.AGENT_WEB_DEV, UserRole.AGENT_MOBILE_DEV)
    @ApiOperation({ summary: 'Bulk assign multiple tickets to one assignee (per-team authorization inherited)' })
    @ApiResponse({ status: 200, description: 'Tickets assigned successfully.' })
    async bulkAssign(
        @Body() dto: BulkAssignTicketsDto,
        @Request() req: any,
    ): Promise<{ updated: number; failed: string[] }> {
        return this.ticketUpdateService.bulkAssign(
            dto.ticketIds,
            dto.assigneeId,
            req.user.userId,
            dto.reason,
        );
    }

    @Delete('bulk')
    @Roles(UserRole.ADMIN)
    @ApiOperation({ summary: 'Soft-delete multiple tickets (ADMIN only)' })
    @ApiResponse({ status: 200, description: 'Tickets deleted successfully.' })
    @ApiResponse({ status: 403, description: 'Forbidden — ADMIN role required.' })
    async bulkDelete(
        @Body() dto: BulkDeleteTicketsDto,
        @Request() req: any,
    ): Promise<{ deleted: number; failed: string[] }> {
        return this.ticketUpdateService.bulkSoftDelete(dto.ticketIds, req.user.userId);
    }

    @Post('merge')
    @Roles(UserRole.ADMIN, UserRole.AGENT, UserRole.AGENT_OPERATIONAL_SUPPORT, UserRole.AGENT_ORACLE, UserRole.AGENT_WEB_DEV, UserRole.AGENT_MOBILE_DEV)
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
