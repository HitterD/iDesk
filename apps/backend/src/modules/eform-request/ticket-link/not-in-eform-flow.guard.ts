import { CanActivate, ConflictException, ExecutionContext, Injectable } from '@nestjs/common';
import { EFormFlowMembership } from './eform-flow-membership.service';

/**
 * An e-form that lives on a request ticket is moved only by the ticket's request flow (signatures, document, ticket in
 * step). The old per-request endpoints would change its status behind the flow's back, so they refuse it.
 */
@Injectable()
export class NotInEformFlowGuard implements CanActivate {
    constructor(private readonly flows: EFormFlowMembership) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const id: string | undefined = context.switchToHttp().getRequest().params?.id;
        if (!id) return true;
        if (await this.flows.has(id)) throw new ConflictException('Pengajuan ini diproses lewat tiketnya.');
        return true;
    }
}
