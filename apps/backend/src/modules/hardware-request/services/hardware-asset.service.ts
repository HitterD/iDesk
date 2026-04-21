import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HardwareAsset } from '../domain/entities/hardware-asset.entity';
import { HardwareRequestItem } from '../domain/entities/hardware-request-item.entity';
import { HardwareRequest } from '../domain/entities/hardware-request.entity';

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
