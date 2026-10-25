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
    ParseUUIDPipe,
    Optional,
    HttpCode,
    Headers,
    UnauthorizedException,
    NotFoundException,
    ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { timingSafeEqual } from 'crypto';
import { Repository } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Public } from '../../../shared/core/decorators/public.decorator';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TicketCreateService } from '../services/ticket-create.service';
import { TicketUpdateService } from '../services/ticket-update.service';
import { TicketVendorVisitService } from '../services/ticket-vendor-visit.service';
import { TicketMessagingService } from '../services/ticket-messaging.service';
import { TicketQueryService, QUEUE_KEYS, effectiveQueue } from '../services/ticket-query.service';
import { CreateTicketDto } from '../dto/create-ticket.dto';
import { PaginationDto, QueueStatsQueryDto } from '../dto/pagination.dto';
import { JwtAuthGuard } from '../../auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../../../shared/core/guards/roles.guard';
import { Roles } from '../../../shared/core/decorators/roles.decorator';
import { UserRole } from '../../users/enums/user-role.enum';
import { CacheInterceptor } from '@nestjs/cache-manager';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import {
    UpdateTicketStatusDto,
    UpdateVendorVisitDto,
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
import {
    AttachmentMultiInterceptor,
    assertValidAttachments,
    discardUploads,
    getRelativeUploadPath,
    toAttachmentInfo,
} from './interceptors/attachment-upload.interceptor';
import { AddParticipantsDto } from '../dto/ticket-participant.dto';
import { ExtendSlaDto } from '../dto/extend-sla.dto';
import { ForwardTicketDto } from '../dto/forward-ticket.dto';
import { CreateTicketReminderDto } from '../dto/ticket-reminder.dto';
import { TicketReminderService } from '../services/ticket-reminder.service';
import { TicketResolutionService } from '../services/ticket-resolution.service';
import { AgentRatingService } from '../services/agent-rating.service';
import { DisputeResolutionDto, SubmitAgentRatingsDto } from '../dto/ticket-resolution.dto';
import { TICKET_AGENT_ROLES } from '../ticket-roles.constants';

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
        private readonly ticketResolutionService: TicketResolutionService,
        private readonly agentRatingService: AgentRatingService,
        @InjectRepository(User) private readonly userRepo: Repository<User>,
        private readonly ticketVendorVisitService: TicketVendorVisitService,
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
        assertValidAttachments(files);
        const attachmentInfo = (files ?? []).map(toAttachmentInfo);
        let result: Awaited<ReturnType<TicketCreateService['createTicket']>>;
        try {
            result = await this.ticketCreateService.createTicket(
                req.user.userId,
                createTicketDto,
                attachmentInfo.map((a) => a.path),
                attachmentInfo,
            );
        } catch (error) {
            discardUploads(files);
            throw error;
        }

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
    @ApiQuery({ name: 'status', required: false, type: String, description: 'Comma-separated TicketStatus values' })
    @ApiQuery({ name: 'overdue', required: false, type: Boolean })
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

    // Staff only: the aggregate is site-wide, and recentTickets names other requesters.
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

    /** Status tab counts of one queue page, over the whole queue in the caller's scope. */
    @Get('queue-stats')
    @Roles(...TICKET_AGENT_ROLES)
    @ApiOperation({ summary: 'Get status counts of a ticket queue' })
    @ApiQuery({ name: 'queue', required: true, enum: QUEUE_KEYS })
    @ApiResponse({ status: 200, description: 'total, open, inProgress, waitingVendor, resolved, overdue, critical' })
    async getQueueStats(@Request() req: any, @Query() query: QueueStatsQueryDto) {
        const role = req.user.role as UserRole;
        if (query.queue !== 'it-support' && effectiveQueue(query.queue, role) === undefined) {
            throw new ForbiddenException('Developer queue not available for this role');
        }
        return this.ticketQueryService.getQueueStats(query.queue, req.user.userId, role, req.user.siteId ?? null, query);
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
    async findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
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

    // Same gate as GET :id: findOne enforces ticket access, and requesters only get PUBLIC articles.
    @Get(':id/kb-suggestions')
    @ApiOperation({ summary: 'Suggest most relevant KB articles for a ticket' })
    @ApiResponse({ status: 200, description: 'Top relevant articles (max 3)' })
    async getKbSuggestions(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
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
    async getMessages(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
        return this.ticketMessagingService.getMessages(id, req.user.role, req.user.siteId ?? null);
    }

    @Get(':id/messages/paginated')
    @ApiOperation({ summary: 'Get ticket messages with pagination (4.2.2)' })
    @ApiResponse({ status: 200, description: 'Return paginated ticket messages.' })
    @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
    @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 20)' })
    async getMessagesPaginated(
        @Param('id', ParseUUIDPipe) ticketId: string,
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
        @Param('id', ParseUUIDPipe) id: string,
        @Req() req: any,
        @Body('content') content: string,
        @Body('mentionedUserIds') mentionedUserIds: string | string[],
        @Body('isInternal') isInternal: string | boolean,
        @UploadedFiles() files: Express.Multer.File[],
    ) {
        assertValidAttachments(files);
        const attachmentInfo = (files ?? []).map(toAttachmentInfo);

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

        let result: Awaited<ReturnType<TicketMessagingService['replyToTicket']>>;
        try {
            result = await this.ticketMessagingService.replyToTicket(
                id,
                req.user.userId,
                content,
                attachmentInfo.map((a) => a.path),
                parsedMentionedUserIds,
                isInternalNote,
                attachmentInfo,
            );
        } catch (error) {
            // e.g. ticket closed meanwhile or no access: the files would never be referenced.
            discardUploads(files);
            throw error;
        }

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

    @Post(':id/s2s-reply')
    @Public()
    @HttpCode(200)
    @ApiOperation({ summary: 'S2S Quick Reply from SJA Notification Center' })
    async replyToTicketS2S(
        @Param('id', ParseUUIDPipe) id: string,
        @Headers('x-s2s-token') s2sToken: string,
        @Body() body: { employeeId?: string; nik?: string; userId?: string; content: string },
        @Req() req: any,
    ) {
        // Fail-closed: tanpa SJA_INTERNAL_SECRET yang diset di environment, endpoint
        // ini menolak semua request. Secret tidak boleh punya nilai default di kode —
        // nilai yang ikut ter-commit sama saja dengan tidak ada autentikasi.
        const expectedSecret = process.env.SJA_INTERNAL_SECRET;
        if (!expectedSecret) {
            throw new UnauthorizedException('S2S reply endpoint is not configured: SJA_INTERNAL_SECRET is unset');
        }

        const incomingSecret = s2sToken || req.headers?.['x-internal-secret'] || req.headers?.['x-s2s-token'];
        if (!incomingSecret || !this.isMatchingSecret(incomingSecret, expectedSecret)) {
            throw new UnauthorizedException('Unauthorized S2S request: Invalid or missing x-s2s-token header');
        }

        const identifier = body.employeeId || body.nik || body.userId;
        if (!identifier || !body.content?.trim()) {
            throw new BadRequestException('identifier (employeeId/nik/userId) dan content wajib diisi');
        }

        let user: User | null = null;
        if (identifier.includes('@')) {
            user = await this.userRepo.findOne({ where: { email: identifier.toLowerCase() } });
        } else {
            user = await this.userRepo.findOne({ where: { employeeId: identifier } });
            // Cegah syntax error PostgreSQL jika identifier bukan format UUID
            const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(identifier);
            if (!user && isUuid) {
                user = await this.userRepo.findOne({ where: { id: identifier } });
            }
        }

        if (!user || user.isActive === false) {
            throw new NotFoundException('User pemilik perangkat tidak ditemukan atau non-aktif di iDesk');
        }

        const result = await this.ticketMessagingService.replyToTicket(
            id,
            user.id,
            body.content.trim(),
            [],
            [],
            false,
        );

        return {
            success: true,
            message: result,
        };
    }

    /**
     * Membandingkan secret S2S dalam waktu konstan agar penyerang tidak bisa
     * menebak isinya karakter demi karakter lewat selisih waktu respons.
     * Memakai crypto bawaan Node, bukan implementasi sendiri.
     */
    private isMatchingSecret(incoming: unknown, expected: string): boolean {
        if (typeof incoming !== 'string') return false;

        const incomingBuf = Buffer.from(incoming, 'utf8');
        const expectedBuf = Buffer.from(expected, 'utf8');
        if (incomingBuf.length !== expectedBuf.length) return false;

        return timingSafeEqual(incomingBuf, expectedBuf);
    }

    @Get(':id/participants')
    @ApiOperation({ summary: 'Get participants of a ticket' })
    @ApiResponse({ status: 200, description: 'Return participants.' })
    async getParticipants(@Param('id', ParseUUIDPipe) id: string) {
        return this.ticketParticipantService.getParticipants(id);
    }

    @Post(':id/participants')
    @ApiOperation({ summary: 'Add participants to a ticket' })
    @ApiResponse({ status: 200, description: 'Participants added successfully.' })
    async addParticipants(
        @Param('id', ParseUUIDPipe) id: string,
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
        @Param('id', ParseUUIDPipe) id: string,
        @Param('userId') targetUserId: string,
        @Request() req: any,
    ) {
        const actorUserId = req.user.userId || req.user.id;
        const actorRole = req.user.role;
        return this.ticketParticipantService.removeParticipant(id, targetUserId, actorUserId, actorRole);
    }

    @Patch(':id/status')
    @Roles(...TICKET_AGENT_ROLES)
    @ApiOperation({ summary: 'Update ticket status' })
    @ApiResponse({ status: 200, description: 'Ticket status updated.' })
    async updateStatus(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateTicketStatusDto,
        @Request() req: any,
    ) {
        return this.ticketUpdateService.updateTicket(id, { status: dto.status, vendorVisitRequest: dto.vendorVisitAt }, req.user.userId, {
            takeover: dto.takeover,
            keepAssignee: dto.keepAssignee,
            reason: dto.reason,
        });
    }

    @Patch(':id/vendor-visit')
    @Roles(...TICKET_AGENT_ROLES)
    @ApiOperation({ summary: 'Reschedule the vendor appointment of a WAITING_VENDOR ticket' })
    @ApiResponse({ status: 200, description: 'Vendor appointment updated; the PIC reminder follows it.' })
    async updateVendorVisit(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateVendorVisitDto,
        @Request() req: any,
    ) {
        return this.ticketVendorVisitService.reschedule(id, dto.vendorVisitAt, req.user.userId);
    }

    @Patch(':id/priority')
    @Roles(...TICKET_AGENT_ROLES)
    @ApiOperation({ summary: 'Update ticket priority' })
    @ApiResponse({ status: 200, description: 'Ticket priority updated.' })
    async updatePriority(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateTicketPriorityDto,
        @Request() req: any,
    ) {
        return this.ticketUpdateService.updateTicket(id, { priority: dto.priority }, req.user.userId);
    }

    @Patch(':id/category')
    @Roles(...TICKET_AGENT_ROLES)
    @ApiOperation({ summary: 'Update ticket category' })
    @ApiResponse({ status: 200, description: 'Ticket category updated.' })
    async updateCategory(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateTicketCategoryDto,
        @Request() req: any,
    ) {
        return this.ticketUpdateService.updateTicket(id, { category: dto.category }, req.user.userId);
    }

    @Patch(':id/device')
    @Roles(...TICKET_AGENT_ROLES)
    @ApiOperation({ summary: 'Update ticket device' })
    @ApiResponse({ status: 200, description: 'Ticket device updated.' })
    async updateDevice(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateTicketDeviceDto,
        @Request() req: any,
    ) {
        return this.ticketUpdateService.updateTicket(id, { device: dto.device }, req.user.userId);
    }
    @Patch(':id/assign')
    @Roles(...TICKET_AGENT_ROLES)
    @ApiOperation({ summary: 'Assign ticket to an agent' })
    @ApiResponse({ status: 200, description: 'Ticket assigned successfully.' })
    async assignTicket(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: AssignTicketDto,
        @Request() req: any,
    ) {
        return this.ticketUpdateService.assignTicket(id, dto.assigneeId, req.user.userId, dto.reason);
    }

    @Patch(':id/cancel')
    @ApiOperation({ summary: 'Cancel a ticket' })
    @ApiResponse({ status: 200, description: 'Ticket cancelled successfully.' })
    async cancelTicket(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: CancelTicketDto,
        @Request() req: any,
    ) {
        return this.ticketUpdateService.cancelTicket(id, req.user.userId, req.user.role, dto.reason);
    }

    // Requester-only actions: ownership is enforced in the services, so no role list here.
    @Post(':id/confirm-resolution')
    @HttpCode(200)
    @ApiOperation({ summary: 'Requester confirms the resolution; the ticket is closed' })
    async confirmResolution(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
        return this.ticketResolutionService.confirmResolution(id, req.user.userId);
    }

    @Post(':id/dispute')
    @HttpCode(200)
    @ApiOperation({ summary: 'Requester disputes the resolution; the ticket goes back to the agent' })
    async disputeResolution(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: DisputeResolutionDto,
        @Request() req: any,
    ) {
        return this.ticketResolutionService.disputeResolution(id, req.user.userId, dto.reason);
    }

    @Post(':id/self-resolve')
    @HttpCode(200)
    @ApiOperation({ summary: 'Requester marks their own open ticket as solved; the ticket is closed' })
    async selfResolve(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
        return this.ticketResolutionService.selfResolve(id, req.user.userId);
    }

    @Get(':id/agent-ratings')
    @ApiOperation({ summary: 'Agents the requester can rate for this ticket' })
    async getAgentRatings(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
        return this.agentRatingService.getTicketRatings(id, req.user.userId);
    }

    @Post(':id/agent-ratings')
    @ApiOperation({ summary: 'Requester rates the agents who handled this ticket' })
    async submitAgentRatings(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: SubmitAgentRatingsDto,
        @Request() req: any,
    ) {
        return this.agentRatingService.submitRatings(id, req.user.userId, dto.ratings);
    }

    @Post(':id/sla/extend')
    @Roles(...TICKET_AGENT_ROLES)
    @ApiOperation({ summary: 'Extend the SLA target of a ticket, recording the reason' })
    @ApiResponse({ status: 201, description: 'SLA extended' })
    async extendSla(
        @Param('id', ParseUUIDPipe) id: string,
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
    @Roles(...TICKET_AGENT_ROLES)
    @ApiOperation({ summary: 'Forward a ticket to the other handling team (ops <-> oracle)' })
    @ApiResponse({ status: 201, description: 'Ticket forwarded' })
    async forwardTicket(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: ForwardTicketDto,
        @Request() req: any,
    ) {
        return this.ticketForwardService.forwardTicket(id, dto, {
            userId: req.user.userId,
            fullName: req.user.fullName || req.user.username,
        });
    }

    @Post(':id/reminders')
    @Roles(...TICKET_AGENT_ROLES)
    @ApiOperation({ summary: 'Create a scheduled email reminder for this ticket' })
    @ApiResponse({ status: 201, description: 'Reminder created successfully' })
    async createReminder(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: CreateTicketReminderDto,
        @Request() req: any,
    ) {
        return this.ticketReminderService.createReminder(id, dto, {
            userId: req.user.userId,
            fullName: req.user.fullName || req.user.username,
        });
    }

    @Get(':id/reminders')
    @Roles(...TICKET_AGENT_ROLES)
    @ApiOperation({ summary: 'Get all scheduled reminders for this ticket' })
    @ApiResponse({ status: 200, description: 'Return all reminders for ticket' })
    async getReminders(@Param('id', ParseUUIDPipe) id: string) {
        return this.ticketReminderService.getReminders(id);
    }

    @Delete(':id/reminders/:reminderId')
    @Roles(...TICKET_AGENT_ROLES)
    @ApiOperation({ summary: 'Cancel/delete an unsent reminder for this ticket' })
    @ApiResponse({ status: 200, description: 'Reminder cancelled successfully' })
    async deleteReminder(
        @Param('id', ParseUUIDPipe) id: string,
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
    @Roles(...TICKET_AGENT_ROLES)
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
                takeover: dto.takeover,
                keepAssignee: dto.keepAssignee,
            },
            req.user.userId,
        );
    }

    @Patch('bulk/assign')
    @Roles(...TICKET_AGENT_ROLES)
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
    @Roles(...TICKET_AGENT_ROLES)
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
