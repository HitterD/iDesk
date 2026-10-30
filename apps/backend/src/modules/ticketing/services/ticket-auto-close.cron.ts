import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { TicketResolutionService } from './ticket-resolution.service';

/** Closes RESOLVED tickets whose requester did not confirm or dispute in time. */
@Injectable()
export class TicketAutoCloseCron {
    private readonly logger = new Logger(TicketAutoCloseCron.name);

    constructor(private readonly resolutionService: TicketResolutionService) { }

    @Cron('*/15 * * * *', { timeZone: 'Asia/Jakarta', name: 'ticket-resolution-auto-close' })
    async run(): Promise<void> {
        const { closed, failed } = await this.resolutionService.autoCloseExpired();
        if (closed > 0 || failed > 0) {
            this.logger.log(`auto-close scan: closed=${closed} failed=${failed}`);
        }
    }
}
