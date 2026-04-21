import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationService } from '../../notifications/notification.service';
import { NotificationType } from '../../notifications/entities/notification.entity';
import { PermissionsService } from '../../permissions/permissions.service';
import { HardwareRequestQueryService } from '../services/hardware-request-query.service';
import {
    HR_EVT, HrSubmitted, HrApproved, HrRejected, HrCancelled,
    HrProcurementDone, HrScheduleProposed, HrScheduleConfirmed, HrScheduleRescheduled,
    HrInstallStarted, HrInstallCompleted, HrCommented,
} from '../domain/events/hardware-request.events';

const link = (id: string) => `/hardware-requests/${id}`;

@Injectable()
export class InAppNotifierListener {
    constructor(
        private readonly notif: NotificationService,
        private readonly perm: PermissionsService,
        private readonly q: HardwareRequestQueryService,
    ) {}

    private async push(userId: string, payload: { title: string; message: string; type: NotificationType; link: string; requiresAcknowledge?: boolean }) {
        await this.notif.create({ userId, ...payload });
    }

    @OnEvent(HR_EVT.SUBMITTED)
    async onSubmitted(e: HrSubmitted) {
        const r = await this.q.findById(e.requestId);
        if (!r) return;
        const leads = await this.perm.listUsersWithRole('ICT_STAFF');
        await Promise.all(leads.map(l => this.push(l.id, {
            title: 'Permintaan hardware baru',
            message: `${r.requestNumber} menunggu review`,
            type: NotificationType.HARDWARE_REQUEST_SUBMITTED,
            link: link(r.id),
        })));
    }

    @OnEvent(HR_EVT.APPROVED)
    async onApproved(e: HrApproved) {
        const r = await this.q.findById(e.requestId);
        if (!r) return;
        const procs = await this.perm.listUsersWithRole('ICT_STAFF');
        await this.push(e.requesterId, {
            title: 'Request disetujui',
            message: `${r.requestNumber} approved, menunggu procurement`,
            type: NotificationType.HARDWARE_REQUEST_APPROVED,
            link: link(r.id),
        });
        await Promise.all(procs.map(p => this.push(p.id, {
            title: 'Procurement baru',
            message: `${r.requestNumber} siap diproses`,
            type: NotificationType.HARDWARE_REQUEST_APPROVED_PROC,
            link: link(r.id),
        })));
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
            requiresAcknowledge: true,
        });
    }

    @OnEvent(HR_EVT.CANCELLED)
    async onCancelled(e: HrCancelled) {
        if (e.fromStatus !== 'UNDER_REVIEW') return;
        const leads = await this.perm.listUsersWithRole('ICT_STAFF');
        await Promise.all(leads.map(l => this.push(l.id, {
            title: 'Request dibatalkan oleh user',
            message: `Request ${e.requestId.slice(0, 8)} dicancel`,
            type: NotificationType.HARDWARE_REQUEST_CANCELLED,
            link: link(e.requestId),
        })));
    }

    @OnEvent(HR_EVT.PROCUREMENT_DONE)
    async onProcurementDone(e: HrProcurementDone) {
        const r = await this.q.findById(e.requestId);
        if (!r) return;
        const techs = await this.perm.listUsersWithRole('ICT_STAFF');
        await this.push(e.requesterId, {
            title: 'Procurement selesai',
            message: `${r.requestNumber} siap jadwal instalasi`,
            type: NotificationType.HARDWARE_REQUEST_PROC_DONE,
            link: link(r.id),
        });
        await Promise.all(techs.map(t => this.push(t.id, {
            title: 'Siap dijadwalkan',
            message: `${r.requestNumber} menunggu instalasi`,
            type: NotificationType.HARDWARE_REQUEST_PROC_DONE_TECH,
            link: link(r.id),
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
            requiresAcknowledge: true,
        });
    }

    @OnEvent(HR_EVT.SCHEDULE_CONFIRMED)
    async onScheduleConfirmed(e: HrScheduleConfirmed) {
        await Promise.all([e.requesterId, e.technicianId].map(u => this.push(u, {
            title: 'Jadwal instalasi terkonfirmasi',
            message: 'Siap dilaksanakan',
            type: NotificationType.HARDWARE_REQUEST_SCHEDULE_CONFIRMED,
            link: link(e.requestId),
        })));
    }

    @OnEvent(HR_EVT.SCHEDULE_RESCHEDULED)
    async onScheduleRescheduled(e: HrScheduleRescheduled) {
        await Promise.all([e.requesterId, e.technicianId].map(u => this.push(u, {
            title: 'Jadwal instalasi diubah',
            message: e.reason ?? 'Mohon cek ulang jadwal',
            type: NotificationType.HARDWARE_REQUEST_SCHEDULE_RESCHEDULED,
            link: link(e.requestId),
            requiresAcknowledge: true,
        })));
    }

    @OnEvent(HR_EVT.INSTALL_STARTED)
    async onInstallStarted(e: HrInstallStarted) {
        await this.push(e.requesterId, {
            title: 'Instalasi dimulai',
            message: 'Teknisi sedang memasang hardware Anda',
            type: NotificationType.HARDWARE_REQUEST_INSTALL_STARTED,
            link: link(e.requestId),
        });
    }

    @OnEvent(HR_EVT.INSTALL_COMPLETED)
    async onInstallCompleted(e: HrInstallCompleted) {
        const r = await this.q.findById(e.requestId);
        if (!r) return;
        const leads = await this.perm.listUsersWithRole('ICT_STAFF');
        await this.push(e.requesterId, {
            title: 'Instalasi selesai',
            message: `${r.requestNumber} completed`,
            type: NotificationType.HARDWARE_REQUEST_COMPLETED,
            link: link(r.id),
        });
        await Promise.all(leads.map(l => this.push(l.id, {
            title: 'Request selesai',
            message: r.requestNumber,
            type: NotificationType.HARDWARE_REQUEST_COMPLETED_LEAD,
            link: link(r.id),
        })));
    }

    @OnEvent(HR_EVT.COMMENTED)
    async onCommented(e: HrCommented) {
        const targets = e.subscribers.filter(u => u !== e.actorId);
        await Promise.all(targets.map(u => this.push(u, {
            title: 'Komentar baru',
            message: e.body.slice(0, 140),
            type: NotificationType.HARDWARE_REQUEST_COMMENTED,
            link: link(e.requestId),
        })));
    }
}
