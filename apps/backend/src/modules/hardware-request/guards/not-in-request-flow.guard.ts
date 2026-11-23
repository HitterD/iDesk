import { CanActivate, ConflictException, ExecutionContext, Injectable } from '@nestjs/common';
import { RequestFlowMembership } from '../services/request-flow-membership.service';

/**
 * A hardware request that lives on a request ticket is moved only by the ticket's request flow, which keeps the
 * signatures, the document and the ticket in step. The old per-request endpoints would change its status behind the
 * flow's back, so they refuse it. Routes without an `:id` are not affected.
 */
@Injectable()
export class NotInRequestFlowGuard implements CanActivate {
    constructor(private readonly flows: RequestFlowMembership) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const id: string | undefined = context.switchToHttp().getRequest().params?.id;
        if (!id) return true;
        if (await this.flows.has(id)) throw new ConflictException('Permintaan ini diproses lewat tiketnya.');
        return true;
    }
}
