import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationService } from '../../notifications/notification.service';
import { NotificationCenterService } from '../../notifications/notification-center.service';
import { NotificationType } from '../../notifications/entities/notification.entity';
import { UserRole } from '../../users/enums/user-role.enum';
import { HardwareRequestQueryService } from '../services/hardware-request-query.service';
import {
    HR_EVT, HrSubmitted, HrApproved, HrRejected, HrCancelled,
    HrProcurementDone, HrScheduleProposed, HrScheduleConfirmed, HrScheduleRescheduled,
    HrInstallStarted, HrInstallCompleted, HrCommented,
    HardwareEvents, ScheduleProposedPayload, ScheduleConfirmedPayload, ScheduleRescheduleRequestedPayload,
} from '../domain/events/hardware-request.events';

const link = (id: string) => `/hardware-requests/${id}`;

/** Staff who carry out hardware work (procurement, installation). AGENT_ORACLE cannot open hardware pages. */
const HW_OPERATORS = [UserRole.AGENT, UserRole.AGENT_OPERATIONAL_SUPPORT, UserRole.AGENT_ADMIN];
/** A new request is reviewed and approved by operators or a manager. */
const HW_REVIEWERS = [...HW_OPERATORS, UserRole.MANAGER];
const others = (ids: Array<string | null | undefined>, actorId?: string | null): string[] =>
    [...new Set(ids.filter((id): id is string => Boolean(id) && id !== actorId))];

@Injectable()
export class InAppNotifierListener {
    constructor(
        private readonly notif: NotificationService,
        private readonly notificationCenterService: NotificationCenterService,
        private readonly q: HardwareRequestQueryService,
    ) {}

    private async push(userId: string, payload: {
        title: string;
        message: string;
        type: NotificationType;
        link: string;
        referenceId?: string;
        requiresAcknowledge?: boolean;
    }) {
        await this.notif.create({ userId, ...payload });
    }

    /** Active staff in `roles` at the request's site plus cross-site staff; nobody when it has no site. */
    private async staffFor(r: { siteId?: string | null } | null | undefined, roles: string[], exclude: Array<string | null | undefined>): Promise<string[]> {
        const users = await this.notificationCenterService.findStaffAtSite(roles, r?.siteId ?? null);
        const skip = new Set(exclude.filter(Boolean));
        return users.map(u => u.id).filter(id => !skip.has(id));
    }

    @OnEvent(HR_EVT.SUBMITTED)
    async onSubmitted(e: HrSubmitted) {
        const r = await this.q.findById(e.requestId);
        if (!r) return;
        const reviewers = await this.staffFor(r as any, HW_REVIEWERS, [e.actorId, e.requesterId]);
        await Promise.all(reviewers.map(id => this.push(id, {
            title: 'Permintaan hardware baru',
            message: `${r.requestNumber} menunggu review`,
            type: NotificationType.HARDWARE_REQUEST_SUBMITTED,
            link: link(r.id),
            referenceId: `${r.id}_submitted`,
        })));
    }

    @OnEvent(HR_EVT.APPROVED)
    async onApproved(e: HrApproved) {
        const r = await this.q.findById(e.requestId);
        if (!r) return;
        const procs = await this.staffFor(r as any, HW_OPERATORS, [e.actorId, e.requesterId]);
        await this.push(e.requesterId, {
            title: 'Request disetujui',
            message: `${r.requestNumber} approved, menunggu procurement`,
            type: NotificationType.HARDWARE_REQUEST_APPROVED,
            link: link(r.id),
            referenceId: `${r.id}_approved`,
        });
        await Promise.all(procs.map(id => this.push(id, {
            title: 'Procurement baru',
            message: `${r.requestNumber} siap diproses`,
            type: NotificationType.HARDWARE_REQUEST_APPROVED_PROC,
            link: link(r.id),
            referenceId: `${r.id}_approved_proc`,
        })));
        this.notificationCenterService.emitActionItemsRefresh(e.requesterId, 'HARDWARE_REQUEST', e.requestId);
    }

    @OnEvent(HR_EVT.REJECTED)
    async onRejected(e: HrRejected) {
        const r = await this.q.findById(e.requestId);
        if (!r) return;
        await this.push(e.requesterId, {
            title: 'Request ditolak',
            message: `${r.requestNumber}: ${e.reason.slice(0, 200)}`,
            type: NotificationType.HARDWARE_REQUEST_REJECTED,
            link: link(r.id),
            referenceId: `${r.id}_rejected`,
            requiresAcknowledge: true,
        });
        this.notificationCenterService.emitActionItemsRefresh(e.requesterId, 'HARDWARE_REQUEST', e.requestId);
    }

    @OnEvent(HR_EVT.CANCELLED)
    async onCancelled(e: HrCancelled) {
        if (e.fromStatus !== 'UNDER_REVIEW') return;
        // Load request to get siteId for scoping
        const r = await this.q.findById(e.requestId);
        // Still under review: the reviewers had it in their queue.
        const reviewers = await this.staffFor(r as any, HW_REVIEWERS, [e.actorId, e.requesterId]);
        await Promise.all(reviewers.map(id => this.push(id, {
            title: 'Request dibatalkan oleh user',
            message: `Request ${e.requestId.slice(0, 8)} dicancel`,
            type: NotificationType.HARDWARE_REQUEST_CANCELLED,
            link: link(e.requestId),
            referenceId: `${e.requestId}_cancelled`,
        })));
    }

    @OnEvent(HR_EVT.PROCUREMENT_DONE)
    async onProcurementDone(e: HrProcurementDone) {
        const r = await this.q.findById(e.requestId);
        if (!r) return;
        const techs = await this.staffFor(r as any, HW_OPERATORS, [e.actorId, e.requesterId]);
        await this.push(e.requesterId, {
            title: 'Procurement selesai',
            message: `${r.requestNumber} siap jadwal instalasi`,
            type: NotificationType.HARDWARE_REQUEST_PROC_DONE,
            link: link(r.id),
            referenceId: `${r.id}_proc_done`,
        });
        await Promise.all(techs.map(id => this.push(id, {
            title: 'Siap dijadwalkan',
            message: `${r.requestNumber} menunggu instalasi`,
            type: NotificationType.HARDWARE_REQUEST_PROC_DONE_TECH,
            link: link(r.id),
            referenceId: `${r.id}_proc_done_tech`,
        })));
    }

    @OnEvent(HR_EVT.SCHEDULE_PROPOSED)
    async onScheduleProposed(e: HrScheduleProposed) {
        const target = e.proposerId === e.technicianId ? e.requesterId : e.technicianId;
        await this.push(target, {
            title: 'Jadwal instalasi diusulkan',
            message: 'Mohon konfirmasi waktu',
            type: NotificationType.HARDWARE_REQUEST_SCHEDULE_PROPOSED,
            link: link(e.requestId),
            referenceId: `${e.requestId}_sched_${e.scheduleId}_proposed`,
            requiresAcknowledge: true,
        });
    }

    @OnEvent(HR_EVT.SCHEDULE_CONFIRMED)
    async onScheduleConfirmed(e: HrScheduleConfirmed) {
        // The one who confirmed knows already.
        await Promise.all(others([e.requesterId, e.technicianId], e.confirmedBy ?? e.actorId).map(u => this.push(u, {
            title: 'Jadwal instalasi terkonfirmasi',
            message: 'Siap dilaksanakan',
            type: NotificationType.HARDWARE_REQUEST_SCHEDULE_CONFIRMED,
            link: link(e.requestId),
            referenceId: `${e.requestId}_sched_${e.scheduleId}_confirmed`,
        })));
    }

    @OnEvent(HR_EVT.SCHEDULE_RESCHEDULED)
    async onScheduleRescheduled(e: HrScheduleRescheduled) {
        await Promise.all(others([e.requesterId, e.technicianId], e.actorId).map(u => this.push(u, {
            title: 'Jadwal instalasi diubah',
            message: e.reason ?? 'Mohon cek ulang jadwal',
            type: NotificationType.HARDWARE_REQUEST_SCHEDULE_RESCHEDULED,
            link: link(e.requestId),
            referenceId: `${e.requestId}_sched_${e.newId}_rescheduled`,
            requiresAcknowledge: true,
        })));
    }

    // Mutual-scheduling (v2) emits its own event names; without these handlers slot
    // proposals and reschedule requests reached nobody.
    @OnEvent(HardwareEvents.ScheduleProposed)
    async onSlotsProposed(e: ScheduleProposedPayload) {
        await this.push(e.ownerId, {
            title: 'Pilih jadwal pemasangan',
            message: 'Tim ICT mengusulkan slot waktu pemasangan. Mohon pilih yang sesuai.',
            type: NotificationType.HARDWARE_REQUEST_SCHEDULE_PROPOSED,
            link: link(e.requestId),
            referenceId: `${e.requestId}_sched_${e.scheduleId}_proposed`,
            requiresAcknowledge: true,
        });
    }

    @OnEvent(HardwareEvents.ScheduleConfirmed)
    async onSlotConfirmed(e: ScheduleConfirmedPayload) {
        const r = await this.q.findById(e.requestId);
        // Whoever picked the slot (usually the owner) knows already.
        await Promise.all(others([r?.requesterId, e.technicianId], e.actorId ?? r?.requesterId).map(u => this.push(u, {
            title: 'Jadwal instalasi terkonfirmasi',
            message: 'Siap dilaksanakan',
            type: NotificationType.HARDWARE_REQUEST_SCHEDULE_CONFIRMED,
            link: link(e.requestId),
            referenceId: `${e.requestId}_sched_${e.scheduleId}_confirmed`,
        })));
    }

    @OnEvent(HardwareEvents.ScheduleRescheduleRequested)
    async onRescheduleRequested(e: ScheduleRescheduleRequestedPayload) {
        await this.push(e.technicianId, {
            title: 'User minta jadwal ulang',
            message: e.reason ? `Alasan: ${e.reason}` : 'Mohon usulkan jadwal baru',
            type: NotificationType.HARDWARE_REQUEST_SCHEDULE_RESCHEDULED,
            link: link(e.requestId),
            referenceId: `${e.requestId}_sched_${e.scheduleId}_reschedule_${e.rescheduleCount}`,
            requiresAcknowledge: true,
        });
    }

    @OnEvent(HR_EVT.INSTALL_STARTED)
    async onInstallStarted(e: HrInstallStarted) {
        await this.push(e.requesterId, {
            title: 'Instalasi dimulai',
            message: 'Teknisi sedang memasang hardware Anda',
            type: NotificationType.HARDWARE_REQUEST_INSTALL_STARTED,
            link: link(e.requestId),
            referenceId: `${e.requestId}_install_started`,
        });
    }

    @OnEvent(HR_EVT.INSTALL_COMPLETED)
    async onInstallCompleted(e: HrInstallCompleted) {
        const r = await this.q.findById(e.requestId);
        if (!r) return;

        // When technician marks installation done, status is AWAITING_USER_CONFIRMATION
        if ((r.status as string) === 'AWAITING_USER_CONFIRMATION') {
            await this.push(e.requesterId, {
                title: 'Instalasi selesai',
                message: `${r.requestNumber} menunggu konfirmasi penerimaan Anda`,
                type: NotificationType.HARDWARE_REQUEST_COMPLETED,
                link: link(r.id),
                referenceId: `${r.id}_awaiting_confirmation`,
                requiresAcknowledge: true,
            });
            this.notificationCenterService.emitActionItemsRefresh(e.requesterId, 'HARDWARE_REQUEST', e.requestId);
            return;
        }

        // When request is completed (COMPLETED, or default in mock tests): the requester, and the approver
        // who owns the request on the ICT side - not every ICT account.
        const leads = others([(r as any).approvedById], e.actorId).filter(id => id !== e.requesterId);

        await this.push(e.requesterId, {
            title: 'Request selesai',
            message: `${r.requestNumber} completed`,
            type: NotificationType.HARDWARE_REQUEST_COMPLETED,
            link: link(r.id),
            referenceId: `${r.id}_completed`,
        });
        await Promise.all(leads.map(id => this.push(id, {
            title: 'Request selesai',
            message: r.requestNumber,
            type: NotificationType.HARDWARE_REQUEST_COMPLETED_LEAD,
            link: link(r.id),
            referenceId: `${r.id}_completed`,
        })));
        this.notificationCenterService.emitActionItemsRefresh(e.requesterId, 'HARDWARE_REQUEST', e.requestId);
    }

    @OnEvent(HR_EVT.COMMENTED)
    async onCommented(e: HrCommented) {
        const targets = e.subscribers.filter(u => u !== e.actorId);
        await Promise.all(targets.map(u => this.push(u, {
            title: 'Komentar baru',
            message: e.body.slice(0, 140),
            type: NotificationType.HARDWARE_REQUEST_COMMENTED,
            link: link(e.requestId),
            referenceId: `${e.requestId}_comment_${e.commentId}`,
        })));
    }
}
