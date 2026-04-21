// apps/backend/src/modules/hardware-request/services/hardware-catalog.service.spec.ts
import { Test } from '@nestjs/testing';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { HardwareCatalogService } from './hardware-catalog.service';
import { HardwareCatalog } from '../domain/entities/hardware-catalog.entity';
import { ItemCategory } from '../domain/enums/item-category.enum';

type R = jest.Mocked<Pick<Repository<HardwareCatalog>, 'find' | 'findOne' | 'save' | 'create' | 'remove'>>;

describe('HardwareCatalogService', () => {
    let service: HardwareCatalogService;
    let repo: R;

    beforeEach(async () => {
        repo = {
            find: jest.fn(),
            findOne: jest.fn(),
            save: jest.fn((x) => Promise.resolve({ id: 'new-id', ...x })),
            create: jest.fn((x) => x as any),
            remove: jest.fn(),
        } as unknown as R;

        const moduleRef = await Test.createTestingModule({
            providers: [
                HardwareCatalogService,
                { provide: getRepositoryToken(HardwareCatalog), useValue: repo },
            ],
        }).compile();

        service = moduleRef.get(HardwareCatalogService);
    });

    it('listActive returns active catalog sorted by displayOrder', async () => {
        repo.find.mockResolvedValue([
            { id: '1', code: 'LAPTOP_STD', active: true, displayOrder: 1 } as any,
        ]);
        const res = await service.listActive();
        expect(repo.find).toHaveBeenCalledWith({
            where: { active: true },
            order: { displayOrder: 'ASC', name: 'ASC' },
        });
        expect(res).toHaveLength(1);
    });

    it('create persists new catalog item', async () => {
        repo.findOne.mockResolvedValue(null);
        const dto = {
            code: 'MOUSE_STD',
            name: 'Standard Mouse',
            category: ItemCategory.ACCESSORY,
        };
        const result = await service.create(dto as any);
        expect(repo.create).toHaveBeenCalledWith(expect.objectContaining(dto));
        expect(repo.save).toHaveBeenCalled();
        expect(result.id).toBe('new-id');
    });

    it('create rejects duplicate code', async () => {
        repo.findOne.mockResolvedValue({ id: 'existing', code: 'LAPTOP_STD' } as any);
        await expect(
            service.create({ code: 'LAPTOP_STD', name: 'x', category: ItemCategory.LAPTOP } as any),
        ).rejects.toThrow(/already exists/i);
    });

    it('remove deletes the item', async () => {
        const existing = { id: 'c1', active: true } as any;
        repo.findOne.mockResolvedValue(existing);
        await service.remove('c1');
        expect(repo.remove).toHaveBeenCalledWith(existing);
    });

    it('ensureActive throws CatalogItemInactiveError when inactive', async () => {
        repo.findOne.mockResolvedValue({ id: 'c1', active: false } as any);
        await expect(service.ensureActive('c1')).rejects.toMatchObject({
            response: expect.objectContaining({ code: 'HR_CATALOG_INACTIVE' }),
        });
    });
});
