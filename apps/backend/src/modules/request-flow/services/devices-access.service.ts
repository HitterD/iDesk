import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuditService } from '../../audit/audit.service';
import { AuditAction } from '../../audit/entities/audit-log.entity';
import { NotificationType } from '../../notifications/entities/notification.entity';
import { NotificationCenterService } from '../../notifications/notification-center.service';
import { TicketPriority } from '../../ticketing/entities/ticket.entity';
import { TicketCreateService } from '../../ticketing/services/ticket-create.service';
import { resolveSiteScope } from '../../../shared/core/utils/site-scope.util';
import { ACCESS_GROUPS, accessGroupOf, daysLeft, type AccessGroup } from '../domain/access-groups';
import { REQUEST_PROCESSOR_ROLES } from '../domain/request-roles';
import { listFieldsOf, type FlowListFields, type FlowListRow } from './request-flow-list-fields';
import type { FlowActor } from './request-flow-review.service';

const DAY_MS = 86_400_000;
const WEEK_DAYS = 7;
/** Schedules that occupy a technician's week (agreed, running, or proposed and waiting on the requester). */
const WEEK_STATUSES = ['CONFIRMED', 'IN_PROGRESS', 'DONE', 'PROPOSED', 'PROPOSED_AWAITING_USER', 'RESCHEDULE_REQUESTED'];
/** Hardware requests that are still in motion. */
const ACTIVE_HARDWARE = ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'PROCUREMENT', 'AWAITING_DELIVERY', 'INSTALLATION', 'AWAITING_USER_CONFIRMATION'] as const;
const REVOKE_DESCRIPTION = 'Masa berlaku akses sudah berakhir. Cabut akses dan konfirmasi ke pemohon.';

const MESSAGES = {
    notIt: 'Hanya tim IT yang dapat membuka halaman ini',
    badWeek: 'Tanggal awal minggu tidak valid (YYYY-MM-DD)',
    noAccess: 'Akses tidak ditemukan',
} as const;

/** The access types as the tickets are titled. */
const KIND_LABEL: Record<string, string> = {
    VPN: 'VPN', WEBSITE: 'Website', NETWORK: 'Network', FLASHDISK: 'Flashdisk', EMAIL: 'Email', SYNOLOGY_NAS: 'Synology NAS',
};

interface AccessRow {
    id: string; ticketId: string; formType: string; requesterId: string; requesterName: string; department: string;
    siteId: string | null; startDate: string | null; endDate: string | null;
}

export interface AccessItem {
    eformId: string; ticketId: string; kind: string; requesterName: string; department: string;
    startDate: string | null; endDate: string | null; group: AccessGroup; daysLeft: number | null;
}
export interface AccessView { group: AccessGroup; counts: Record<AccessGroup, number>; items: AccessItem[] }

export interface ScheduleEvent {
    scheduleId: string; ticketId: string; ticketNumber: string; title: string; siteId: string | null;
    technicianId: string; technicianName: string; status: string; start: string | null; end: string | null;
}
export interface ScheduleWeek {
    weekStart: string;
    events: ScheduleEvent[];
    load: Array<{ technicianId: string; technicianName: string; count: number }>;
}

export interface CenterSummary {
    activeHardware: number; inProcurement: number; waitingInstall: number; doneThisMonth: number;
    byPhase: Array<{ phase: string; count: number }>;
}

export interface ApprovalItem extends FlowListFields {
    ticketId: string; ticketNumber: string; title: string; requesterName: string;
}

const NO_ACCESS_VIEW = (group: AccessGroup): AccessView => ({ group, counts: { soon: 0, expired: 0, active: 0, permanent: 0 }, items: [] });

/** The IT-side pages that sit beside the ticket list: the install schedule, access validity, and "waiting for my signature". */
@Injectable()
export class DevicesAccessService {
    constructor(
        private readonly dataSource: DataSource,
        private readonly tickets: TicketCreateService,
        private readonly notifications: NotificationCenterService,
        private readonly audit: AuditService,
    ) {}

    /** The clock; tests replace it to pin "today". */
    now: () => Date = () => new Date();

    /** Access given by e-form tickets that are finished (confirmed), inside the staff member's site. */
    async access(actor: FlowActor, group: AccessGroup): Promise<AccessView> {
        const siteId = this.siteOf(actor);
        if (siteId === undefined) return NO_ACCESS_VIEW(group);
        const today = this.now();
        const items = (await this.accessRows(siteId)).map((row): AccessItem => ({
            eformId: row.id, ticketId: row.ticketId, kind: row.formType, requesterName: row.requesterName, department: row.department,
            startDate: row.startDate, endDate: row.endDate || null,
            group: accessGroupOf(row.endDate, today), daysLeft: row.endDate ? daysLeft(row.endDate, today) : null,
        }));
        const counts = Object.fromEntries(ACCESS_GROUPS.map((g) => [g, items.filter((i) => i.group === g).length])) as Record<AccessGroup, number>;
        return { group, counts, items: items.filter((i) => i.group === group).sort(byEndDate) };
    }

    /** The signed-in requester's own finished accesses, nearest end first (permanent ones last). Never anyone else's. */
    async myAccess(actor: FlowActor): Promise<AccessItem[]> {
        const rows: Array<Pick<AccessRow, 'id' | 'ticketId' | 'formType' | 'startDate' | 'endDate'>> = await this.dataSource.query(`/* MY_ACCESS_ROWS */
            SELECT e."id", f."ticketId", e."formType"::text AS "formType",
                e."formData"->>'dariTanggal' AS "startDate", NULLIF(e."formData"->>'sampaiTanggal', '') AS "endDate"
            FROM eform_requests e
            JOIN request_flows f ON f."eformRequestId" = e."id"
            JOIN tickets t ON t."id" = f."ticketId" AND t."deletedAt" IS NULL
            WHERE e."requesterId"::text = $1 AND e."status"::text = 'CONFIRMED'`, [actor.userId]);
        const today = this.now();
        return rows
            .map((row): AccessItem => ({
                eformId: row.id, ticketId: row.ticketId, kind: row.formType, requesterName: actor.fullName, department: '',
                startDate: row.startDate, endDate: row.endDate || null,
                group: accessGroupOf(row.endDate, today), daysLeft: row.endDate ? daysLeft(row.endDate, today) : null,
            }))
            .filter((item) => item.group !== 'expired')
            .sort(byEndDate);
    }

    /** Tells the requester their access is about to end (or has ended). */
    async remind(actor: FlowActor, eformId: string): Promise<{ sent: true }> {
        const row = await this.findAccess(actor, eformId);
        await this.notifications.send({
            userId: row.requesterId, type: NotificationType.EFORM_EXPIRY_REMINDER,
            title: `Pengingat: akses ${KIND_LABEL[row.formType] ?? row.formType}`,
            message: row.endDate ? `Masa berlaku akses ${KIND_LABEL[row.formType] ?? row.formType} Anda berakhir ${row.endDate}.` : 'Mohon konfirmasi apakah akses ini masih dibutuhkan.',
            ticketId: row.ticketId, referenceId: `${row.id}_remind_${this.now().toISOString().slice(0, 10)}`, link: `/tickets/${row.ticketId}`,
        });
        this.audit.logAsync({
            userId: actor.userId, action: AuditAction.EFORM_FULFILL, entityType: 'EFormRequest', entityId: row.id,
            description: 'Reminded the requester about access validity',
        });
        return { sent: true };
    }

    /** Files an ordinary IT Support ticket to take the access away; the access itself is removed by IT in the ticket. */
    async revoke(actor: FlowActor, eformId: string): Promise<{ ticketId: string; ticketNumber: string }> {
        const row = await this.findAccess(actor, eformId);
        const kind = KIND_LABEL[row.formType] ?? row.formType;
        const ticket = await this.tickets.createTicket(actor.userId, {
            title: `Cabut akses ${kind} — ${row.requesterName}`,
            description: `${REVOKE_DESCRIPTION} Akses ${kind} milik ${row.requesterName} (${row.department}).`,
            priority: TicketPriority.MEDIUM,
        } as never);
        this.audit.logAsync({
            userId: actor.userId, action: AuditAction.EFORM_FULFILL, entityType: 'EFormRequest', entityId: row.id,
            description: `Filed ticket ${ticket.ticketNumber} to revoke access`,
        });
        return { ticketId: ticket.id, ticketNumber: ticket.ticketNumber };
    }

    /** Installations of one week (Monday start) and how many each technician has. */
    async schedule(actor: FlowActor, weekStart: string): Promise<ScheduleWeek> {
        this.assertIt(actor);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart) || Number.isNaN(Date.parse(`${weekStart}T00:00:00Z`))) throw new BadRequestException(MESSAGES.badWeek);
        const siteId = this.siteOf(actor);
        if (siteId === undefined) return { weekStart, events: [], load: [] };
        const from = new Date(`${weekStart}T00:00:00+07:00`);
        const to = new Date(from.getTime() + WEEK_DAYS * DAY_MS);
        const events: ScheduleEvent[] = await this.dataSource.query(`/* SCHEDULE_ROWS */
            SELECT s."id" AS "scheduleId", t."id" AS "ticketId", t."ticketNumber", t."title", t."siteId",
                s."technicianId"::text AS "technicianId", u."fullName" AS "technicianName", s."status"::text AS "status",
                s."scheduledStart" AS "start", s."scheduledEnd" AS "end"
            FROM installation_schedules s
            JOIN hardware_requests h ON h."id" = s."requestId"
            JOIN tickets t ON t."id" = h."sourceTicketId" AND t."deletedAt" IS NULL
            LEFT JOIN users u ON u."id" = s."technicianId"
            WHERE s."status"::text = ANY($1) AND s."scheduledStart" >= $2 AND s."scheduledStart" < $3
              AND ($4::text IS NULL OR t."siteId"::text = $4)
            ORDER BY s."scheduledStart" ASC`, [WEEK_STATUSES, from, to, siteId]);
        return { weekStart, events, load: technicianLoad(events) };
    }

    /** Request tickets waiting for the viewer's signature, newest first. */
    async approvals(actor: FlowActor): Promise<ApprovalItem[]> {
        const rows: Array<FlowListRow & { ticketNumber: string; title: string; requesterName: string; managerSigned: boolean; gmSigned: boolean }> = await this.dataSource.query(`/* APPROVAL_ROWS */
            SELECT f."ticketId", t."ticketNumber", t."title", f."kind", f."route", f."returnedReason", f."managerId", f."gmId",
                COALESCE(h."status"::text, e."status"::text) AS "status",
                COALESCE(h."requesterId"::text, e."requesterId"::text) AS "requesterId",
                COALESCE(ru."fullName", e."requesterName") AS "requesterName",
                (f."kind" = 'HARDWARE' AND EXISTS (SELECT 1 FROM hardware_request_activities a WHERE a."requestId" = h."id" AND a."action"::text = 'UPDATED' AND a."metadata"::jsonb->>'step' = 'MANAGER'))
                  OR (f."kind" = 'EFORM' AND EXISTS (SELECT 1 FROM eform_approvals p WHERE p."eformRequestId" = e."id" AND p."role" = 'MANAGER' AND p."action" = 'APPROVED')) AS "managerSigned",
                (f."kind" = 'HARDWARE' AND EXISTS (SELECT 1 FROM hardware_request_activities a WHERE a."requestId" = h."id" AND a."action"::text = 'UPDATED' AND a."metadata"::jsonb->>'step' = 'GM'))
                  OR (f."kind" = 'EFORM' AND (e."gmApprovedAt" IS NOT NULL OR EXISTS (SELECT 1 FROM eform_approvals p WHERE p."eformRequestId" = e."id" AND p."role" = 'GM' AND p."action" = 'APPROVED'))) AS "gmSigned",
                false AS "hasOpenSchedule"
            FROM request_flows f
            JOIN tickets t ON t."id" = f."ticketId" AND t."deletedAt" IS NULL
            LEFT JOIN hardware_requests h ON h."id" = f."hardwareRequestId"
            LEFT JOIN eform_requests e ON e."id" = f."eformRequestId"
            LEFT JOIN users ru ON ru."id"::text = h."requesterId"::text
            WHERE (f."managerId" = $1 OR f."gmId" = $1)
              AND COALESCE(h."status"::text, e."status"::text) NOT IN ('REJECTED', 'CANCELLED', 'COMPLETED', 'CLOSED', 'CONFIRMED')
            ORDER BY t."createdAt" DESC LIMIT 200`, [actor.userId]);
        return rows
            .map((row) => ({ row, fields: listFieldsOf({ ...row, signed: { manager: row.managerSigned, gm: row.gmSigned } }, actor) }))
            .filter(({ fields }) => fields.needsMyAction)
            .map(({ row, fields }) => ({ ticketId: row.ticketId, ticketNumber: row.ticketNumber, title: row.title, requesterName: row.requesterName, ...fields }));
    }

    /** Counts of hardware requests by where they are, inside the staff member's site. */
    async summary(actor: FlowActor): Promise<CenterSummary> {
        const siteId = this.siteOf(actor);
        const empty: CenterSummary = { activeHardware: 0, inProcurement: 0, waitingInstall: 0, doneThisMonth: 0, byPhase: [] };
        if (siteId === undefined) return empty;
        const rows: Array<{ status: string; count: string; doneThisMonth: string }> = await this.dataSource.query(`/* SUMMARY_ROWS */
            SELECT h."status"::text AS "status", COUNT(*) AS "count",
                SUM(CASE WHEN h."status"::text IN ('COMPLETED', 'CLOSED') AND h."completedAt" >= date_trunc('month', now() AT TIME ZONE 'Asia/Jakarta') AT TIME ZONE 'Asia/Jakarta' THEN 1 ELSE 0 END) AS "doneThisMonth"
            FROM hardware_requests h
            JOIN request_flows f ON f."hardwareRequestId" = h."id"
            JOIN tickets t ON t."id" = f."ticketId" AND t."deletedAt" IS NULL
            WHERE ($1::text IS NULL OR t."siteId"::text = $1)
            GROUP BY h."status"`, [siteId]);
        const count = (statuses: readonly string[]) => rows.filter((r) => statuses.includes(r.status)).reduce((sum, r) => sum + Number(r.count), 0);
        return {
            activeHardware: count(ACTIVE_HARDWARE),
            inProcurement: count(['APPROVED', 'PROCUREMENT', 'AWAITING_DELIVERY']),
            waitingInstall: count(['INSTALLATION']),
            doneThisMonth: rows.reduce((sum, r) => sum + Number(r.doneThisMonth), 0),
            byPhase: rows.map((r) => ({ phase: r.status, count: Number(r.count) })),
        };
    }

    private assertIt(actor: FlowActor): void {
        if (!REQUEST_PROCESSOR_ROLES.includes(actor.role)) throw new ForbiddenException(MESSAGES.notIt);
    }

    /** `null` = every site, a site id = that site, `undefined` = no site at all (fail closed). */
    private siteOf(actor: FlowActor): string | null | undefined {
        this.assertIt(actor);
        const scope = resolveSiteScope(actor);
        if (scope.mode === 'all') return null;
        return scope.mode === 'site' ? scope.siteId : undefined;
    }

    private async accessRows(siteId: string | null): Promise<AccessRow[]> {
        return this.dataSource.query(`/* ACCESS_ROWS */
            SELECT e."id", f."ticketId", e."formType"::text AS "formType", e."requesterId"::text AS "requesterId", e."requesterName",
                e."requesterDepartment" AS "department", t."siteId"::text AS "siteId",
                e."formData"->>'dariTanggal' AS "startDate", NULLIF(e."formData"->>'sampaiTanggal', '') AS "endDate"
            FROM eform_requests e
            JOIN request_flows f ON f."eformRequestId" = e."id"
            JOIN tickets t ON t."id" = f."ticketId" AND t."deletedAt" IS NULL
            WHERE e."status"::text = 'CONFIRMED' AND ($1::text IS NULL OR t."siteId"::text = $1)`, [siteId]);
    }

    private async findAccess(actor: FlowActor, eformId: string): Promise<AccessRow> {
        const siteId = this.siteOf(actor);
        if (siteId === undefined) throw new NotFoundException(MESSAGES.noAccess);
        const row = (await this.accessRows(siteId)).find((r) => r.id === eformId);
        if (!row) throw new NotFoundException(MESSAGES.noAccess);
        return row;
    }
}

const byEndDate = (a: AccessItem, b: AccessItem): number => (a.endDate ?? '9999').localeCompare(b.endDate ?? '9999');

function technicianLoad(events: ScheduleEvent[]): ScheduleWeek['load'] {
    const byTech = new Map<string, { technicianId: string; technicianName: string; count: number }>();
    for (const e of events) {
        const entry = byTech.get(e.technicianId) ?? { technicianId: e.technicianId, technicianName: e.technicianName, count: 0 };
        entry.count += 1;
        byTech.set(e.technicianId, entry);
    }
    return [...byTech.values()].sort((a, b) => b.count - a.count);
}
