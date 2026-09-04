import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { MailDispatchService } from '../../../shared/mail/mail-dispatch.service';
import { buildAppUrl } from '../../../shared/mail/app-url.util';
import { HardwareRequestQueryService } from '../services/hardware-request-query.service';
import { PermissionsService } from '../../permissions/permissions.service';
import { UserRole } from '../../users/enums/user-role.enum';
import {
    HR_EVT,
    HardwareEvents,
    HrSubmitted,
    HrApproved,
    HrRejected,
    HrInstallCompleted,
    HrProcurementDone,
    ItemArrivedPayload,
} from '../domain/events/hardware-request.events';

@Injectable()
export class EmailNotifierListener {
    private readonly logger = new Logger(EmailNotifierListener.name);

    constructor(
        private readonly mailDispatch: MailDispatchService,
        private readonly perm: PermissionsService,
        private readonly q: HardwareRequestQueryService,
    ) {}

    private async send(to: string, subject: string, context: any) {
        try {
            await this.mailDispatch.send({
                to,
                subject,
                template: 'hardware-request-status',
                context,
            });
        } catch (e) {
            this.logger.error(`Failed to send email to ${to}: ${e.message}`, e.stack);
        }
    }

    @OnEvent(HR_EVT.SUBMITTED)
    async onSubmitted(e: HrSubmitted) {
        const r = await this.q.findById(e.requestId);
        if (!r) return;
        const siteId = (r as any).siteId ?? null;
        const opsAgents = await this.perm.listUsersWithRole(UserRole.AGENT_OPERATIONAL_SUPPORT, siteId);
        const context = {
            requestNumber: r.requestNumber,
            title: 'Permintaan Hardware Baru',
            status: 'Menunggu Persetujuan',
            message: `Ada permintaan hardware baru dari ${r.requester?.fullName} yang menunggu persetujuan Anda.`,
            link: buildAppUrl(`/hardware-requests/${r.id}`)
        };
        await Promise.all(
            opsAgents
                .filter(l => !!l.email)
                .map(l => this.send(l.email, `Permintaan Hardware: ${r.requestNumber}`, context))
        );
    }

    @OnEvent(HR_EVT.APPROVED)
    async onApproved(e: HrApproved) {
        const r = await this.q.findById(e.requestId);
        if (!r) return;
        const context = {
            requestNumber: r.requestNumber,
            title: 'Permintaan Disetujui',
            status: 'Dibuatkan SPP (SPP Issued)',
            message: `Permintaan hardware Anda telah disetujui dan sedang dalam proses pembuatan SPP pengadaan.`,
            link: buildAppUrl(`/hardware-requests/${r.id}`)
        };
        if (r.requester?.email) {
            await this.send(r.requester.email, `Update Permintaan Hardware: ${r.requestNumber}`, context);
        }
    }

    @OnEvent(HR_EVT.PROCUREMENT_DONE)
    async onProcurementDone(e: HrProcurementDone) {
        const r = await this.q.findById(e.requestId);
        if (!r) return;
        const context = {
            requestNumber: r.requestNumber,
            title: 'SPP Telah Diterbitkan',
            status: 'SPP Issued',
            message: `SPP untuk pengadaan barang hardware Anda telah diterbitkan dan menunggu pengiriman vendor.`,
            link: buildAppUrl(`/hardware-requests/${r.id}`)
        };
        if (r.requester?.email) {
            await this.send(r.requester.email, `SPP Diterbitkan: ${r.requestNumber}`, context);
        }
    }

    @OnEvent(HardwareEvents.ItemArrived)
    async onItemArrived(e: ItemArrivedPayload) {
        const r = await this.q.findById(e.requestId);
        if (!r) return;
        const context = {
            requestNumber: r.requestNumber,
            title: 'Barang Hardware Telah Tiba',
            status: 'Barang Tiba di Lokasi',
            message: `Barang "${e.itemName}" untuk permintaan ${r.requestNumber} telah tiba di lokasi. Tim ICT akan segera mengoordinasikan jadwal pemasangan/instalasi perangkat.`,
            link: buildAppUrl(`/hardware-requests/${r.id}`)
        };
        if (r.requester?.email) {
            await this.send(r.requester.email, `Barang Tiba: ${r.requestNumber} - ${e.itemName}`, context);
        }
    }

    @OnEvent(HR_EVT.REJECTED)
    async onRejected(e: HrRejected) {
        const r = await this.q.findById(e.requestId);
        if (!r) return;
        const context = {
            requestNumber: r.requestNumber,
            title: 'Permintaan Ditolak',
            status: 'Ditolak',
            message: `Lembaga menolak permintaan hardware Anda dengan alasan: ${e.reason}`,
            link: buildAppUrl(`/hardware-requests/${r.id}`)
        };
        if (r.requester?.email) {
            await this.send(r.requester.email, `Update Permintaan Hardware: ${r.requestNumber}`, context);
        }
    }

    @OnEvent(HR_EVT.INSTALL_COMPLETED)
    async onCompleted(e: HrInstallCompleted) {
        const r = await this.q.findById(e.requestId);
        if (!r) return;
        const context = {
            requestNumber: r.requestNumber,
            title: 'Instalasi Selesai',
            status: 'Selesai',
            message: `Instalasi hardware untuk permintaan Anda telah selesai dilaksanakan.`,
            link: buildAppUrl(`/hardware-requests/${r.id}`)
        };
        if (r.requester?.email) {
            await this.send(r.requester.email, `Permintaan Selesai: ${r.requestNumber}`, context);
        }
    }
}
