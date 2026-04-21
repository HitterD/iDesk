import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { HardwareAssetService } from './hardware-asset.service';
import { HardwareAsset } from '../domain/entities/hardware-asset.entity';
import { HardwareRequestItem } from '../domain/entities/hardware-request-item.entity';
import { HardwareRequest } from '../domain/entities/hardware-request.entity';

describe('HardwareAssetService', () => {
    let svc: HardwareAssetService;
    const assetRepo = { findOne: jest.fn(), create: jest.fn(v => v), save: jest.fn(v => ({ ...v, id: 'a1' })), count: jest.fn(), createQueryBuilder: jest.fn() };
    const itemRepo = { findOne: jest.fn() };
    const reqRepo = { findOne: jest.fn() };

    beforeEach(async () => {
        const mod = await Test.createTestingModule({
            providers: [
                HardwareAssetService,
                { provide: getRepositoryToken(HardwareAsset), useValue: assetRepo },
                { provide: getRepositoryToken(HardwareRequestItem), useValue: itemRepo },
                { provide: getRepositoryToken(HardwareRequest), useValue: reqRepo },
            ],
        }).compile();
        svc = mod.get(HardwareAssetService);
        jest.clearAllMocks();
    });

    it('creates asset with unique barcode', async () => {
        itemRepo.findOne.mockResolvedValue({ id: 'i1', requestId: 'r1', quantity: 2 });
        reqRepo.findOne.mockResolvedValue({ id: 'r1', requesterId: 'u1', siteId: 's1', recipientId: null });
        assetRepo.findOne.mockResolvedValue(null);
        assetRepo.count.mockResolvedValue(0);

        const res = await svc.createAsset('r1', 'i1', 'BC-001', 't1');
        expect(res.id).toBe('a1');
        expect(res.barcode).toBe('BC-001');
    });

    it('rejects duplicate barcode', async () => {
        itemRepo.findOne.mockResolvedValue({ id: 'i1', requestId: 'r1', quantity: 1 });
        reqRepo.findOne.mockResolvedValue({ id: 'r1', requesterId: 'u1', siteId: 's1' });
        assetRepo.findOne.mockResolvedValue({ id: 'other', barcode: 'BC-001' });
        await expect(svc.createAsset('r1', 'i1', 'BC-001', 't1')).rejects.toThrow(/HR_BARCODE_DUPLICATE/);
    });

    it('rejects scan beyond quantity', async () => {
        itemRepo.findOne.mockResolvedValue({ id: 'i1', requestId: 'r1', quantity: 2 });
        reqRepo.findOne.mockResolvedValue({ id: 'r1', requesterId: 'u1', siteId: 's1' });
        assetRepo.findOne.mockResolvedValue(null);
        assetRepo.count.mockResolvedValue(2);
        await expect(svc.createAsset('r1', 'i1', 'BC-003', 't1')).rejects.toThrow(/quantity reached/i);
    });

    it('allAssetsCollected returns true when all items fully barcoded', async () => {
        assetRepo.count.mockResolvedValueOnce(2).mockResolvedValueOnce(1);
        const items = [{ id: 'i1', quantity: 2 }, { id: 'i2', quantity: 1 }];
        const ok = await svc.allAssetsCollected(items as any);
        expect(ok).toBe(true);
    });
});
