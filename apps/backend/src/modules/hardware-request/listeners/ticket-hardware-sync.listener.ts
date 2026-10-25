import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
    HR_EVT, HardwareEvents, HrApproved, HrCancelled, HrInstallCompleted, HrInstallIssueReported, HrRejected, HrScheduleConfirmed, HrScheduleProposed,
    HrScheduleRescheduled,
    HrSubmitted, ProcurementCompletedPayload, ScheduleConfirmedPayload, ScheduleProposedPayload, ScheduleRescheduleRequestedPayload,
} from '../domain/events/hardware-request.events';
import { HardwareRequest } from '../domain/entities/hardware-request.entity';
import { InstallationSchedule } from '../domain/entities/installation-schedule.entity';
import { RequestStatus } from '../domain/enums/request-status.enum';
import { TicketHardwareLinkService } from '../services/ticket-hardware-link.service';

type InstallCompletedEvent = HrInstallCompleted & { status?: RequestStatus };

/** Mirrors every step of a ticket-proposed hardware request onto its IT support ticket (see TicketHardwareLinkService). */
@Injectable()
export class TicketHardwareSyncListener {
    constructor(
        private readonly link: TicketHardwareLinkService,
        @InjectRepository(HardwareRequest) private readonly reqRepo: Repository<HardwareRequest>,
        @InjectRepository(InstallationSchedule) private readonly schedRepo: Repository<InstallationSchedule>,
    ) {}

    @OnEvent(HR_EVT.SUBMITTED)
    onSubmitted(e: HrSubmitted) {
        return this.link.record(e.requestId, 'SUBMITTED', { actorId: e.actorId });
    }

    @OnEvent(HR_EVT.APPROVED)
    onApproved(e: HrApproved) {
        return this.link.record(e.requestId, 'APPROVED', { actorId: e.actorId });
    }

    @OnEvent(HR_EVT.REJECTED)
    onRejected(e: HrRejected) {
        return this.link.record(e.requestId, 'REJECTED', { actorId: e.actorId, reason: e.reason });
    }

    @OnEvent(HR_EVT.CANCELLED)
    async onCancelled(e: HrCancelled) {
        if (e.fromStatus !== RequestStatus.DRAFT) {
            return this.link.record(e.requestId, 'CANCELLED', { actorId: e.actorId });
        }
        // A cancelled draft is an unanswered proposal: the requester declined it, or ICT took it back.
        const request = await this.reqRepo.findOne({ where: { id: e.requestId }, select: { id: true, requesterId: true } });
        const phase = request && e.actorId === request.requesterId ? 'DECLINED' : 'WITHDRAWN';
        return this.link.record(e.requestId, phase, { actorId: e.actorId });
    }

    @OnEvent(HardwareEvents.ProcurementCompleted)
    async onProcurementDone(e: ProcurementCompletedPayload) {
        if (e.approvedItems > 0) return this.link.record(e.requestId, 'PROCUREMENT_DONE');
        // Nothing was approved: procurement ends the request as REJECTED without the regular rejection event, so the
        // ticket would otherwise keep waiting on a request that is already over.
        const request = await this.reqRepo.findOne({ where: { id: e.requestId }, select: { id: true, rejectReason: true } });
        return this.link.record(e.requestId, 'REJECTED', { reason: request?.rejectReason ?? null });
    }

    /** The requester asked for another time: ICT has to propose a new one. */
    @OnEvent(HardwareEvents.ScheduleRescheduleRequested)
    async onRescheduleRequested(e: ScheduleRescheduleRequestedPayload) {
        const request = await this.reqRepo.findOne({ where: { id: e.requestId }, select: { id: true, requesterId: true } });
        return this.link.record(e.requestId, 'RESCHEDULE_REQUESTED', { actorId: request?.requesterId ?? null, reason: e.reason || null });
    }

    @OnEvent(HR_EVT.SCHEDULE_PROPOSED)
    onScheduleProposed(e: HrScheduleProposed) {
        return this.link.record(e.requestId, 'SCHEDULE_PROPOSED', { actorId: e.proposerId });
    }

    @OnEvent(HardwareEvents.ScheduleProposed)
    onSlotsProposed(e: ScheduleProposedPayload) {
        return this.link.record(e.requestId, 'SCHEDULE_PROPOSED', { actorId: e.technicianId });
    }

    /** A moved installation is a new proposal the other side has to confirm. */
    @OnEvent(HR_EVT.SCHEDULE_RESCHEDULED)
    async onRescheduled(e: HrScheduleRescheduled) {
        const schedule = await this.schedRepo.findOne({ where: { id: e.newId }, select: { id: true, scheduledStart: true } });
        return this.link.record(e.requestId, 'SCHEDULE_PROPOSED', { actorId: e.actorId, reason: e.reason ?? null, at: schedule?.scheduledStart ?? null });
    }

    @OnEvent(HR_EVT.SCHEDULE_CONFIRMED)
    async onScheduleConfirmed(e: HrScheduleConfirmed) {
        const schedule = await this.schedRepo.findOne({ where: { id: e.scheduleId }, select: { id: true, scheduledStart: true } });
        return this.link.record(e.requestId, 'SCHEDULED', { actorId: e.confirmedBy, at: schedule?.scheduledStart ?? null });
    }

    @OnEvent(HardwareEvents.ScheduleConfirmed)
    onSlotConfirmed(e: ScheduleConfirmedPayload) {
        return this.link.record(e.requestId, 'SCHEDULED', { at: e.scheduledStart });
    }

    @OnEvent(HR_EVT.INSTALL_ISSUE_REPORTED)
    onIssueReported(e: HrInstallIssueReported) {
        return this.link.record(e.requestId, 'ISSUE_REPORTED', { actorId: e.actorId, reason: e.comments });
    }

    @OnEvent(HR_EVT.INSTALL_COMPLETED)
    onInstallCompleted(e: InstallCompletedEvent) {
        // Fires when ICT marks the job done (requester still to confirm) and again once the request is COMPLETED.
        return this.link.record(e.requestId, e.status === RequestStatus.COMPLETED ? 'COMPLETED' : 'INSTALLED', { actorId: e.actorId });
    }
}
