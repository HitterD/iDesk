import {
    Body, Controller, Get, HttpCode, Param, ParseIntPipe, ParseUUIDPipe, Post, Query, Request, Res, UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../../auth/infrastructure/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../auth/application/auth-user.types';
import { Roles } from '../../../shared/core/decorators/roles.decorator';
import { RolesGuard } from '../../../shared/core/guards/roles.guard';
import { createStorage, FILE_SIZE_LIMITS } from '../../../shared/core/config/upload.config';
import { ICT_ROLES } from '../../eform-request/eform-roles.constants';
import { UserRole } from '../../users/enums/user-role.enum';
import { ApproveDto } from '../dto/approve.dto';
import { CreateEformTicketDto } from '../dto/create-eform-ticket.dto';
import { CreateHardwareTicketDto } from '../dto/create-hardware-ticket.dto';
import { PaperSignDto } from '../dto/paper-sign.dto';
import { ReviewDto } from '../dto/review.dto';
import { RequestDocumentService } from '../services/request-document.service';
import { FlowActor, REQUEST_SCANS_DIR, RequestFlowReviewService } from '../services/request-flow-review.service';
import { CreatedRequestTicket, RequestFlowService } from '../services/request-flow.service';

/** Every signed-in role may file a request; the site comes from the token, never the body. */
const REQUESTER_ROLES = Object.values(UserRole);

const SCAN_UPLOAD = {
    storage: createStorage(`./uploads/${REQUEST_SCANS_DIR}`),
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

    @Post(':ticketId/review')
    @HttpCode(200)
    @Roles(...ICT_ROLES)
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
    @Roles(...ICT_ROLES)
    @ApiOperation({ summary: 'IT reminds the current approver (once per hour)' })
    remind(@Request() req: { user: AuthenticatedUser }, @Param('ticketId', ParseUUIDPipe) ticketId: string) {
        return this.reviews.remind(actorOf(req), ticketId);
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
    @Roles(...ICT_ROLES)
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
