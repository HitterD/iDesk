import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../../../shared/core/guards/roles.guard';
import { Roles } from '../../../shared/core/decorators/roles.decorator';
import { TICKET_AGENT_ROLES } from '../../ticketing/ticket-roles.constants';
import { IntegrationAppsService } from './integration-apps.service';

/** Name and badge colour of each connected app, for the source badge on ticket lists. No secrets, no config. */
@ApiTags('Connected apps')
@Controller('integration-apps')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...TICKET_AGENT_ROLES)
export class AppSourcesController {
    constructor(private readonly apps: IntegrationAppsService) {}

    @Get('sources')
    sources() {
        return this.apps.listSources();
    }
}
