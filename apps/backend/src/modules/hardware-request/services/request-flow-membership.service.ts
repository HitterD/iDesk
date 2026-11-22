import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

/**
 * Whether a hardware request lives on a unified request-flow ticket (a `request_flows` row points at it). Those
 * requests tell the ticket and the people concerned through the flow itself; the legacy listeners stay quiet for them.
 * A raw query keeps this module free of the request-flow module.
 */
@Injectable()
export class RequestFlowMembership {
    constructor(private readonly dataSource: DataSource) {}

    async has(requestId: string): Promise<boolean> {
        const rows: unknown[] = await this.dataSource.query('SELECT 1 FROM request_flows WHERE "hardwareRequestId" = $1 LIMIT 1', [requestId]);
        return rows.length > 0;
    }
}
