import { Body, Controller, Post, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/infrastructure/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../auth/application/auth-user.types';
import { Roles } from '../../../shared/core/decorators/roles.decorator';
import { RolesGuard } from '../../../shared/core/guards/roles.guard';
import { UserRole } from '../../users/enums/user-role.enum';
import { CreateEformTicketDto } from '../dto/create-eform-ticket.dto';
import { CreateHardwareTicketDto } from '../dto/create-hardware-ticket.dto';
import { CreatedRequestTicket, RequestFlowService } from '../services/request-flow.service';

/** Every signed-in role may file a request; the site comes from the token, never the body. */
const REQUESTER_ROLES = Object.values(UserRole);

@ApiTags('Request Flow')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('request-flow')
export class RequestFlowController {
    constructor(private readonly flows: RequestFlowService) {}

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
}
