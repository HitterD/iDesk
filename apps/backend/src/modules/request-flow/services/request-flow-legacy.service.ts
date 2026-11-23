import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { DataSource } from 'typeorm';
import { assertSiteAccess } from '../../../shared/core/utils/site-scope.util';
import { REQUEST_PROCESSOR_ROLES } from '../domain/request-roles';
import type { UserRole } from '../../users/enums/user-role.enum';

export type LegacyKind = 'hardware' | 'eform';
const TABLE: Record<LegacyKind, string> = { hardware: 'hardware_requests', eform: 'eform_requests' };

interface LegacyRow { ticketId: string; requesterId: string; siteId: string | null; managerId: string | null; gmId: string | null }
export interface LegacyViewer { userId: string; role: UserRole | string; siteId: string | null }

/** Old links (emails, notifications, bookmarks) name the old request id; this finds the ticket that replaced the page. */
@Injectable()
export class RequestFlowLegacyService {
    constructor(private readonly dataSource: DataSource) {}

    async ticketOf(viewer: LegacyViewer, kind: LegacyKind, legacyId: string): Promise<{ ticketId: string }> {
        const table = TABLE[kind];
        if (!table) throw new BadRequestException('Jenis permintaan tidak dikenal');
        if (!isUUID(legacyId)) throw new NotFoundException('Permintaan tidak ditemukan');
        const rows: LegacyRow[] = await this.dataSource.query(
            `SELECT f."ticketId", r."requesterId"::text AS "requesterId", t."siteId"::text AS "siteId", f."managerId"::text AS "managerId", f."gmId"::text AS "gmId"
             FROM ${table} r
             JOIN request_flows f ON f."${kind === 'hardware' ? 'hardwareRequestId' : 'eformRequestId'}" = r."id"
             JOIN tickets t ON t."id" = f."ticketId" AND t."deletedAt" IS NULL
             WHERE r."id" = $1`, [legacyId]);
        const found = rows[0];
        if (!found) throw new NotFoundException('Permintaan tidak ditemukan');
        const mine = viewer.userId === found.requesterId || viewer.userId === found.managerId || viewer.userId === found.gmId;
        if (!mine) {
            if (!REQUEST_PROCESSOR_ROLES.includes(viewer.role as UserRole)) throw new ForbiddenException('Tidak berhak membuka permintaan ini');
            assertSiteAccess({ role: viewer.role as UserRole, siteId: viewer.siteId }, found.siteId);
        }
        return { ticketId: found.ticketId };
    }
}
