import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { DataSource, In } from 'typeorm';
import { HardwareRequestActivity } from '../../hardware-request/domain/entities/hardware-request-activity.entity';
import { InstallationSchedule } from '../../hardware-request/domain/entities/installation-schedule.entity';
import { ActivityAction } from '../../hardware-request/domain/enums/activity-action.enum';
import { InstallStatus } from '../../hardware-request/domain/enums/install-status.enum';
import { RequestStatus } from '../../hardware-request/domain/enums/request-status.enum';
import { HardwareAssetService } from '../../hardware-request/services/hardware-asset.service';
import { HardwareRequestCommandService } from '../../hardware-request/services/hardware-request-command.service';
import { InstallationScheduleService } from '../../hardware-request/services/installation-schedule.service';
import { TicketStatus } from '../../ticketing/entities/ticket.entity';
import { assertSiteAccess } from '../../../shared/core/utils/site-scope.util';
import { phaseOf } from '../domain/flow-phase';
import { stepSignatureMetadata } from '../domain/hardware-signatures';
import { REQUEST_PROCESSOR_ROLES } from '../domain/request-roles';
import type { InstallDoneDto } from '../dto/install-done.dto';
import { RequestDocumentService } from './request-document.service';
import { RequestFlowReader } from './request-flow-reader';
import type { FlowActor } from './request-flow-review.service';
import { RequestFlowStepper } from './request-flow-stepper';

/** A schedule IT and the requester agreed on: the installation can be reported. */
const AGREED_SCHEDULE: readonly InstallStatus[] = [InstallStatus.CONFIRMED, InstallStatus.IN_PROGRESS];

const MESSAGES = {
    notIct: 'Hanya tim IT yang dapat melakukan ini',
    badTicketId: 'ID tiket tidak valid',
    notHardware: 'Permintaan ini bukan permintaan hardware',
    notInstalling: 'Permintaan ini tidak sedang dalam tahap pemasangan',
    codePerUnit: 'Setiap barang yang sudah tiba harus punya satu kode aset',
    notArrived: 'Barang belum tiba atau bukan bagian permintaan ini',
} as const;

export interface InstallDoneResult { status: string; assets: number }

/** The technician's report of an installation on a request ticket: asset codes, signature and the hand-over to the requester. */
@Injectable()
export class RequestInstallFlowService {
    constructor(
        private readonly dataSource: DataSource,
        private readonly reader: RequestFlowReader,
        private readonly assets: HardwareAssetService,
        private readonly schedules: InstallationScheduleService,
        private readonly hardware: HardwareRequestCommandService,
        private readonly documents: RequestDocumentService,
        private readonly stepper: RequestFlowStepper,
    ) {}

    async installDone(actor: FlowActor, ticketId: string, dto: InstallDoneDto): Promise<InstallDoneResult> {
        if (!REQUEST_PROCESSOR_ROLES.includes(actor.role)) throw new ForbiddenException(MESSAGES.notIct);
        if (!isUUID(ticketId)) throw new BadRequestException(MESSAGES.badTicketId);

        const { ctx, saved } = await this.dataSource.transaction(async (manager) => {
            const ctx = await this.reader.load(ticketId, manager, true);
            assertSiteAccess(actor, ctx.ticket.siteId);
            const request = ctx.hardware;
            if (!request) throw new ConflictException(MESSAGES.notHardware);
            const agreed = await manager.count(InstallationSchedule, { where: { requestId: request.id, status: In([...AGREED_SCHEDULE]) } });
            const phase = phaseOf('HARDWARE', request.status, {
                hasOpenSchedule: agreed > 0, route: ctx.flow.route, signed: ctx.signed, returnedReason: ctx.flow.returnedReason,
            });
            if (phase !== 'install') throw new ConflictException(MESSAGES.notInstalling);

            const assets = this.checkCodes(request.items ?? [], dto);
            await this.assets.createAssetsWith(manager, request.id, assets, actor.userId);
            await this.schedules.completeWith(manager, request.id, actor.userId);
            const saved = await this.hardware.completeInstallationWith(manager, request.id, actor.userId);

            const status = RequestStatus.AWAITING_USER_CONFIRMATION;
            // No code or signature in the trail of the count; the signature slot is read back for the document only.
            await manager.save(HardwareRequestActivity, manager.create(HardwareRequestActivity, {
                requestId: request.id, actorId: actor.userId, action: ActivityAction.UPDATED, fromStatus: status, toStatus: status,
                metadata: stepSignatureMetadata('ICT', actor.userId, actor.fullName, 'digital', dto.signatureData),
            }));
            await manager.save(HardwareRequestActivity, manager.create(HardwareRequestActivity, {
                requestId: request.id, actorId: actor.userId, action: ActivityAction.UPDATED, fromStatus: status, toStatus: status,
                metadata: { change: 'ASSETS_REGISTERED', count: assets.length, ...(dto.photoUrl ? { photoUrl: dto.photoUrl } : {}) },
            }));
            await this.documents.bump(ctx.flow.id, 'DIG', `TTD teknisi — ${assets.length} aset tercatat`, actor.userId, manager);
            return { ctx, saved };
        });

        // After the commit: the listeners tell the requester; the ticket goes to RESOLVED and waits for them.
        this.hardware.announceInstallCompleted(saved, actor.userId);
        await this.stepper.tell(ctx, {
            actorId: actor.userId, phase: 'INSTALLED', target: TicketStatus.RESOLVED, text: `Pemasangan selesai — menunggu ${ctx.requesterName} mengecek`,
        });
        return { status: saved.status, assets: dto.assets.length };
    }

    /** One code per arrived unit, none twice, none for a unit that has not arrived. */
    private checkCodes(units: { id: string; deliveryStatus: string; quantity: number }[], dto: InstallDoneDto): { itemId: string; barcode: string }[] {
        const arrived = units.filter((unit) => unit.deliveryStatus === 'ARRIVED');
        const known = new Set(arrived.map((unit) => unit.id));
        const seenCodes = new Set<string>();
        const seenUnits = new Set<string>();
        for (const { itemId, code } of dto.assets) {
            const key = code.toLowerCase();
            if (seenCodes.has(key)) throw new ConflictException(`Kode aset ${code} sudah dipakai`);
            seenCodes.add(key);
            if (!known.has(itemId)) throw new BadRequestException(MESSAGES.notArrived);
            if (seenUnits.has(itemId)) throw new BadRequestException(MESSAGES.codePerUnit);
            seenUnits.add(itemId);
        }
        if (seenUnits.size !== known.size) throw new BadRequestException(MESSAGES.codePerUnit);
        return dto.assets.map((a) => ({ itemId: a.itemId, barcode: a.code }));
    }
}
