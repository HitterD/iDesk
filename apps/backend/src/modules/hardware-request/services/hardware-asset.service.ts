import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { HardwareAsset } from '../domain/entities/hardware-asset.entity';
import { HardwareRequestItem } from '../domain/entities/hardware-request-item.entity';
import { HardwareRequest } from '../domain/entities/hardware-request.entity';

const UNIQUE_VIOLATION = '23505';
/** Error code the legacy asset endpoint reports for a code in use. */
const DUPLICATE_CODE = 'HR_BARCODE_DUPLICATE';

@Injectable()
export class HardwareAssetService {
    constructor(
        @InjectRepository(HardwareAsset) private readonly repo: Repository<HardwareAsset>,
        @InjectRepository(HardwareRequestItem) private readonly items: Repository<HardwareRequestItem>,
        @InjectRepository(HardwareRequest) private readonly reqs: Repository<HardwareRequest>,
    ) {}

    async createAsset(requestId: string, itemId: string, barcode: string, installedBy: string): Promise<HardwareAsset> {
        const item = await this.items.findOne({ where: { id: itemId, requestId } });
        if (!item) throw new NotFoundException('item');
        const req = await this.reqs.findOne({ where: { id: requestId } });
        if (!req) throw new NotFoundException('request');

        const dupe = await this.repo.findOne({ where: { barcode } });
        if (dupe) {
            const err: any = new ConflictException('HR_BARCODE_DUPLICATE');
            err.existingAssetId = dupe.id;
            throw err;
        }
        const existing = await this.repo.count({ where: { itemId } });
        if (existing >= item.quantity) throw new ConflictException('quantity reached for this item');

        const row = this.repo.create({
            itemId, barcode,
            assignedToUserId: req.recipientId ?? req.requesterId,
            siteId: req.siteId,
            installedAt: new Date(),
            installedBy,
        });
        return this.repo.save(row);
    }

    /**
     * Registers one asset per (unit, code) inside the caller's transaction: all or none. A code that is already in use
     * (also one lost to a concurrent report) is refused as HR_BARCODE_DUPLICATE with the code in the message.
     */
    async createAssetsWith(
        mgr: EntityManager, requestId: string, assets: { itemId: string; barcode: string }[], installedBy: string,
    ): Promise<HardwareAsset[]> {
        const req = await mgr.getRepository(HardwareRequest).findOne({ where: { id: requestId } });
        if (!req) throw new NotFoundException('request');
        const repo = mgr.getRepository(HardwareAsset);
        const used = await repo.find({ where: { barcode: In(assets.map((a) => a.barcode)) }, select: ['id', 'barcode'] });
        if (used.length > 0) throw this.duplicate(used[0].barcode, used[0].id);
        const now = new Date();
        const rows = assets.map((a) => repo.create({
            itemId: a.itemId, barcode: a.barcode, assignedToUserId: req.recipientId ?? req.requesterId, siteId: req.siteId, installedAt: now, installedBy,
        }));
        try {
            return await repo.save(rows);
        } catch (err) {
            // The unique index decides when two reports race for the same code.
            if ((err as { code?: string }).code === UNIQUE_VIOLATION) {
                // The detail reads `Key (barcode)=(CODE) already exists.`; without it the first code of the report is named.
                const detail = String((err as { detail?: string }).detail ?? '');
                const lost = assets.find((a) => detail.includes(`(${a.barcode})`)) ?? assets[0];
                throw this.duplicate(lost.barcode, undefined);
            }
            throw err;
        }
    }

    private duplicate(barcode: string, existingAssetId: string | undefined): ConflictException {
        const err: any = new ConflictException(`Kode aset ${barcode} sudah dipakai`);
        err.code = DUPLICATE_CODE;
        err.existingAssetId = existingAssetId;
        return err;
    }

    async findByBarcode(barcode: string): Promise<HardwareAsset | null> {
        return this.repo.findOne({ where: { barcode } });
    }

    async allAssetsCollected(items: HardwareRequestItem[]): Promise<boolean> {
        for (const it of items) {
            const c = await this.repo.count({ where: { itemId: it.id } });
            if (c < it.quantity) return false;
        }
        return true;
    }

    async listByRequest(requestId: string): Promise<HardwareAsset[]> {
        return this.repo.createQueryBuilder('a')
            .innerJoin('hardware_request_items', 'i', 'i.id = a.itemId')
            .where('i.requestId = :requestId', { requestId })
            .orderBy('a.createdAt', 'ASC')
            .getMany();
    }
}
