import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { DataSource, EntityManager, In } from 'typeorm';
import { HardwareRequestItem } from '../../hardware-request/domain/entities/hardware-request-item.entity';
import { InstallationSchedule } from '../../hardware-request/domain/entities/installation-schedule.entity';
import { InstallStatus } from '../../hardware-request/domain/enums/install-status.enum';
import { ItemCategory } from '../../hardware-request/domain/enums/item-category.enum';
import { RequestStatus } from '../../hardware-request/domain/enums/request-status.enum';
import { HardwareCatalogService } from '../../hardware-request/services/hardware-catalog.service';
import { assertSiteAccess } from '../../../shared/core/utils/site-scope.util';
import { phaseOf, type FlowPhase } from '../domain/flow-phase';
import { REQUEST_PROCESSOR_ROLES } from '../domain/request-roles';
import type { EditItemLineDto, EditItemsDto } from '../dto/edit-items.dto';
import { RequestDocumentService } from './request-document.service';
import { RequestFlowNotifier } from './request-flow-notifier';
import { RequestFlowReader, type FlowContext } from './request-flow-reader';
import type { FlowActor } from './request-flow-review.service';
import { RequestFlowStepper } from './request-flow-stepper';

const EDITABLE_PHASES: readonly FlowPhase[] = ['review', 'appr_mgr', 'appr_gm', 'procure', 'delivery', 'schedule'];
/** A schedule IT and the requester agreed on: from here the job is installation, not scheduling. */
const AGREED_SCHEDULE: readonly InstallStatus[] = [InstallStatus.CONFIRMED, InstallStatus.IN_PROGRESS, InstallStatus.DONE];
/** Past procurement the buying is over: units added now would never be bought. */
const NO_NEW_UNITS: readonly string[] = [RequestStatus.AWAITING_DELIVERY, RequestStatus.INSTALLATION];
const REVISION_LABEL = 'Barang diubah oleh IT';

const MESSAGES = {
    notIct: 'Hanya tim IT yang dapat melakukan ini',
    badTicketId: 'ID tiket tidak valid',
    notHardware: 'Permintaan ini bukan permintaan hardware',
    locked: 'Barang tidak bisa diubah pada tahap ini',
    arrived: 'Barang yang sudah tiba tidak bisa diubah',
    unknownUnit: 'Barang tidak ditemukan pada permintaan ini',
    duplicateUnit: 'Satu barang tidak boleh muncul di dua baris',
    itemRequired: 'Barang harus dari katalog atau ditulis manual',
    bought: 'Barang tidak bisa ditambah setelah pembelian',
} as const;

type Snapshot = HardwareRequestItem['categorySnapshot'];
interface ResolvedLine { catalogId: string | null; snapshot: Snapshot }

/** IT's edit of a request's items: the diff against the units it has now, the document revision and the chat note. */
@Injectable()
export class RequestItemsService {
    constructor(
        private readonly dataSource: DataSource,
        private readonly reader: RequestFlowReader,
        private readonly stepper: RequestFlowStepper,
        private readonly documents: RequestDocumentService,
        private readonly notifier: RequestFlowNotifier,
        private readonly catalog: HardwareCatalogService,
    ) {}

    async edit(actor: FlowActor, ticketId: string, dto: EditItemsDto): Promise<{ version: number }> {
        if (!REQUEST_PROCESSOR_ROLES.includes(actor.role)) throw new ForbiddenException(MESSAGES.notIct);
        if (!isUUID(ticketId)) throw new BadRequestException(MESSAGES.badTicketId);

        const outcome = await this.dataSource.transaction(async (manager) => {
            const ctx = await this.reader.load(ticketId, manager, true);
            assertSiteAccess(actor, ctx.ticket.siteId);
            await this.assertEditable(manager, ctx);
            const before = ctx.hardware!.items ?? [];
            const { rows, removed } = await this.plan(ctx, before, dto.items);
            if (removed.length > 0) await manager.delete(HardwareRequestItem, removed.map((u) => u.id));
            const saved = await manager.save(HardwareRequestItem, rows.map((row) => (row.id ? row : manager.create(HardwareRequestItem, row))));
            const version = await this.documents.bump(ctx.flow.id, 'GEN', REVISION_LABEL, actor.userId, manager);
            return { ctx, version, before, after: saved as HardwareRequestItem[] };
        });

        await this.afterEdit(actor, dto.reason, outcome);
        return { version: outcome.version };
    }

    private async assertEditable(manager: EntityManager, ctx: FlowContext): Promise<void> {
        if (!ctx.hardware) throw new ConflictException(MESSAGES.notHardware);
        const open = await manager.count(InstallationSchedule, { where: { requestId: ctx.hardware.id, status: In([...AGREED_SCHEDULE]) } });
        const phase = phaseOf('HARDWARE', ctx.hardware.status, {
            hasOpenSchedule: open > 0, route: ctx.flow.route, signed: ctx.signed, returnedReason: ctx.flow.returnedReason,
        });
        if (!EDITABLE_PHASES.includes(phase)) throw new ConflictException(MESSAGES.locked);
    }

    /** What the units look like afterwards: rows to save (kept ones carry their id) and units to drop. */
    private async plan(ctx: FlowContext, current: HardwareRequestItem[], lines: EditItemLineDto[]) {
        const byId = new Map(current.map((unit) => [unit.id, unit]));
        const claimed = new Set<string>();
        const rows: Partial<HardwareRequestItem>[] = [];
        const canAdd = !NO_NEW_UNITS.includes(ctx.hardware!.status);

        for (const line of lines) {
            const resolved = await this.resolve(line);
            const keep = (line.existingItemIds ?? []).map((id) => {
                const unit = byId.get(id);
                if (!unit) throw new BadRequestException(MESSAGES.unknownUnit);
                if (claimed.has(id)) throw new BadRequestException(MESSAGES.duplicateUnit);
                claimed.add(id);
                return unit;
            });
            keep.slice(0, line.quantity).forEach((unit) => rows.push(this.updated(unit, line, resolved)));
            // Units beyond the new quantity are dropped; the ones the line asks for on top are new rows, one per unit.
            keep.slice(line.quantity).forEach((unit) => claimed.add(unit.id));
            const extra = line.quantity - keep.length;
            if (extra > 0 && !canAdd) throw new ConflictException(MESSAGES.bought);
            for (let n = 0; n < extra; n++) rows.push(this.fresh(ctx.hardware!.id, line, resolved));
        }
        const removed = current.filter((unit) => !rows.some((row) => row.id === unit.id));
        if (removed.some((unit) => unit.deliveryStatus === 'ARRIVED')) throw new ConflictException(MESSAGES.arrived);
        return { rows, removed };
    }

    private async resolve(line: EditItemLineDto): Promise<ResolvedLine> {
        const customFields = { ...(line.fields ?? {}), ...(line.recipientName ? { recipientName: line.recipientName } : {}) };
        if (line.catalogId) {
            const cat = await this.catalog.ensureActive(line.catalogId);
            this.catalog.assertRequiredFields(cat, customFields);
            return { catalogId: cat.id, snapshot: { code: cat.code, name: cat.name, category: cat.category, specs: cat.defaultSpecs ?? {}, customFields } };
        }
        const name = line.manualName?.trim();
        if (!name) throw new BadRequestException(MESSAGES.itemRequired);
        return { catalogId: null, snapshot: { code: null, name, category: ItemCategory.OTHER, specs: {}, customFields } };
    }

    private withReplaces(snapshot: Snapshot, replaces?: string): Snapshot {
        return replaces ? { ...snapshot, replaces } as Snapshot : snapshot;
    }

    /** An arrived unit keeps what it is (only its note and fields may change); any other unit takes the new item. */
    private updated(unit: HardwareRequestItem, line: EditItemLineDto, resolved: ResolvedLine): HardwareRequestItem {
        const notes = line.note ?? null;
        if (unit.deliveryStatus === 'ARRIVED') {
            if (unit.categorySnapshot.name !== resolved.snapshot.name) throw new ConflictException(MESSAGES.arrived);
            return { ...unit, notes, categorySnapshot: { ...unit.categorySnapshot, customFields: resolved.snapshot.customFields } };
        }
        const sameName = unit.categorySnapshot.name === resolved.snapshot.name;
        const replaces = line.replacesName ?? (sameName ? (unit.categorySnapshot as { replaces?: string }).replaces : undefined);
        return { ...unit, catalogId: resolved.catalogId, notes, categorySnapshot: this.withReplaces(resolved.snapshot, replaces) };
    }

    private fresh(requestId: string, line: EditItemLineDto, resolved: ResolvedLine): Partial<HardwareRequestItem> {
        return {
            requestId, quantity: 1, notes: line.note ?? null, catalogId: resolved.catalogId, deliveryStatus: 'PENDING',
            categorySnapshot: this.withReplaces(resolved.snapshot, line.replacesName),
        };
    }

    /** The chat note with before and after, and a word to the approvers who already signed an older version. */
    private async afterEdit(
        actor: FlowActor, reason: string, outcome: { ctx: FlowContext; before: HardwareRequestItem[]; after: HardwareRequestItem[] },
    ): Promise<void> {
        const { ctx, before, after } = outcome;
        const text = `${actor.fullName} mengubah barang\nSebelum: ${summary(before)}\nSesudah: ${summary(after)}`;
        await this.stepper.tell(ctx, { actorId: actor.userId, phase: 'REVIEWED', text, reason });
        const signers = [ctx.signed.manager ? ctx.flow.managerId : null, ctx.signed.gm ? ctx.flow.gmId : null]
            .filter((id): id is string => Boolean(id) && id !== actor.userId);
        for (const id of signers) {
            await this.notifier.tellUser(
                ctx, id, 'Barang permintaan diubah IT',
                `${ctx.ticket.ticketNumber}: ${actor.fullName} mengubah barang setelah Anda menandatangani. ${reason}`,
            );
        }
    }
}

/** "2× Laptop A, 1× Mouse": units grouped by name, in order of appearance. */
function summary(units: HardwareRequestItem[]): string {
    const counts = new Map<string, number>();
    for (const unit of units) counts.set(unit.categorySnapshot.name, (counts.get(unit.categorySnapshot.name) ?? 0) + 1);
    return [...counts].map(([name, count]) => `${count}× ${name}`).join(', ') || '-';
}
