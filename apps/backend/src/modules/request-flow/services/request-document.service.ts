import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { EFormPdfService } from '../../eform-request/eform-pdf.service';
import { EFormRequest } from '../../eform-request/entities/eform-request.entity';
import { HardwareRequestActivity } from '../../hardware-request/domain/entities/hardware-request-activity.entity';
import { assertSiteAccess, type SiteActor } from '../../../shared/core/utils/site-scope.util';
import { REQUEST_DOCUMENT_VIEWER_ROLES } from '../domain/request-roles';
import { ROUTE_LABEL, SOURCE_LABEL } from '../domain/approval-phase';
import { signedSlots } from '../domain/hardware-signatures';
import { RequestDocumentRevision, type RequestDocumentRevisionKind } from '../entities/request-document-revision.entity';
import { RequestFlow } from '../entities/request-flow.entity';
import { documentQrText, renderHardwareRequestPdf, type HardwarePdfItem } from '../pdf/hardware-request-pdf';
import { RequestFlowReader, type FlowContext } from './request-flow-reader';

export interface DocumentViewer extends SiteActor { userId: string }

interface ItemRow { categorySnapshot: { name: string; customFields?: Record<string, unknown> }; notes: string | null; quantity: number }

/**
 * The one document of a request ticket. Every signature, route change or item change adds a revision (`bump`); the
 * PDF carries a QR of `<ticketNumber>/v<N>` so a scanned paper signature can be matched to the version it signed.
 */
@Injectable()
export class RequestDocumentService {
    constructor(
        private readonly dataSource: DataSource,
        private readonly reader: RequestFlowReader,
        private readonly eformPdf: EFormPdfService,
        @InjectRepository(EFormRequest) private readonly eformRepo: Repository<EFormRequest>,
    ) {}

    /** Adds the next revision inside the caller's transaction and returns its version (kept on the flow, too). */
    async bump(
        flowId: string, kind: RequestDocumentRevisionKind, label: string, actorId: string | null, manager: EntityManager,
    ): Promise<number> {
        await manager.findOne(RequestFlow, { where: { id: flowId }, lock: { mode: 'pessimistic_write' } });
        const latest = await manager.findOne(RequestDocumentRevision, { where: { flowId }, order: { version: 'DESC' } });
        const version = (latest?.version ?? 0) + 1;
        await manager.save(RequestDocumentRevision, manager.create(RequestDocumentRevision, { flowId, version, kind, label, actorId }));
        await manager.update(RequestFlow, { id: flowId }, { documentVersion: version });
        return version;
    }

    /** Remembers which stored scan a paper-signed revision came from. */
    async attachScan(flowId: string, version: number, scanPath: string, manager: EntityManager): Promise<void> {
        await manager.update(RequestDocumentRevision, { flowId, version }, { scanPath });
    }

    /** The PDF of `version` (default: the latest), with its QR and version in the footer. */
    async renderPdf(viewer: DocumentViewer, ticketId: string, version?: number): Promise<{ buffer: Buffer; fileName: string }> {
        const ctx = await this.reader.load(ticketId);
        this.assertCanView(viewer, ctx);
        const latest = ctx.flow.documentVersion;
        if (version !== undefined && (!Number.isInteger(version) || version < 1 || version > latest)) {
            throw new BadRequestException(`Versi dokumen tidak ada (terbaru v${latest})`);
        }
        const n = version ?? latest;
        const buffer = ctx.hardware ? await this.hardwarePdf(ctx, n) : await this.eformDocument(ctx, n);
        return { buffer, fileName: `${ctx.ticket.ticketNumber}_v${n}.pdf` };
    }

    private assertCanView(viewer: DocumentViewer, ctx: FlowContext): void {
        const { userId } = viewer;
        if (userId === ctx.requesterId || userId === ctx.flow.managerId || userId === ctx.flow.gmId) return;
        if (!REQUEST_DOCUMENT_VIEWER_ROLES.includes(viewer.role)) throw new ForbiddenException('Tidak berhak membuka dokumen ini');
        assertSiteAccess(viewer, ctx.ticket.siteId);
    }

    private async eformDocument(ctx: FlowContext, version: number): Promise<Buffer> {
        const request = await this.eformRepo.findOne({
            where: { id: ctx.eform!.id },
            relations: ['signatures', 'approvals', 'requester', 'currentApprover'],
        });
        if (!request) throw new NotFoundException('Pengajuan akses tidak ditemukan');
        return this.eformPdf.generatePdf(request, undefined, { qrText: documentQrText(ctx.ticket.ticketNumber, version), version });
    }

    private async hardwarePdf(ctx: FlowContext, version: number): Promise<Buffer> {
        const hardware = ctx.hardware!;
        const activities = await this.dataSource.manager.find(HardwareRequestActivity, {
            where: { requestId: hardware.id }, order: { createdAt: 'ASC' },
        });
        return renderHardwareRequestPdf({
            ticketNumber: ctx.ticket.ticketNumber,
            requestNumber: hardware.requestNumber,
            version,
            createdAt: hardware.createdAt,
            requesterName: ctx.requesterName,
            division: hardware.division ?? '',
            justification: hardware.justification,
            sourceLabel: ctx.flow.hardwareSource ? SOURCE_LABEL[ctx.flow.hardwareSource] : '',
            routeLabel: ctx.flow.route ? ROUTE_LABEL[ctx.flow.route] : '',
            items: groupItems(hardware.items ?? []),
            signatures: signedSlots(activities, ctx.requesterName),
        });
    }
}

/** One row per distinct item: the request stores one row per unit, the document lists quantities. */
function groupItems(items: ItemRow[]): HardwarePdfItem[] {
    const rows = new Map<string, HardwarePdfItem>();
    for (const item of items) {
        const recipient = String(item.categorySnapshot.customFields?.recipientName ?? '');
        const key = [item.categorySnapshot.name, recipient, item.notes ?? ''].join('|');
        const row = rows.get(key);
        if (row) row.quantity += item.quantity;
        else rows.set(key, { name: item.categorySnapshot.name, quantity: item.quantity, recipient, note: item.notes ?? '' });
    }
    return [...rows.values()];
}
