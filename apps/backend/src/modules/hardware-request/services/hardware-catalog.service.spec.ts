// apps/backend/src/modules/hardware-request/services/hardware-catalog.service.spec.ts
import { Test } from '@nestjs/testing';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CacheService } from '../../../shared/core/cache';
import { HardwareCatalogService } from './hardware-catalog.service';
import { HardwareCatalog } from '../domain/entities/hardware-catalog.entity';
import { ItemCategory } from '../domain/enums/item-category.enum';

type R = jest.Mocked<Pick<Repository<HardwareCatalog>, 'find' | 'findOne' | 'save' | 'create' | 'remove'>>;

describe('HardwareCatalogService', () => {
    let service: HardwareCatalogService;
    let repo: R;
    const cacheService = {
        getOrSet: jest.fn((_key, loader) => loader()),
        delAsync: jest.fn().mockResolvedValue(undefined),
    };

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
                { provide: CacheService, useValue: cacheService },
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

    it('update allows changing item code', async () => {
        const existing = { id: 'c1', code: 'LAPTOP_STD', name: 'Laptop Standard', active: true } as any;
        repo.findOne.mockResolvedValueOnce(existing) // for getById
                    .mockResolvedValueOnce(null);     // for duplicate check
        const result = await service.update('c1', { code: 'LAPTOP_STD_V2' });
        expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ code: 'LAPTOP_STD_V2' }));
        expect(result.code).toBe('LAPTOP_STD_V2');
    });

    it('update rejects duplicate code if already used by another item', async () => {
        const existing = { id: 'c1', code: 'LAPTOP_STD', name: 'Laptop Standard', active: true } as any;
        repo.findOne.mockResolvedValueOnce(existing) // for getById
                    .mockResolvedValueOnce({ id: 'c2', code: 'LAPTOP_DESIGN' } as any); // duplicate found
        await expect(
            service.update('c1', { code: 'LAPTOP_DESIGN' }),
        ).rejects.toThrow(/already exists/i);
    });

    it('listAll keeps hidden items for the catalog page, in display order', async () => {
        repo.find.mockResolvedValue([{ id: '1', active: true, displayOrder: 10 }, { id: '2', active: false, displayOrder: 20 }] as any);
        const res = await service.listAll();
        expect(repo.find).toHaveBeenCalledWith({ order: { displayOrder: 'ASC', name: 'ASC' } });
        expect(res.map((r) => r.id)).toEqual(['1', '2']);
    });

    it('update changes order, required fields and visibility, and refreshes the lists', async () => {
        repo.findOne.mockResolvedValue({ id: 'c1', code: 'LAPTOP_STD', active: true, displayOrder: 10, requiredFields: [] } as any);
        const saved = await service.update('c1', { displayOrder: 30, active: false, requiredFields: [{ key: 'seat', label: 'Jumlah seat', type: 'number', required: true }] });
        expect(saved).toMatchObject({ displayOrder: 30, active: false, requiredFields: [{ key: 'seat' }] });
        expect(cacheService.delAsync).toHaveBeenCalledWith('hw-catalog:list:active');
        expect(cacheService.delAsync).toHaveBeenCalledWith('hw-catalog:list:all');
    });

    it('ensureActive throws CatalogItemInactiveError when inactive', async () => {
        repo.findOne.mockResolvedValue({ id: 'c1', active: false } as any);
        await expect(service.ensureActive('c1')).rejects.toMatchObject({
            response: expect.objectContaining({ code: 'HR_CATALOG_INACTIVE' }),
        });
    });
    describe('assertRequiredFields', () => {
        const license = {
            id: 'c-lic', code: 'SW_LICENSE', name: 'Lisensi Software', category: ItemCategory.SOFTWARE, active: true,
            requiredFields: [
                { key: 'software', label: 'Nama software', type: 'text', required: true },
                { key: 'edition', label: 'Edisi', type: 'select', options: ['Standard', 'Pro'], required: false },
                { key: 'note', label: 'Catatan', type: 'text' },
            ],
        } as any;

        it.each([[{}], [{ software: '' }], [{ software: '   ' }], [{ software: null }]])(
            'rejects a catalog item whose required field is empty (%j)',
            (fields) => {
                expect(() => service.assertRequiredFields(license, fields)).toThrow('Isian "Nama software" wajib untuk Lisensi Software');
            },
        );

        it('accepts filled required fields and leaves optional ones empty', () => {
            expect(() => service.assertRequiredFields(license, { software: 'AutoCAD' })).not.toThrow();
        });

        it('accepts a number as a filled value', () => {
            expect(() => service.assertRequiredFields(license, { software: 0 })).not.toThrow();
        });

        it('accepts a catalog item without required fields', () => {
            expect(() => service.assertRequiredFields({ ...license, requiredFields: [] }, {})).not.toThrow();
        });
    });
});
