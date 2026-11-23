import {
    Body, Controller, Get, HttpCode, Param, ParseIntPipe, ParseUUIDPipe, Patch, Post, Put, Query, Request, Res, UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../../auth/infrastructure/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../auth/application/auth-user.types';
import { Roles } from '../../../shared/core/decorators/roles.decorator';
import { RolesGuard } from '../../../shared/core/guards/roles.guard';
import { createStorage, FILE_SIZE_LIMITS } from '../../../shared/core/config/upload.config';
import { UserRole } from '../../users/enums/user-role.enum';
import { REQUEST_PROCESSOR_ROLES } from '../domain/request-roles';
import { ApproveDto } from '../dto/approve.dto';
import { ArrivalsDto } from '../dto/arrivals.dto';
import { ConfirmDto } from '../dto/confirm.dto';
import { DocumentNumberDto } from '../dto/document-number.dto';
import { FulfillDto } from '../dto/fulfill.dto';
import { CreateEformTicketDto } from '../dto/create-eform-ticket.dto';
import { CreateHardwareTicketDto } from '../dto/create-hardware-ticket.dto';
import { EditItemsDto } from '../dto/edit-items.dto';
import { InstallDoneDto } from '../dto/install-done.dto';
import { PaperSignDto } from '../dto/paper-sign.dto';
import { ProcureDto } from '../dto/procure.dto';
import { RejectDto } from '../dto/reject.dto';
import { ReviewDto } from '../dto/review.dto';
import { ACCESS_GROUPS, type AccessGroup } from '../domain/access-groups';
import { DevicesAccessService } from '../services/devices-access.service';
import { RequestFlowQueryService, type RequestFlowView } from '../services/request-flow-query.service';
import { RequestDocumentService } from '../services/request-document.service';
import { RequestItemsService } from '../services/request-items.service';
import { RequestInstallFlowService } from '../services/request-install-flow.service';
import { RequestConfirmFlowService } from '../services/request-confirm-flow.service';
import { RequestDocumentNumberService } from '../services/request-document-number.service';
import { RequestFulfillFlowService } from '../services/request-fulfill-flow.service';
import { RequestProcurementFlowService } from '../services/request-procurement-flow.service';
import { FlowActor, REQUEST_SCANS_DIR, scanFileFilter, RequestFlowReviewService } from '../services/request-flow-review.service';
import { CreatedRequestTicket, RequestFlowService } from '../services/request-flow.service';

/** Every signed-in role may file a request; the site comes from the token, never the body. */
const REQUESTER_ROLES = Object.values(UserRole);

const SCAN_UPLOAD = {
    storage: createStorage(`./uploads/${REQUEST_SCANS_DIR}`),
    fileFilter: scanFileFilter,
    limits: { fileSize: FILE_SIZE_LIMITS.DOCUMENT },
};

const actorOf = (req: { user: AuthenticatedUser }): FlowActor => ({
    userId: req.user.userId, role: req.user.role, siteId: req.user.siteId ?? null, fullName: req.user.fullName,
});

@ApiTags('Request Flow')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('request-flow')
export class RequestFlowController {
    constructor(
        private readonly flows: RequestFlowService,
        private readonly reviews: RequestFlowReviewService,
        private readonly documents: RequestDocumentService,
        private readonly queries: RequestFlowQueryService,
        private readonly items: RequestItemsService,
        private readonly procurement: RequestProcurementFlowService,
        private readonly installs: RequestInstallFlowService,
        private readonly fulfilments: RequestFulfillFlowService,
        private readonly confirmations: RequestConfirmFlowService,
        private readonly numbers: RequestDocumentNumberService,
        private readonly center: DevicesAccessService,
    ) {}

    @Post('hardware')
    @Roles(...REQUESTER_ROLES)
    @ApiOperation({ summary: 'Create a Hardware Request ticket from the unified form' })
    createHardware(@Request() req: { user: AuthenticatedUser }, @Body() dto: CreateHardwareTicketDto): Promise<CreatedRequestTicket> {
        return this.flows.createHardware(req.user, dto);
    }

    @Post('eform')
    @Roles(...REQUESTER_ROLES)
    @ApiOperation({ summary: 'Create an E-Form Request ticket from the unified form' })
    createEform(@Request() req: { user: AuthenticatedUser }, @Body() dto: CreateEformTicketDto): Promise<CreatedRequestTicket> {
        return this.flows.createEform(req.user, dto);
    }

    // Every signed-in role passes the guard; the service decides (requester, the flow's approvers, IT and their site).
    // Static routes first: `:ticketId` would otherwise swallow them.
    // Every signed-in role passes the guard; only the approvers named on a flow get rows.
    @Get('approvals')
    @Roles(...REQUESTER_ROLES)
    @ApiOperation({ summary: 'Request tickets waiting for my signature' })
    approvals(@Request() req: { user: AuthenticatedUser }) {
        return this.center.approvals(actorOf(req));
    }

    // Every signed-in role: the service only ever returns the caller's own accesses.
    @Get('my-access')
    @Roles(...REQUESTER_ROLES)
    @ApiOperation({ summary: 'My active accesses (the "Akses aktif" cards): end date, days left, renewable' })
    myAccess(@Request() req: { user: AuthenticatedUser }) {
        return this.center.myAccess(actorOf(req));
    }

    @Get('center/schedule')
    @Roles(...REQUEST_PROCESSOR_ROLES)
    @ApiOperation({ summary: 'Installations of one week and the technician load (weekStart = YYYY-MM-DD)' })
    centerSchedule(@Request() req: { user: AuthenticatedUser }, @Query('weekStart') weekStart: string) {
        return this.center.schedule(actorOf(req), weekStart);
    }

    @Get('center/access')
    @Roles(...REQUEST_PROCESSOR_ROLES)
    @ApiOperation({ summary: 'Access validity: soon | expired | active | permanent' })
    centerAccess(@Request() req: { user: AuthenticatedUser }, @Query('group') group?: string) {
        const wanted: AccessGroup = ACCESS_GROUPS.includes(group as AccessGroup) ? (group as AccessGroup) : 'soon';
        return this.center.access(actorOf(req), wanted);
    }

    @Get('center/summary')
    @Roles(...REQUEST_PROCESSOR_ROLES)
    @ApiOperation({ summary: 'Hardware requests by position' })
    centerSummary(@Request() req: { user: AuthenticatedUser }) {
        return this.center.summary(actorOf(req));
    }

    @Post('center/access/:eformId/remind')
    @HttpCode(200)
    @Roles(...REQUEST_PROCESSOR_ROLES)
    @ApiOperation({ summary: 'Remind the requester that their access is about to end' })
    centerRemind(@Request() req: { user: AuthenticatedUser }, @Param('eformId', ParseUUIDPipe) eformId: string) {
        return this.center.remind(actorOf(req), eformId);
    }

    @Post('center/access/:eformId/revoke')
    @HttpCode(200)
    @Roles(...REQUEST_PROCESSOR_ROLES)
    @ApiOperation({ summary: 'File an IT Support ticket to revoke an expired access' })
    centerRevoke(@Request() req: { user: AuthenticatedUser }, @Param('eformId', ParseUUIDPipe) eformId: string) {
        return this.center.revoke(actorOf(req), eformId);
    }

    @Get(':ticketId')
    @Roles(...REQUESTER_ROLES)
    @ApiOperation({ summary: 'Where a request ticket stands: phase, route, revisions and the hardware / e-form summary' })
    view(@Request() req: { user: AuthenticatedUser }, @Param('ticketId', ParseUUIDPipe) ticketId: string): Promise<RequestFlowView> {
        return this.queries.view({ userId: req.user.userId, role: req.user.role, siteId: req.user.siteId ?? null }, ticketId);
    }

    @Post(':ticketId/review')
    @HttpCode(200)
    @Roles(...REQUEST_PROCESSOR_ROLES)
    @ApiOperation({ summary: 'IT picks the approval route (and hardware source) of a request in review' })
    review(@Request() req: { user: AuthenticatedUser }, @Param('ticketId', ParseUUIDPipe) ticketId: string, @Body() dto: ReviewDto) {
        return this.reviews.review(actorOf(req), ticketId, dto);
    }

    // No @Roles: only the approver the flow is waiting for may decide; the service checks.
    @Post(':ticketId/decision')
    @HttpCode(200)
    @Roles(...REQUESTER_ROLES)
    @ApiOperation({ summary: 'The current approver approves, returns to IT or rejects' })
    decide(@Request() req: { user: AuthenticatedUser }, @Param('ticketId', ParseUUIDPipe) ticketId: string, @Body() dto: ApproveDto) {
        return this.reviews.decide(actorOf(req), ticketId, dto);
    }

    @Post(':ticketId/remind')
    @HttpCode(200)
    @Roles(...REQUEST_PROCESSOR_ROLES)
    @ApiOperation({ summary: 'IT reminds the current approver (once per hour)' })
    remind(@Request() req: { user: AuthenticatedUser }, @Param('ticketId', ParseUUIDPipe) ticketId: string) {
        return this.reviews.remind(actorOf(req), ticketId);
    }

    @Post(':ticketId/reject')
    @HttpCode(200)
    @Roles(...REQUEST_PROCESSOR_ROLES)
    @ApiOperation({ summary: 'IT refuses a request that is still in review, with a reason' })
    rejectByIt(@Request() req: { user: AuthenticatedUser }, @Param('ticketId', ParseUUIDPipe) ticketId: string, @Body() dto: RejectDto) {
        return this.reviews.rejectByIt(actorOf(req), ticketId, dto.reason);
    }

    // Every signed-in role passes the guard; the service allows the requester (early phases) or IT of the site.
    @Post(':ticketId/cancel')
    @HttpCode(200)
    @Roles(...REQUESTER_ROLES)
    @ApiOperation({ summary: 'Withdraw a request: the requester while in review or approval, IT before the install' })
    cancel(@Request() req: { user: AuthenticatedUser }, @Param('ticketId', ParseUUIDPipe) ticketId: string) {
        return this.reviews.cancel(actorOf(req), ticketId);
    }

    @Put(':ticketId/items')
    @Roles(...REQUEST_PROCESSOR_ROLES)
    @ApiOperation({ summary: 'IT edits the items of a hardware request (swap, add, remove units) with a reason' })
    editItems(@Request() req: { user: AuthenticatedUser }, @Param('ticketId', ParseUUIDPipe) ticketId: string, @Body() dto: EditItemsDto) {
        return this.items.edit(actorOf(req), ticketId, dto);
    }

    @Post(':ticketId/procurement')
    @HttpCode(200)
    @Roles(...REQUEST_PROCESSOR_ROLES)
    @ApiOperation({ summary: 'IT records the purchase per item (vendor, cost, invoice) or drops items' })
    procure(@Request() req: { user: AuthenticatedUser }, @Param('ticketId', ParseUUIDPipe) ticketId: string, @Body() dto: ProcureDto) {
        return this.procurement.procure(actorOf(req), ticketId, dto);
    }

    @Post(':ticketId/arrivals')
    @HttpCode(200)
    @Roles(...REQUEST_PROCESSOR_ROLES)
    @ApiOperation({ summary: 'IT marks purchased items as arrived at the IT warehouse' })
    arrivals(@Request() req: { user: AuthenticatedUser }, @Param('ticketId', ParseUUIDPipe) ticketId: string, @Body() dto: ArrivalsDto) {
        return this.procurement.arrive(actorOf(req), ticketId, dto);
    }

    @Post(':ticketId/install-done')
    @HttpCode(200)
    @Roles(...REQUEST_PROCESSOR_ROLES)
    @ApiOperation({ summary: 'IT reports the installation: one asset code per unit and the technician signature' })
    installDone(@Request() req: { user: AuthenticatedUser }, @Param('ticketId', ParseUUIDPipe) ticketId: string, @Body() dto: InstallDoneDto) {
        return this.installs.installDone(actorOf(req), ticketId, dto);
    }

    @Post(':ticketId/fulfill')
    @HttpCode(200)
    @Roles(...REQUEST_PROCESSOR_ROLES)
    @ApiOperation({ summary: 'IT gives the requested e-form access, with or without credentials, and signs' })
    fulfill(@Request() req: { user: AuthenticatedUser }, @Param('ticketId', ParseUUIDPipe) ticketId: string, @Body() dto: FulfillDto) {
        return this.fulfilments.fulfill(actorOf(req), ticketId, dto);
    }

    // Every signed-in role passes the guard; the service allows the requester, or IT of the site on their behalf.
    @Post(':ticketId/confirm')
    @HttpCode(200)
    @Roles(...REQUESTER_ROLES)
    @ApiOperation({ summary: 'The requester (or IT on their behalf) confirms the work, or reports an issue' })
    confirm(@Request() req: { user: AuthenticatedUser }, @Param('ticketId', ParseUUIDPipe) ticketId: string, @Body() dto: ConfirmDto) {
        return this.confirmations.confirm(actorOf(req), ticketId, dto);
    }

    // Every signed-in role passes the guard; the service allows only the requester and ICT of the site.
    @Get(':ticketId/credentials')
    @Roles(...REQUESTER_ROLES)
    @ApiOperation({ summary: 'The decrypted credentials of an e-form (requester or ICT); every read is audited' })
    credentials(@Request() req: { user: AuthenticatedUser }, @Param('ticketId', ParseUUIDPipe) ticketId: string) {
        return this.fulfilments.credentials(actorOf(req), ticketId);
    }

    @Patch(':ticketId/document-number')
    @Roles(...REQUEST_PROCESSOR_ROLES)
    @ApiOperation({ summary: 'IT edits the document number (e-form number or hardware request number)' })
    documentNumber(@Request() req: { user: AuthenticatedUser }, @Param('ticketId', ParseUUIDPipe) ticketId: string, @Body() dto: DocumentNumberDto) {
        return this.numbers.update(actorOf(req), ticketId, dto.value);
    }

    @Get(':ticketId/document.pdf')
    @Roles(...REQUESTER_ROLES)
    @ApiOperation({ summary: 'The request document (latest version, or ?v=N) with its QR' })
    async document(
        @Request() req: { user: AuthenticatedUser },
        @Param('ticketId', ParseUUIDPipe) ticketId: string,
        @Res() res: Response,
        @Query('v', new ParseIntPipe({ optional: true })) version?: number,
    ) {
        const viewer = { userId: req.user.userId, role: req.user.role, siteId: req.user.siteId ?? null };
        const { buffer, fileName } = await this.documents.renderPdf(viewer, ticketId, version);
        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${fileName.replace(/[^\w.-]/g, '_')}"`,
            'Content-Length': buffer.length.toString(),
            'Cache-Control': 'private, no-cache',
        });
        res.end(buffer);
    }

    @Post(':ticketId/paper-sign')
    @HttpCode(200)
    @Roles(...REQUEST_PROCESSOR_ROLES)
    @ApiConsumes('multipart/form-data')
    @ApiOperation({ summary: 'IT imports the scanned paper signature of the active step' })
    @UseInterceptors(FileInterceptor('file', SCAN_UPLOAD))
    // No ParseUUIDPipe: pipes run after multer stored the file; the service removes the file whenever it refuses.
    paperSign(
        @Request() req: { user: AuthenticatedUser },
        @Param('ticketId') ticketId: string,
        @UploadedFile() file: Express.Multer.File | undefined,
        @Body() dto: PaperSignDto,
    ) {
        return this.reviews.paperSign(actorOf(req), ticketId, file, dto.qr);
    }
}
