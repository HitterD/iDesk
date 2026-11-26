import { Injectable, Optional } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EFormRequest } from '../entities/eform-request.entity';
import { EFormFlowMembership } from './eform-flow-membership.service';
import { TicketEFormLinkService } from './ticket-eform-link.service';

interface EFormEvent { request: EFormRequest; userId?: string }

/** Mirrors every step of a ticket-proposed e-form request onto its IT support ticket (see TicketEFormLinkService). */
@Injectable()
export class TicketEFormSyncListener {
    constructor(
        private readonly link: TicketEFormLinkService,
        @Optional() private readonly flows?: EFormFlowMembership,
    ) {}

    /** A request-flow e-form posts its own single message per step; the legacy "granted, ticket closed" card must not follow it. */
    private async inFlow(request: EFormRequest): Promise<boolean> {
        return Boolean(await this.flows?.has(request.id));
    }

    @OnEvent('eform.submitted')
    onSubmitted({ request }: EFormEvent) {
        return this.link.record(request.id, 'SUBMITTED', { actorId: request.requesterId });
    }

    /** Synology access skips the manager: submitting it lands with ICT straight away. */
    @OnEvent('eform.direct-to-ict')
    onDirectToIct({ request }: EFormEvent) {
        return this.link.record(request.id, 'SUBMITTED', { actorId: request.requesterId });
    }

    @OnEvent('eform.manager-approved')
    onManagerApproved({ request }: EFormEvent) {
        return this.link.record(request.id, 'MANAGER_APPROVED');
    }

    /** IT uploaded the form the GM signed by hand. */
    @OnEvent('eform.gm-approved')
    onGmApproved({ request, userId }: EFormEvent) {
        return this.link.record(request.id, 'GM_APPROVED', { actorId: userId ?? null });
    }

    @OnEvent('eform.ict-confirmed')
    async onCredentialsIssued({ request }: EFormEvent) {
        if (await this.inFlow(request)) return;
        return this.link.record(request.id, 'GRANTED');
    }

    @OnEvent('eform.fulfilled')
    async onFulfilled({ request }: EFormEvent) {
        if (await this.inFlow(request)) return;
        return this.link.record(request.id, 'GRANTED');
    }

    @OnEvent('eform.rejected')
    async onRejected({ request, userId }: EFormEvent) {
        if (await this.inFlow(request)) return;
        return this.link.record(request.id, 'REJECTED', { actorId: userId ?? null, reason: request.rejectionReason || null });
    }
}
