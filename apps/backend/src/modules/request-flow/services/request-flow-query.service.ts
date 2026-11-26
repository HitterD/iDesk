import { ForbiddenException, Injectable } from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import { EFormCredential } from '../../eform-request/entities/eform-credential.entity';
import { HardwareAsset } from '../../hardware-request/domain/entities/hardware-asset.entity';
import { InstallationSchedule } from '../../hardware-request/domain/entities/installation-schedule.entity';
import { InstallStatus } from '../../hardware-request/domain/enums/install-status.enum';
import { RequestStatus } from '../../hardware-request/domain/enums/request-status.enum';
import { User } from '../../users/entities/user.entity';
import { UserRole } from '../../users/enums/user-role.enum';
import { assertSiteAccess, type SiteActor } from '../../../shared/core/utils/site-scope.util';
import type { ApprovalRoute } from '../domain/approval-route';
import { PHASE_LABEL, phaseOf, phaseSinceOf, type FlowPhase } from '../domain/flow-phase';
import type { HardwareSource, RequestKind } from '../domain/request-kind';
import { REQUEST_DOCUMENT_VIEWER_ROLES, REQUEST_PROCESSOR_ROLES } from '../domain/request-roles';
import { RequestDocumentRevision, type RequestDocumentRevisionKind } from '../entities/request-document-revision.entity';
import { RequestFlowReader, type FlowContext } from './request-flow-reader';

export type ViewerRoleInFlow = 'REQUESTER' | 'APPROVER_CURRENT' | 'APPROVER' | 'ICT' | 'OBSERVER';

export interface FlowViewer extends SiteActor { userId: string }

export interface ItemView {
    id: string;
    name: string;
    quantity: number;
    note: string | null;
    recipient: string;
    /** Catalog entry the unit came from (null for a hand-written item) and its extra fields: what the item editor keeps. */
    catalogId: string | null;
    fields: Record<string, unknown>;
    deliveryStatus: string;
    procurementDecision: string | null;
    vendor: string | null;
    actualCost: string | null;
    invoiceNumber: string | null;
    invoiceDate: string | null;
}

export interface ScheduleView {
    id: string;
    slots: { start: string; end: string }[];
    /** Index into `slots` of the slot the requester chose; null while none is chosen. */
    chosen: number | null;
    technicianName: string | null;
    /** Only this technician may start the installation. */
    technicianId: string | null;
    status: InstallStatus;
    resched: number;
    /** IT's note written with the proposed slots. */
    note: string | null;
}

export interface RequestFlowView {
    kind: RequestKind;
    phase: FlowPhase;
    phaseLabel: string;
    phaseSince: string | null;
    installScheduledAt: string | null;
    route: ApprovalRoute | null;
    managerId: string | null;
    gmId: string | null;
    hardwareSource: HardwareSource | null;
    returnedReason: string | null;
    rescheduleCount: number;
    documentVersion: number;
    revisions: { version: number; kind: RequestDocumentRevisionKind; label: string; actorName: string; createdAt: string }[];
    viewerRoleInFlow: ViewerRoleInFlow;
    hardware?: {
        /** The hardware request's id: the scheduling and install endpoints are keyed by it. */
        requestId: string;
        requestNumber: string;
        division: string;
        recipients: string[];
        items: ItemView[];
        schedule: ScheduleView | null;
        assets: { code: string; itemId: string }[];
    };
    eform?: {
        formType: string;
        documentNumber: string;
        startDate: string;
        endDate: string | null;
        fields: Record<string, string>;
        hasCredentials: boolean;
        requiresGm: boolean;
    };
}

const RECIPIENT_SEPARATOR = ', ';
const START_KEY = 'dariTanggal';
const END_KEY = 'sampaiTanggal';
const LABEL_SCHEDULE_WAITING = 'Menunggu pemohon pilih jadwal';
const LABEL_INSTALLING = 'Instalasi berlangsung';
const NOT_ALLOWED = 'Tidak berhak membuka permintaan ini';

/** A schedule the requester and IT agreed on (or already worked on): the install phase, not the scheduling one. */
const AGREED_SCHEDULE: readonly InstallStatus[] = [InstallStatus.CONFIRMED, InstallStatus.IN_PROGRESS, InstallStatus.DONE];
/** Superseded or withdrawn: never the schedule the request is at. */
const DEAD_SCHEDULE: readonly InstallStatus[] = [InstallStatus.RESCHEDULED, InstallStatus.CANCELLED];
/** Once the request is back in INSTALLATION (the requester reported an issue) a schedule that is DONE is the earlier attempt, not the one at hand. */
const FINISHED_SCHEDULE = InstallStatus.DONE;
const AWAITING_PICK: readonly InstallStatus[] = [InstallStatus.PROPOSED, InstallStatus.PROPOSED_AWAITING_USER, InstallStatus.RESCHEDULE_REQUESTED];

const isoDay = (value: Date | string | null): string | null => (value ? new Date(value).toISOString().slice(0, 10) : null);

/**
 * The read model the request ticket page renders: phase, route, revisions, hardware or e-form summary, and how the
 * viewer relates to the flow. It never carries signatures or credentials, only whether they exist.
 */
@Injectable()
export class RequestFlowQueryService {
    constructor(
        private readonly dataSource: DataSource,
        private readonly reader: RequestFlowReader,
    ) {}

    async view(viewer: FlowViewer, ticketId: string): Promise<RequestFlowView> {
        const ctx = await this.reader.load(ticketId);
        const role = this.roleOf(viewer, ctx);
        const { manager } = this.dataSource;
        const schedule = ctx.hardware ? await this.currentSchedule(ctx.hardware.id, ctx.hardware.status === RequestStatus.INSTALLATION) : null;
        const revisions = await manager.find(RequestDocumentRevision, { where: { flowId: ctx.flow.id }, order: { version: 'ASC' } });
        const people = await this.names([...revisions.map((r) => r.actorId), schedule?.technicianId]);

        const status = ctx.hardware?.status ?? ctx.eform!.status;
        const hasOpenSchedule = Boolean(schedule && AGREED_SCHEDULE.includes(schedule.status));
        const phase = phaseOf(ctx.kind, status, {
            hasOpenSchedule: Boolean(schedule && AGREED_SCHEDULE.includes(schedule.status)),
            route: ctx.flow.route, signed: ctx.signed, returnedReason: ctx.flow.returnedReason,
        });
        const scheduleView = schedule ? this.scheduleView(schedule, people) : null;
        const { flow } = ctx;
        const phaseSince = phaseSinceOf(phase, {
            ticketCreatedAt: ctx.ticket.createdAt,
            flowCreatedAt: flow.createdAt,
            reviewedAt: flow.reviewedAt,
            submittedAt: ctx.hardware?.submittedAt ?? ctx.eform?.submittedAt,
            managerApprovedAt: ctx.managerApprovedAt,
            approvedAt: ctx.hardware?.approvedAt,
            procuredAt: ctx.hardware?.procuredAt,
            gmApprovedAt: ctx.eform?.gmApprovedAt,
            installMarkedDoneAt: ctx.hardware?.installMarkedDoneAt,
            installStartedAt: schedule?.startedAt,
            completedAt: ctx.hardware?.completedAt,
            resolvedAt: ctx.eform?.resolvedAt,
            updatedAt: ctx.hardware?.updatedAt ?? ctx.eform?.updatedAt ?? flow.updatedAt,
        });
        const installScheduledAt = hasOpenSchedule && schedule?.scheduledStart
            ? new Date(schedule.scheduledStart).toISOString()
            : null;
        return {
            kind: ctx.kind,
            phase,
            phaseLabel: this.labelOf(phase, scheduleView, schedule),
            phaseSince,
            installScheduledAt,
            route: flow.route,
            managerId: flow.managerId,
            gmId: flow.gmId,
            hardwareSource: flow.hardwareSource,
            returnedReason: flow.returnedReason,
            rescheduleCount: flow.rescheduleCount,
            documentVersion: flow.documentVersion,
            revisions: revisions.map((r) => ({
                version: r.version, kind: r.kind, label: r.label, actorName: (r.actorId && people.get(r.actorId)) || '', createdAt: r.createdAt.toISOString(),
            })),
            viewerRoleInFlow: role,
            ...(ctx.hardware ? { hardware: await this.hardwareView(ctx, scheduleView, role === 'ICT') } : { eform: await this.eformView(ctx) }),
        };
    }

    /** Priority when several apply: ICT > current approver > approver > requester > observer. Refuses everyone else. */
    private roleOf(viewer: FlowViewer, ctx: FlowContext): ViewerRoleInFlow {
        const { userId } = viewer;
        if (REQUEST_PROCESSOR_ROLES.includes(viewer.role)) {
            assertSiteAccess(viewer, ctx.ticket.siteId);
            return 'ICT';
        }
        if (userId === ctx.flow.managerId || userId === ctx.flow.gmId) {
            return userId === ctx.approverId ? 'APPROVER_CURRENT' : 'APPROVER';
        }
        if (userId === ctx.requesterId) return 'REQUESTER';
        if (!REQUEST_DOCUMENT_VIEWER_ROLES.includes(viewer.role) || viewer.role === UserRole.USER) throw new ForbiddenException(NOT_ALLOWED);
        assertSiteAccess(viewer, ctx.ticket.siteId);
        return 'OBSERVER';
    }

    private labelOf(phase: FlowPhase, schedule: ScheduleView | null, row: InstallationSchedule | null): string {
        if (phase === 'schedule' && schedule && schedule.chosen === null) return LABEL_SCHEDULE_WAITING;
        if (phase === 'install' && row?.status === InstallStatus.IN_PROGRESS) return LABEL_INSTALLING;
        return PHASE_LABEL[phase];
    }

    /** The newest schedule that still stands; superseded and cancelled ones are history. */
    private async currentSchedule(requestId: string, requestInstalling: boolean): Promise<InstallationSchedule | null> {
        const rows = await this.dataSource.manager.find(InstallationSchedule, { where: { requestId }, order: { createdAt: 'DESC' } });
        return rows.find((row) => !DEAD_SCHEDULE.includes(row.status) && !(row.status === FINISHED_SCHEDULE && requestInstalling)) ?? null;
    }

    private scheduleView(row: InstallationSchedule, people: Map<string, string>): ScheduleView {
        const slots = row.proposedSlots ?? [];
        const start = row.scheduledStart ? new Date(row.scheduledStart).getTime() : null;
        // While the requester (or IT) still has to pick, the row's start is only a placeholder, not a choice.
        const picked = !AWAITING_PICK.includes(row.status);
        const index = start === null || !picked ? -1 : slots.findIndex((slot) => new Date(slot.start).getTime() === start);
        // A schedule IT set directly (no proposed slots) is its own single slot.
        const direct = picked && start !== null && row.scheduledEnd && slots.length === 0;
        return {
            id: row.id,
            slots: direct ? [{ start: new Date(row.scheduledStart!).toISOString(), end: new Date(row.scheduledEnd!).toISOString() }] : slots,
            chosen: direct ? 0 : index >= 0 ? index : null,
            technicianName: people.get(row.technicianId) ?? null,
            technicianId: row.technicianId ?? null,
            status: row.status,
            resched: row.rescheduleCount,
            note: row.note ?? null,
        };
    }

    private async names(ids: (string | null | undefined)[]): Promise<Map<string, string>> {
        const wanted = [...new Set(ids.filter((id): id is string => Boolean(id)))];
        if (wanted.length === 0) return new Map();
        const users = await this.dataSource.manager.find(User, { where: { id: In(wanted) }, select: ['id', 'fullName'] });
        return new Map(users.map((u) => [u.id, u.fullName]));
    }

    private async hardwareView(ctx: FlowContext, schedule: ScheduleView | null, showCosts: boolean): Promise<NonNullable<RequestFlowView['hardware']>> {
        const hardware = ctx.hardware!;
        const items = hardware.items ?? [];
        const assets = items.length
            ? await this.dataSource.manager.find(HardwareAsset, { where: { itemId: In(items.map((i) => i.id)) }, select: ['id', 'barcode', 'itemId'] })
            : [];
        return {
            requestId: hardware.id,
            requestNumber: hardware.requestNumber,
            division: hardware.division ?? '',
            recipients: (hardware.recipientName ?? '').split(RECIPIENT_SEPARATOR).filter(Boolean),
            items: items.map((item) => ({
                id: item.id,
                name: item.categorySnapshot.name,
                quantity: item.quantity,
                note: item.notes,
                recipient: item.recipientName ?? String(item.categorySnapshot.customFields?.recipientName ?? ''),
                catalogId: item.catalogId ?? null,
                fields: fieldsOf(item.categorySnapshot.customFields),
                deliveryStatus: item.deliveryStatus,
                procurementDecision: item.procurementDecision,
                // Vendor, cost and invoice are IT's until Task 6 decides who else sees them.
                vendor: showCosts ? item.vendor : null,
                actualCost: showCosts ? item.actualCost : null,
                invoiceNumber: showCosts ? item.invoiceNumber : null,
                invoiceDate: showCosts ? isoDay(item.invoiceDate) : null,
            })),
            schedule,
            assets: assets.map((a) => ({ code: a.barcode, itemId: a.itemId })),
        };
    }

    private async eformView(ctx: FlowContext): Promise<NonNullable<RequestFlowView['eform']>> {
        const eform = ctx.eform!;
        const { [START_KEY]: start, [END_KEY]: end, ...rest } = (eform.formData ?? {}) as Record<string, unknown>;
        const fields: Record<string, string> = {};
        const extras: Record<string, unknown> = { ...rest, requestedWebsites: eform.requestedWebsites, networkPurpose: eform.networkPurpose };
        for (const [key, value] of Object.entries(extras)) {
            if (typeof value === 'string' ? value.trim() : typeof value === 'number' || typeof value === 'boolean') fields[key] = String(value);
        }
        const credentials = await this.dataSource.manager.count(EFormCredential, { where: { eformRequestId: eform.id } });
        return {
            formType: eform.formType,
            documentNumber: eform.documentNumber ?? '',
            startDate: typeof start === 'string' ? start : '',
            endDate: typeof end === 'string' && end ? end : null,
            fields,
            hasCredentials: credentials > 0,
            requiresGm: ctx.flow.route ? ctx.flow.route === 'MANAGER_GM' : eform.requiresGm,
        };
    }
}

/** The item's own fields: the recipient is stored beside them for older readers and is not a field. */
function fieldsOf(customFields: Record<string, unknown> | undefined): Record<string, unknown> {
    const { recipientName: _recipient, ...rest } = customFields ?? {};
    return rest;
}
