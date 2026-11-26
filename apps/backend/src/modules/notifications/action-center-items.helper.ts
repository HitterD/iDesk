import { EntityManager } from 'typeorm';
import { addMinutes, addHours, addDays, startOfDay, setHours } from 'date-fns';
import { ActionItemDto, ActionItemUrgency, ActionItemEntityType } from './dto/action-item.dto';
import { ActionItemSnooze } from './entities/action-item-snooze.entity';
import { UserRole } from '../users/enums/user-role.enum';
import { formatResolutionDeadline } from '../ticketing/utils/resolution-deadline.util';
import { isSlaTicketSql } from '../ticketing/utils/non-sla-ticket.util';
import { REQUEST_PROCESSOR_ROLES } from '../request-flow/domain/request-roles';
import { phaseOf } from '../request-flow/domain/flow-phase';
import type { ApprovalRoute } from '../request-flow/domain/approval-route';
import type { RequestKind } from '../request-flow/domain/request-kind';

export const DEFAULT_CATEGORY_SETTINGS: Record<string, boolean> = {
    TICKET: true,
    TICKET_NOTE: true,
    HARDWARE_REQUEST: true,
    EFORM: true,
    RENEWAL: true,
    ZOOM: true,
};

const AGENT_ROLES: readonly UserRole[] = [
    UserRole.AGENT,
    UserRole.AGENT_OPERATIONAL_SUPPORT,
    UserRole.AGENT_ORACLE,
    UserRole.AGENT_WEB_DEV,
    UserRole.AGENT_MOBILE_DEV,
    UserRole.AGENT_ADMIN,
    UserRole.ADMIN,
];

const MANAGER_OR_ADMIN_ROLES: readonly UserRole[] = [
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.AGENT_ADMIN,
];

interface FlowApprovalRow {
    ticketId: string | null;
    kind: RequestKind;
    route: ApprovalRoute | null;
    returnedReason: string | null;
    managerId: string | null;
    gmId: string | null;
    id: string;
    number: string | null;
    formType: string | null;
    status: string;
    requesterId: string | null;
    createdAt: Date | string;
    managerSigned: boolean;
    gmSigned: boolean;
}

export interface ActionItemQueryData {
    role: string;
    slaBreachedTickets: any[];
    unrespondedTickets: any[];
    resolvedTickets: any[];
    disputedTickets: any[];
    pendingHw: any[];
    userHwConfirmation: any[];
    agentHwInstallation: any[];
    pendingEform: any[];
    pendingIctEform: any[];
    flowApprovals: FlowApprovalRow[];
    renewals: any[];
    zoomBookings: any[];
}

export function resolveSnoozedUntil(duration: '30m' | '2h' | 'tomorrow'): Date {
    const now = new Date();
    if (duration === '30m') return addMinutes(now, 30);
    if (duration === '2h') return addHours(now, 2);
    const tomorrow = startOfDay(addDays(now, 1));
    return setHours(tomorrow, 8);
}

function ticketLink(role: string, ticketId: string | null | undefined): string | null {
    if (!ticketId) return null;
    return role === UserRole.USER ? `/client/tickets/${ticketId}` : `/tickets/${ticketId}`;
}

export async function fetchActionItemData(
    entityManager: EntityManager,
    userId: string,
    role: string,
    siteId: string | null,
    now: Date,
): Promise<ActionItemQueryData> {
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const next7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const isAgentOrAdmin = AGENT_ROLES.includes(role as UserRole);
    const isRequestProcessor = REQUEST_PROCESSOR_ROLES.includes(role as UserRole);
    const isManagerOrAdmin = MANAGER_OR_ADMIN_ROLES.includes(role as UserRole);
    const isUser = role === UserRole.USER;

    const hwSiteFilterSql = siteId ? ' AND hr."siteId" = $1' : '';
    const hwSiteFilterParams = siteId ? [siteId] : [];
    const eformSiteFilterSql = siteId ? ' AND ef."siteId" = $2' : '';
    const ictEformSiteFilterSql = siteId ? ' AND ef."siteId" = $1' : '';

    const [
        slaBreachedTickets,
        unrespondedTickets,
        resolvedTickets,
        disputedTickets,
        pendingHw,
        userHwConfirmation,
        agentHwInstallation,
        pendingEform,
        pendingIctEform,
        rawFlowApprovals,
        renewals,
        zoomBookings,
    ] = await Promise.all([
        isAgentOrAdmin ? entityManager.query(
            `SELECT id, "ticketNumber", title, "createdAt", "updatedAt" FROM tickets WHERE "assignedToId" = $1 AND status NOT IN ('RESOLVED', 'CLOSED', 'CANCELLED') AND "slaTarget" < $2 AND "deletedAt" IS NULL AND ${isSlaTicketSql('tickets')} ORDER BY "slaTarget" ASC LIMIT 50`,
            [userId, now],
        ).catch(() => []) : Promise.resolve([]),
        isAgentOrAdmin ? entityManager.query(
            `SELECT id, "ticketNumber", title, "createdAt" FROM tickets WHERE "assignedToId" = $1 AND status = 'TODO' AND "createdAt" < $2 AND "deletedAt" IS NULL ORDER BY "createdAt" ASC LIMIT 50`,
            [userId, oneHourAgo],
        ).catch(() => []) : Promise.resolve([]),
        isUser ? entityManager.query(
            `SELECT id, "ticketNumber", title, "updatedAt", "resolutionDeadlineAt" FROM tickets WHERE "userId" = $1 AND status = 'RESOLVED' AND "deletedAt" IS NULL ORDER BY "updatedAt" DESC LIMIT 50`,
            [userId],
        ).catch(() => []) : Promise.resolve([]),
        isAgentOrAdmin ? entityManager.query(
            `SELECT id, "ticketNumber", title, "disputedAt" FROM tickets WHERE "assignedToId" = $1 AND status = 'IN_PROGRESS' AND "disputedAt" IS NOT NULL AND "deletedAt" IS NULL ORDER BY "disputedAt" DESC LIMIT 50`,
            [userId],
        ).catch(() => []) : Promise.resolve([]),
        isRequestProcessor ? entityManager.query(
            `SELECT hr.id, hr."requestNumber", hr.status, hr."createdAt", rf."ticketId" AS "ticketId"
             FROM hardware_requests hr
             LEFT JOIN request_flows rf ON rf."hardwareRequestId" = hr.id
             WHERE hr.status IN ('SUBMITTED', 'UNDER_REVIEW')
               AND NOT (rf.id IS NOT NULL AND rf.route IS NOT NULL AND rf."returnedReason" IS NULL AND hr.status = 'UNDER_REVIEW')${hwSiteFilterSql}
             ORDER BY hr."createdAt" DESC LIMIT 50`,
            hwSiteFilterParams,
        ).catch(() => []) : Promise.resolve([]),
        entityManager.query(
            `SELECT hr.id, hr."requestNumber", hr.status, hr."createdAt", rf."ticketId" AS "ticketId"
             FROM hardware_requests hr
             LEFT JOIN request_flows rf ON rf."hardwareRequestId" = hr.id
             WHERE hr."requesterId" = $1 AND hr.status = 'AWAITING_USER_CONFIRMATION'
             ORDER BY hr."createdAt" DESC LIMIT 50`,
            [userId],
        ).catch(() => []),
        isRequestProcessor ? entityManager.query(
            `SELECT hr.id, hr."requestNumber", hr.status, hr."createdAt", rf."ticketId" AS "ticketId"
             FROM hardware_requests hr
             LEFT JOIN request_flows rf ON rf."hardwareRequestId" = hr.id
             WHERE hr.status IN ('APPROVED', 'INSTALLATION')${hwSiteFilterSql}
             ORDER BY hr."createdAt" DESC LIMIT 50`,
            hwSiteFilterParams,
        ).catch(() => []) : Promise.resolve([]),
        entityManager.query(
            `SELECT ef.id, ef."formType", ef."createdAt", rf."ticketId" AS "ticketId"
             FROM eform_requests ef
             LEFT JOIN request_flows rf ON rf."eformRequestId" = ef.id
             WHERE ef."currentApproverId" = $1
               AND ef.status IN ('PENDING_MANAGER', 'PENDING_GM')
               AND rf.id IS NULL${eformSiteFilterSql}
             ORDER BY ef."createdAt" DESC LIMIT 50`,
            siteId ? [userId, siteId] : [userId],
        ).catch(() => []),
        isRequestProcessor ? entityManager.query(
            `SELECT ef.id, ef."formType", ef.status, ef."createdAt", rf."ticketId" AS "ticketId"
             FROM eform_requests ef
             LEFT JOIN request_flows rf ON rf."eformRequestId" = ef.id
             WHERE ((rf.id IS NOT NULL AND ef.status IN ('PENDING_REVIEW', 'PENDING_ICT'))
                    OR (rf.id IS NULL AND ef.status = 'PENDING_ICT'))${ictEformSiteFilterSql}
             ORDER BY ef."createdAt" DESC LIMIT 50`,
            hwSiteFilterParams,
        ).catch(() => []) : Promise.resolve([]),
        entityManager.query(
            `SELECT f."ticketId", f."kind", f."route", f."returnedReason", f."managerId", f."gmId",
                 COALESCE(h."id"::text, e."id"::text) AS "id",
                 COALESCE(h."requestNumber", e."documentNumber") AS "number",
                 e."formType" AS "formType",
                 COALESCE(h."status"::text, e."status"::text) AS "status",
                 COALESCE(h."requesterId"::text, e."requesterId"::text) AS "requesterId",
                 COALESCE(h."createdAt", e."createdAt") AS "createdAt",
                 (f."kind" = 'HARDWARE' AND EXISTS (SELECT 1 FROM hardware_request_activities a WHERE a."requestId" = h."id" AND a."action"::text = 'UPDATED' AND a."metadata"::jsonb->>'step' = 'MANAGER'))
                   OR (f."kind" = 'EFORM' AND EXISTS (SELECT 1 FROM eform_approvals p WHERE p."eformRequestId" = e."id" AND p."role" = 'MANAGER' AND p."action" = 'APPROVED')) AS "managerSigned",
                 (f."kind" = 'HARDWARE' AND EXISTS (SELECT 1 FROM hardware_request_activities a WHERE a."requestId" = h."id" AND a."action"::text = 'UPDATED' AND a."metadata"::jsonb->>'step' = 'GM'))
                   OR (f."kind" = 'EFORM' AND (e."gmApprovedAt" IS NOT NULL OR EXISTS (SELECT 1 FROM eform_approvals p WHERE p."eformRequestId" = e."id" AND p."role" = 'GM' AND p."action" = 'APPROVED'))) AS "gmSigned"
             FROM request_flows f
             LEFT JOIN tickets t ON t."id" = f."ticketId"
             LEFT JOIN hardware_requests h ON h."id" = f."hardwareRequestId"
             LEFT JOIN eform_requests e ON e."id" = f."eformRequestId"
             WHERE (f."managerId" = $1 OR f."gmId" = $1)
               AND (t."id" IS NULL OR t."deletedAt" IS NULL)
               AND COALESCE(h."status"::text, e."status"::text) NOT IN ('REJECTED', 'CANCELLED', 'COMPLETED', 'CLOSED', 'CONFIRMED')
             ORDER BY COALESCE(h."createdAt", e."createdAt") DESC LIMIT 50`,
            [userId],
        ).catch(() => []),
        isManagerOrAdmin ? entityManager.query(
            `SELECT id, "vendorName", "description", "endDate", "status" FROM renewal_contracts WHERE "status" != 'EXPIRED' AND "endDate" < $1 AND "deletedAt" IS NULL ORDER BY "endDate" ASC LIMIT 50`,
            [next7Days],
        ).catch(() => []) : Promise.resolve([]),
        entityManager.query(
            `SELECT id, title, "bookingDate", "startTime", "endTime", status, "createdAt" FROM zoom_bookings WHERE "bookedByUserId" = $1 AND "bookingDate" = CURRENT_DATE AND status = 'CONFIRMED' ORDER BY "startTime" ASC LIMIT 20`,
            [userId],
        ).catch(() => []),
    ]);

    const flowApprovals = (rawFlowApprovals as FlowApprovalRow[]).filter((r) => {
        const phase = phaseOf(r.kind, r.status, {
            hasOpenSchedule: false,
            route: r.route,
            signed: { manager: Boolean(r.managerSigned), gm: Boolean(r.gmSigned) },
            returnedReason: r.returnedReason,
        });
        return (phase === 'appr_mgr' && r.managerId === userId) || (phase === 'appr_gm' && r.gmId === userId);
    });

    return {
        role,
        slaBreachedTickets,
        unrespondedTickets,
        resolvedTickets,
        disputedTickets,
        pendingHw,
        userHwConfirmation,
        agentHwInstallation,
        pendingEform,
        pendingIctEform,
        flowApprovals,
        renewals,
        zoomBookings,
    };
}

export function mapQueriesToActionItems(data: ActionItemQueryData, now: Date): ActionItemDto[] {
    const items: ActionItemDto[] = [];
    const next1Day = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    data.slaBreachedTickets?.forEach((t: any) => items.push({
        id: `tkt-sla-${t.id}`, entityType: ActionItemEntityType.TICKET, title: `SLA Breached: ${t.ticketNumber}`,
        description: t.title, urgency: ActionItemUrgency.CRITICAL, entityId: t.id, link: `/tickets/${t.id}`, createdAt: t.updatedAt, isSnoozed: false,
    }));

    data.unrespondedTickets?.forEach((t: any) => items.push({
        id: `tkt-unresp-${t.id}`, entityType: ActionItemEntityType.TICKET, title: `Unresponded: ${t.ticketNumber}`,
        description: t.title, urgency: ActionItemUrgency.HIGH, entityId: t.id, link: `/tickets/${t.id}`, createdAt: t.createdAt, isSnoozed: false,
    }));

    data.resolvedTickets?.forEach((t: any) => items.push({
        id: `tkt-res-${t.id}`, entityType: ActionItemEntityType.TICKET, title: `Ticket Resolved: ${t.ticketNumber}`,
        description: t.resolutionDeadlineAt
            ? `Konfirmasi selesai atau sanggah sebelum ${formatResolutionDeadline(t.resolutionDeadlineAt)}`
            : 'Konfirmasi apakah tiket sudah selesai',
        urgency: ActionItemUrgency.HIGH, entityId: t.id, link: `/client/tickets/${t.id}`, createdAt: t.updatedAt, isSnoozed: false,
    }));

    data.disputedTickets?.forEach((t: any) => items.push({
        id: `tkt-dispute-${t.id}`, entityType: ActionItemEntityType.TICKET, title: `Resolusi Disanggah: ${t.ticketNumber}`,
        description: t.title, urgency: ActionItemUrgency.HIGH, entityId: t.id, link: `/tickets/${t.id}`, createdAt: t.disputedAt, isSnoozed: false,
    }));

    data.flowApprovals?.forEach((r) => items.push(
        r.kind === 'HARDWARE'
            ? {
                id: `hw-${r.id}`, entityType: ActionItemEntityType.HARDWARE_REQUEST, title: 'Hardware Approval Pending',
                description: `Request ${r.number ?? ''}`.trim(), urgency: ActionItemUrgency.HIGH, entityId: r.id,
                link: ticketLink(data.role, r.ticketId) ?? `/hardware-requests/${r.id}`, createdAt: new Date(r.createdAt), isSnoozed: false,
            }
            : {
                id: `ef-${r.id}`, entityType: ActionItemEntityType.EFORM, title: 'E-Form Approval Pending',
                description: `${r.formType || 'E-Form'} Request`, urgency: ActionItemUrgency.HIGH, entityId: r.id,
                link: ticketLink(data.role, r.ticketId) ?? `/eform-access/${r.id}`, createdAt: new Date(r.createdAt), isSnoozed: false,
            },
    ));

    data.pendingHw?.forEach((hw: any) => items.push({
        id: `hw-${hw.id}`, entityType: ActionItemEntityType.HARDWARE_REQUEST, title: 'Hardware Review Pending',
        description: `Request ${hw.requestNumber}`, urgency: ActionItemUrgency.HIGH, entityId: hw.id,
        link: ticketLink(data.role, hw.ticketId) ?? `/hardware-requests/${hw.id}`, createdAt: hw.createdAt, isSnoozed: false,
    }));

    data.userHwConfirmation?.forEach((hw: any) => items.push({
        id: `hw-confirm-${hw.id}`, entityType: ActionItemEntityType.HARDWARE_REQUEST, title: 'Konfirmasi Penerimaan Hardware',
        description: `Request ${hw.requestNumber} siap dikonfirmasi`, urgency: ActionItemUrgency.HIGH, entityId: hw.id,
        link: ticketLink(data.role, hw.ticketId) ?? `/hardware-requests/${hw.id}`, createdAt: hw.createdAt, isSnoozed: false,
    }));

    data.agentHwInstallation?.forEach((hw: any) => items.push({
        id: `hw-install-${hw.id}`, entityType: ActionItemEntityType.HARDWARE_REQUEST, title: `Instalasi Hardware: ${hw.requestNumber}`,
        description: `Status: ${hw.status}`, urgency: ActionItemUrgency.HIGH, entityId: hw.id,
        link: ticketLink(data.role, hw.ticketId) ?? `/hardware-requests/${hw.id}`, createdAt: hw.createdAt, isSnoozed: false,
    }));

    data.pendingEform?.forEach((ef: any) => items.push({
        id: `ef-${ef.id}`, entityType: ActionItemEntityType.EFORM, title: 'E-Form Approval Pending',
        description: `${ef.formType} Request`, urgency: ActionItemUrgency.HIGH, entityId: ef.id,
        link: ticketLink(data.role, ef.ticketId) ?? `/eform-access/${ef.id}`, createdAt: ef.createdAt, isSnoozed: false,
    }));

    data.pendingIctEform?.forEach((ef: any) => items.push({
        id: `ef-ict-${ef.id}`, entityType: ActionItemEntityType.EFORM,
        title: ef.status === 'PENDING_ICT' ? 'E-Form Provisioning Pending' : 'E-Form Review Pending',
        description: `${ef.formType} Request`, urgency: ActionItemUrgency.HIGH, entityId: ef.id,
        link: ticketLink(data.role, ef.ticketId) ?? `/eform-access/${ef.id}`, createdAt: ef.createdAt, isSnoozed: false,
    }));

    data.renewals?.forEach((r: any) => {
        const isCritical = new Date(r.endDate) < next1Day;
        const label = r.vendorName || r.description || 'Unknown Contract';
        items.push({
            id: `ren-${r.id}`, entityType: ActionItemEntityType.RENEWAL, title: isCritical ? 'Renewal Critical' : 'Renewal Expiring Soon',
            description: label, urgency: isCritical ? ActionItemUrgency.CRITICAL : ActionItemUrgency.HIGH, entityId: r.id, link: '/renewal?tab=contracts', createdAt: new Date(), isSnoozed: false,
        });
    });

    data.zoomBookings?.forEach((z: any) => {
        const todayStr = new Date().toISOString().split('T')[0];
        const startTimePart = z.startTime ? z.startTime.slice(0, 5) : '00:00';
        const endTimePart = z.endTime ? z.endTime.slice(0, 5) : '23:59';
        const startDateTime = new Date(`${todayStr}T${startTimePart}:00`);
        const endDateTime = new Date(`${todayStr}T${endTimePart}:00`);
        const isSoonOrActive = !isNaN(startDateTime.getTime()) &&
            (now.getTime() >= startDateTime.getTime() - 2 * 60 * 60 * 1000) &&
            (now.getTime() <= endDateTime.getTime());

        items.push({
            id: `zoom-${z.id}`,
            entityType: ActionItemEntityType.ZOOM,
            title: `Zoom Meeting: ${z.title}`,
            description: `Pukul ${startTimePart} - ${endTimePart}`,
            urgency: isSoonOrActive ? ActionItemUrgency.HIGH : ActionItemUrgency.NORMAL,
            entityId: z.id,
            link: `/zoom-calendar?booking=${encodeURIComponent(z.id)}`,
            createdAt: z.createdAt ? new Date(z.createdAt) : new Date(),
            isSnoozed: false,
        });
    });

    return items;
}

export function processAndFilterActionItems(
    items: ActionItemDto[],
    activeSnoozes: ActionItemSnooze[],
    categorySettings: Record<string, boolean>,
) {
    const snoozeMap = new Map(
        activeSnoozes.map((s) => [`${s.entityType}:${s.entityId}`, s.snoozedUntil]),
    );

    const annotatedItems = items
        .filter((item) => categorySettings[item.entityType as string] !== false)
        .map((item) => {
            const snoozeUntil = snoozeMap.get(`${item.entityType}:${item.entityId}`);
            return {
                ...item,
                isSnoozed: !!snoozeUntil,
                snoozeUntil: snoozeUntil?.toISOString(),
            };
        });

    const activeItems = annotatedItems.filter((i) => !i.isSnoozed);
    const counts = {
        critical: activeItems.filter((i) => i.urgency === ActionItemUrgency.CRITICAL).length,
        high: activeItems.filter((i) => i.urgency === ActionItemUrgency.HIGH).length,
        normal: activeItems.filter((i) => i.urgency === ActionItemUrgency.NORMAL).length,
        total: activeItems.length,
    };

    const sortedItems = annotatedItems.sort((a, b) => {
        const urgencyWeight: Record<string, number> = { CRITICAL: 3, HIGH: 2, NORMAL: 1 };
        if (urgencyWeight[b.urgency] !== urgencyWeight[a.urgency]) {
            return urgencyWeight[b.urgency] - urgencyWeight[a.urgency];
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return { items: sortedItems, counts };
}
