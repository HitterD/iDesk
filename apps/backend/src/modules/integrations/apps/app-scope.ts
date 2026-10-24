import { TicketSource } from '../../ticketing/entities/ticket.entity';
import type { PartnerScope } from '../ipop/ipop-ticket.service';
import type { IntegrationApp } from './entities/integration-app.entity';
import { appSource } from './integration-app.constants';

/** What an app may touch: only the tickets it filed, only in the modules the admin allowed. */
export function scopeOf(app: Pick<IntegrationApp, 'clientId' | 'modules'>): PartnerScope {
    return { source: appSource(app.clientId), ticketSource: TicketSource.API, modules: app.modules, ownTicketsOnly: true };
}
