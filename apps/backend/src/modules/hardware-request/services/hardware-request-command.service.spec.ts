// apps/backend/src/modules/hardware-request/services/hardware-request-command.service.spec.ts
import { Test } from '@nestjs/testing';
import { DataSource, Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { HardwareRequestCommandService } from './hardware-request-command.service';
import { HardwareRequest } from '../domain/entities/hardware-request.entity';
import { HardwareRequestItem } from '../domain/entities/hardware-request-item.entity';
import { HardwareRequestActivity } from '../domain/entities/hardware-request-activity.entity';
import { HardwareCatalogService } from './hardware-catalog.service';
import { RequestNumberService } from './request-number.service';
import { RequestStatus } from '../domain/enums/request-status.enum';
import { ActivityAction } from '../domain/enums/activity-action.enum';
import { ItemCategory } from '../domain/enums/item-category.enum';
import { InstallationSchedule } from '../domain/entities/installation-schedule.entity';
import { HardwareAssetService } from './hardware-asset.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InstallStatus } from '../domain/enums/install-status.enum';
describe('HardwareRequestCommandService', () => {
    let service: HardwareRequestCommandService;
    let reqRepo: any;
    let activityRepo: any;
    let catalog: jest.Mocked<Pick<HardwareCatalogService, 'ensureActive'>>;
    let numberer: jest.Mocked<Pick<RequestNumberService, 'generate'>>;
    let dataSource: any;
    let scheduleRepo: any;
    let assetSvc: any;
    let emitter: any;

    const mockCatalogItem = {
        id: 'cat-1',
        code: 'LAPTOP_STD',
        name: 'Laptop Standard',
        category: ItemCategory.LAPTOP,
        defaultSpecs: { ram: '16GB' },
    };

    beforeEach(async () => {
        reqRepo = {
            create: jest.fn((x) => x),
            save: jest.fn((x) => Promise.resolve({ id: 'req-1', ...x })),
            findOne: jest.fn(),
        };
        activityRepo = {
            create: jest.fn((x) => x),
            save: jest.fn((x) => Promise.resolve(x)),
        };
        catalog = {
            ensureActive: jest.fn().mockResolvedValue(mockCatalogItem as any),
        };
        numberer = { generate: jest.fn().mockResolvedValue('HR-2026-0001') };
        dataSource = {
            transaction: jest.fn(async (cb: any) => cb({
                getRepository: (e: any) => (e === HardwareRequest ? reqRepo :
                                           e === HardwareRequestActivity ? activityRepo : reqRepo),
            })),
        };
        scheduleRepo = { findOne: jest.fn() };
        assetSvc = { allAssetsCollected: jest.fn() };
        emitter = { emit: jest.fn() };

        const moduleRef = await Test.createTestingModule({
            providers: [
                HardwareRequestCommandService,
                { provide: getRepositoryToken(HardwareRequest), useValue: reqRepo },
                { provide: getRepositoryToken(HardwareRequestItem), useValue: {} },
                { provide: getRepositoryToken(HardwareRequestActivity), useValue: activityRepo },
                { provide: HardwareCatalogService, useValue: catalog },
                { provide: RequestNumberService, useValue: numberer },
                { provide: DataSource, useValue: dataSource },
                { provide: getRepositoryToken(InstallationSchedule), useValue: scheduleRepo },
                { provide: HardwareAssetService, useValue: assetSvc },
                { provide: EventEmitter2, useValue: emitter },
            ],
        }).compile();
        service = moduleRef.get(HardwareRequestCommandService);
    });

    it('createDraft creates DRAFT request with items and activity', async () => {
        const result = await service.createDraft('user-1', {
            siteId: 'site-1',
            justification: 'Need laptops for new hire onboarding batch',
            items: [{ catalogId: 'cat-1', quantity: 2 }],
        });

        expect(numberer.generate).toHaveBeenCalled();
        expect(catalog.ensureActive).toHaveBeenCalledWith('cat-1');
        expect(reqRepo.save).toHaveBeenCalledWith(expect.objectContaining({
            requestNumber: 'HR-2026-0001',
            requesterId: 'user-1',
            siteId: 'site-1',
            status: RequestStatus.DRAFT,
            items: expect.arrayContaining([
                expect.objectContaining({
                    catalogId: 'cat-1',
                    quantity: 2,
                    categorySnapshot: expect.objectContaining({ code: 'LAPTOP_STD' }),
                }),
            ]),
        }));
        expect(activityRepo.save).toHaveBeenCalledWith(expect.objectContaining({
            action: ActivityAction.CREATED,
            actorId: 'user-1',
            toStatus: RequestStatus.DRAFT,
        }));
        expect(result.id).toBe('req-1');
    });

    it('createDraft rejects inactive catalog item', async () => {
        catalog.ensureActive.mockRejectedValueOnce(new Error('inactive'));
        await expect(
            service.createDraft('user-1', {
                siteId: 'site-1',
                justification: 'x'.repeat(25),
                items: [{ catalogId: 'bad', quantity: 1 }],
            }),
        ).rejects.toThrow();
    });

    // From Task 1.14 Update Draft
    it('updateDraft updates request fields when status=DRAFT and actor=requester', async () => {
        reqRepo.findOne.mockResolvedValue({
            id: 'req-1',
            requesterId: 'user-1',
            status: RequestStatus.DRAFT,
            items: [],
        } as any);

        const updated = await service.updateDraft('user-1', 'req-1', {
            justification: 'Updated justification with enough characters',
        });

        expect(reqRepo.save).toHaveBeenCalledWith(expect.objectContaining({
            id: 'req-1',
            justification: 'Updated justification with enough characters',
        }));
        expect(activityRepo.save).toHaveBeenCalledWith(expect.objectContaining({
            action: ActivityAction.UPDATED,
        }));
    });

    it('updateDraft rejects when actor is not requester', async () => {
        reqRepo.findOne.mockResolvedValue({
            id: 'req-1', requesterId: 'user-1', status: RequestStatus.DRAFT, items: [],
        } as any);
        await expect(
            service.updateDraft('other-user', 'req-1', { justification: 'x'.repeat(25) }),
        ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'HR_PERMISSION_DENIED' }) });
    });

    it('updateDraft rejects when status != DRAFT', async () => {
        reqRepo.findOne.mockResolvedValue({
            id: 'req-1', requesterId: 'user-1', status: RequestStatus.SUBMITTED, items: [],
        } as any);
        await expect(
            service.updateDraft('user-1', 'req-1', { justification: 'x'.repeat(25) }),
        ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'HR_INVALID_TRANSITION' }) });
    });

    // From Task 1.15 Submit
    it('submit transitions DRAFT → SUBMITTED and sets submittedAt', async () => {
        const draft: any = {
            id: 'req-1', requesterId: 'user-1', status: RequestStatus.DRAFT,
            items: [{ id: 'i1' }], justification: 'x'.repeat(25),
        };
        reqRepo.findOne.mockResolvedValue(draft);

        const res = await service.submit('user-1', 'req-1');
        expect(res.status).toBe(RequestStatus.SUBMITTED);
        expect(res.submittedAt).toBeInstanceOf(Date);
        expect(activityRepo.save).toHaveBeenCalledWith(expect.objectContaining({
            action: ActivityAction.SUBMITTED,
            fromStatus: RequestStatus.DRAFT,
            toStatus: RequestStatus.SUBMITTED,
        }));
    });

    it('submit rejects when not in DRAFT', async () => {
        reqRepo.findOne.mockResolvedValue({
            id: 'req-1', requesterId: 'user-1', status: RequestStatus.SUBMITTED, items: [{}],
        } as any);
        await expect(service.submit('user-1', 'req-1')).rejects.toMatchObject({
            response: expect.objectContaining({ code: 'HR_INVALID_TRANSITION' }),
        });
    });

    it('submit rejects when requester mismatched', async () => {
        reqRepo.findOne.mockResolvedValue({
            id: 'req-1', requesterId: 'user-1', status: RequestStatus.DRAFT, items: [{}],
        } as any);
        await expect(service.submit('other', 'req-1')).rejects.toMatchObject({
            response: expect.objectContaining({ code: 'HR_PERMISSION_DENIED' }),
        });
    });

    it('submit rejects when no items', async () => {
        reqRepo.findOne.mockResolvedValue({
            id: 'req-1', requesterId: 'user-1', status: RequestStatus.DRAFT, items: [],
        } as any);
        await expect(service.submit('user-1', 'req-1')).rejects.toThrow(/at least one item/i);
    });

    // From Task 1.16 Cancel
    it('cancel transitions SUBMITTED → CANCELLED (requester only)', async () => {
        const r: any = {
            id: 'req-1', requesterId: 'user-1', status: RequestStatus.SUBMITTED,
            items: [{}],
        };
        reqRepo.findOne.mockResolvedValue(r);
        const res = await service.cancel({ id: 'user-1', role: 'USER' }, 'req-1');
        expect(res.status).toBe(RequestStatus.CANCELLED);
        expect(activityRepo.save).toHaveBeenCalledWith(expect.objectContaining({
            action: ActivityAction.CANCELLED,
            fromStatus: RequestStatus.SUBMITTED,
            toStatus: RequestStatus.CANCELLED,
        }));
    });

    it('cancel rejects if not SUBMITTED', async () => {
        reqRepo.findOne.mockResolvedValue({
            id: 'req-1', requesterId: 'user-1', status: RequestStatus.UNDER_REVIEW, items: [{}],
        } as any);
        await expect(service.cancel({ id: 'user-1', role: 'USER' }, 'req-1')).rejects.toMatchObject({
            response: expect.objectContaining({ code: 'HR_INVALID_TRANSITION' }),
        });
    });

    it('cancel rejects non-requester', async () => {
        reqRepo.findOne.mockResolvedValue({
            id: 'req-1', requesterId: 'user-1', status: RequestStatus.SUBMITTED, items: [{}],
        } as any);
        await expect(service.cancel({ id: 'other', role: 'USER' }, 'req-1')).rejects.toMatchObject({
            response: expect.objectContaining({ code: 'HR_PERMISSION_DENIED' }),
        });
    });

    describe('LEAD transitions', () => {
        it('review transitions SUBMITTED → UNDER_REVIEW and records reviewer', async () => {
            reqRepo.findOne.mockResolvedValue({
                id: 'req-1', status: RequestStatus.SUBMITTED, items: [{}],
            } as any);
            const res = await service.review('lead-1', 'req-1');
            expect(res.status).toBe(RequestStatus.UNDER_REVIEW);
            expect(res.reviewedById).toBe('lead-1');
            expect(res.reviewedAt).toBeInstanceOf(Date);
            expect(activityRepo.save).toHaveBeenCalledWith(expect.objectContaining({
                action: ActivityAction.REVIEWED,
                fromStatus: RequestStatus.SUBMITTED,
                toStatus: RequestStatus.UNDER_REVIEW,
            }));
        });

        it('approve transitions UNDER_REVIEW → APPROVED', async () => {
            reqRepo.findOne.mockResolvedValue({
                id: 'req-1', status: RequestStatus.UNDER_REVIEW, items: [{}],
            } as any);
            const res = await service.approve('lead-1', 'req-1');
            expect(res.status).toBe(RequestStatus.APPROVED);
            expect(res.approvedById).toBe('lead-1');
            expect(res.approvedAt).toBeInstanceOf(Date);
        });

        it('reject transitions UNDER_REVIEW → REJECTED with reason', async () => {
            reqRepo.findOne.mockResolvedValue({
                id: 'req-1', status: RequestStatus.UNDER_REVIEW, items: [{}],
            } as any);
            const res = await service.reject('lead-1', 'req-1', { reason: 'Duplicate' });
            expect(res.status).toBe(RequestStatus.REJECTED);
            expect(res.rejectReason).toBe('Duplicate');
            expect(activityRepo.save).toHaveBeenCalledWith(expect.objectContaining({
                action: ActivityAction.REJECTED,
                metadata: expect.objectContaining({ reason: 'Duplicate' }),
            }));
        });

        it('review rejects from non-SUBMITTED', async () => {
            reqRepo.findOne.mockResolvedValue({
                id: 'req-1', status: RequestStatus.APPROVED, items: [{}],
            } as any);
            await expect(service.review('lead-1', 'req-1')).rejects.toMatchObject({
                response: expect.objectContaining({ code: 'HR_INVALID_TRANSITION' }),
            });
        });

        it('approve rejects from non-UNDER_REVIEW', async () => {
            reqRepo.findOne.mockResolvedValue({
                id: 'req-1', status: RequestStatus.SUBMITTED, items: [{}],
            } as any);
            await expect(service.approve('lead-1', 'req-1')).rejects.toMatchObject({
                response: expect.objectContaining({ code: 'HR_INVALID_TRANSITION' }),
            });
        });
    });

    describe('PROCUREMENT transitions', () => {
        const approvedReq = {
            id: 'req-1', status: RequestStatus.APPROVED, items: [
                { id: 'i1', quantity: 1, actualCost: null, vendor: null, invoiceNumber: null },
            ],
        };

        beforeEach(() => {
            reqRepo.findOne.mockResolvedValue(JSON.parse(JSON.stringify(approvedReq)));
        });

        it('updateItem auto-enters PROCUREMENT from APPROVED when first patch arrives', async () => {
            const res = await service.updateItem('proc-1', 'req-1', 'i1', {
                actualCost: 15000000, vendor: 'Acme', invoiceNumber: 'INV-001',
            });
            expect(res.status).toBe(RequestStatus.PROCUREMENT);
            expect(res.items[0].actualCost).toBe('15000000.00');
            expect(res.items[0].vendor).toBe('Acme');
            expect(activityRepo.save).toHaveBeenCalledWith(expect.objectContaining({
                action: ActivityAction.PROCUREMENT_UPDATED,
                metadata: expect.objectContaining({ itemId: 'i1' }),
            }));
        });

        it('updateItem keeps status PROCUREMENT on subsequent patches', async () => {
            reqRepo.findOne.mockResolvedValue({
                ...approvedReq, status: RequestStatus.PROCUREMENT,
            });
            const res = await service.updateItem('proc-1', 'req-1', 'i1', { vendor: 'Bravo' });
            expect(res.status).toBe(RequestStatus.PROCUREMENT);
        });

        it('updateItem forbids edits in non-APPROVED/non-PROCUREMENT status', async () => {
            reqRepo.findOne.mockResolvedValue({
                ...approvedReq, status: RequestStatus.SUBMITTED,
            });
            await expect(
                service.updateItem('proc-1', 'req-1', 'i1', { vendor: 'x' }),
            ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'HR_INVALID_TRANSITION' }) });
        });


    });

    describe('completeInstallation (request transition)', () => {
        it('INSTALLATION → COMPLETED when schedule DONE', async () => {
            reqRepo.findOne.mockResolvedValue({
                id: 'r1', status: RequestStatus.INSTALLATION, items: [{ id: 'i1', quantity: 1 }],
            });
            scheduleRepo.findOne.mockResolvedValue({ status: InstallStatus.DONE });

            const res = await service.completeInstallation('r1', { id: 't1', role: 'ICT_STAFF' });
            expect(res.status).toBe(RequestStatus.COMPLETED);
            expect(emitter.emit).toHaveBeenCalled();
        });

        it('blocks when schedule not DONE', async () => {
            reqRepo.findOne.mockResolvedValue({ id: 'r1', status: RequestStatus.INSTALLATION, items: [] });
            // Implementation queries findOne({ where: { requestId, status: DONE } }), returns null when no DONE schedule
            scheduleRepo.findOne.mockResolvedValue(null);
            await expect(service.completeInstallation('r1', { id: 't1', role: 'ICT_STAFF' }))
                .rejects.toThrow(/schedule not done/i);
        });
    });
});
