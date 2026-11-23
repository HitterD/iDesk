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
import { HandlingSiteService } from '../../sites/handling-site.service';
describe('HardwareRequestCommandService', () => {
    let service: HardwareRequestCommandService;
    let reqRepo: any;
    let activityRepo: any;
    let catalog: jest.Mocked<Pick<HardwareCatalogService, 'ensureActive' | 'assertRequiredFields'>>;
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
            assertRequiredFields: jest.fn(),
        };
        numberer = { generate: jest.fn().mockResolvedValue('HR-2026-0001') };
        dataSource = {
            flowQuery: jest.fn().mockResolvedValue([]),
            transaction: jest.fn(async (cb: any) => cb({
                query: dataSource.flowQuery,
                getRepository: (e: any) => (e === HardwareRequest ? reqRepo :
                                           e === HardwareRequestItem ? reqRepo :
                                           e === HardwareRequestActivity ? activityRepo :
                                           e === InstallationSchedule ? scheduleRepo : {}),
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
                { provide: HandlingSiteService, useValue: { handlingSiteId: jest.fn(async (id: string) => id === 'site-skd' ? 'site-spj' : id) } },
            ],
        }).compile();
        service = moduleRef.get(HardwareRequestCommandService);
    });

    it.each(['ACCEPT_AS_IS', 'REPORT_ISSUE'] as const)('rejects legacy %s for a unified request before any writes', async (kind) => {
        dataSource.flowQuery.mockResolvedValue([{ id: 'flow-1' }]);
        reqRepo.findOne.mockResolvedValue({ id: 'req-1', requesterId: 'user-1', status: RequestStatus.AWAITING_USER_CONFIRMATION });

        await expect(service.confirmInstallation('req-1', 'user-1', { kind, comments: 'Perangkat belum berfungsi' }))
            .rejects.toMatchObject({ status: 409 });
        expect(reqRepo.save).not.toHaveBeenCalled();
        expect(activityRepo.save).not.toHaveBeenCalled();
        expect(emitter.emit).not.toHaveBeenCalled();
    });

    it('allows a legacy request without a flow to complete', async () => {
        reqRepo.findOne.mockResolvedValue({ id: 'req-1', requesterId: 'user-1', status: RequestStatus.AWAITING_USER_CONFIRMATION });

        await expect(service.confirmInstallation('req-1', 'user-1', { kind: 'ACCEPT_AS_IS' }))
            .resolves.toMatchObject({ status: RequestStatus.COMPLETED });
    });

    it('createDraft creates DRAFT request with items and activity', async () => {
        const result = await service.createDraft('user-1', 'site-1', 'AGENT' as any, {
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
                    quantity: 1,
                    categorySnapshot: expect.objectContaining({ code: 'LAPTOP_STD' }),
                }),
                expect.objectContaining({
                    catalogId: 'cat-1',
                    quantity: 1,
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

    it('routes an SKD hardware request to SPJ without changing its requester', async () => {
        const result = await service.createDraft('user-skd', 'site-skd', 'USER' as any, {
            justification: 'New laptop for Sukodono employee',
            items: [{ catalogId: 'cat-1', quantity: 1 }],
        });
        expect(result).toEqual(expect.objectContaining({ requesterId: 'user-skd', siteId: 'site-spj' }));
    });

    it('createDraft rejects inactive catalog item', async () => {
        catalog.ensureActive.mockRejectedValueOnce(new Error('inactive'));
        await expect(
            service.createDraft('user-1', 'site-1', 'AGENT' as any, {
                siteId: 'site-1',
                justification: 'x'.repeat(25),
                items: [{ catalogId: 'bad', quantity: 1 }],
            }),
        ).rejects.toThrow();
    });

    it('createDraft checks the catalog item required fields against what was filled', async () => {
        catalog.assertRequiredFields.mockImplementationOnce(() => { throw new Error('Isian "Nama software" wajib untuk Lisensi Software'); });
        await expect(service.createDraft('user-1', 'site-1', 'AGENT' as any, {
            justification: 'Lisensi untuk tim desain',
            items: [{ catalogId: 'cat-1', quantity: 1, customFields: { software: '' } }],
        })).rejects.toThrow('Isian "Nama software" wajib untuk Lisensi Software');
        expect(catalog.assertRequiredFields).toHaveBeenCalledWith(mockCatalogItem, { software: '' });
        expect(reqRepo.save).not.toHaveBeenCalled();
    });

    it('createDraftWith stores a manual item without catalog, one row per unit', async () => {
        const mgr = { getRepository: (e: any) => (e === HardwareRequestActivity ? activityRepo : reqRepo) };
        await service.createDraftWith(mgr as any, 'user-1', 'site-1', 'USER' as any, {
            justification: 'Docking untuk meeting room',
            items: [{ manualName: 'Docking USB-C', quantity: 2, notes: 'Port HDMI', recipientName: 'Andi', customFields: { recipientName: 'Andi' } }],
        });
        const unit = { catalogId: null, quantity: 1, notes: 'Port HDMI', recipientName: 'Andi', categorySnapshot: {
            code: null, name: 'Docking USB-C', category: ItemCategory.OTHER, specs: {}, customFields: { recipientName: 'Andi' },
        } };
        expect(reqRepo.save).toHaveBeenCalledWith(expect.objectContaining({ items: [unit, unit] }));
        expect(catalog.ensureActive).not.toHaveBeenCalled();
    });

    it('createDraftWith keeps replacesName on the unit snapshot', async () => {
        const mgr = { getRepository: (e: any) => (e === HardwareRequestActivity ? activityRepo : reqRepo) };
        await service.createDraftWith(mgr as any, 'user-1', 'site-1', 'USER' as any, {
            justification: 'Ganti mouse rusak',
            items: [{ manualName: 'Mouse baru', quantity: 1, replacesName: 'Mouse lama' }],
        });
        const [{ items }] = reqRepo.save.mock.calls[reqRepo.save.mock.calls.length - 1];
        expect(items[0].categorySnapshot).toMatchObject({ name: 'Mouse baru', replaces: 'Mouse lama' });
    });

    it('createDraftWith links the ticket and keeps the requester signature on the CREATED activity', async () => {
        const mgr = { getRepository: (e: any) => (e === HardwareRequestActivity ? activityRepo : reqRepo) };
        await service.createDraftWith(mgr as any, 'user-1', 'site-1', 'USER' as any, {
            justification: 'Laptop staf baru',
            items: [{ catalogId: 'cat-1', quantity: 1 }],
        }, { sourceTicketId: 't-1', requesterSignature: 'data:image/png;base64,AAA' });
        expect(reqRepo.save).toHaveBeenCalledWith(expect.objectContaining({ sourceTicketId: 't-1', proposedById: null }));
        expect(activityRepo.save).toHaveBeenCalledWith(expect.objectContaining({
            action: ActivityAction.CREATED,
            actorId: 'user-1',
            metadata: { requestNumber: 'HR-2026-0001', sourceTicketId: 't-1', signature: 'data:image/png;base64,AAA' },
        }));
    });

    // From Task 1.14 Update Draft
    it('updateDraft updates request fields when status=DRAFT and actor=requester', async () => {
        reqRepo.findOne.mockResolvedValue({
            id: 'req-1',
            requesterId: 'user-1',
            status: RequestStatus.DRAFT,
            items: [],
        } as any);

        const updated = await service.updateDraft('user-1', 'site-1', 'AGENT' as any, 'req-1', {
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
            service.updateDraft('other-user', 'site-1', 'AGENT' as any, 'req-1', { justification: 'x'.repeat(25) }),
        ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'HR_PERMISSION_DENIED' }) });
    });

    it('updateDraft rejects when status != DRAFT', async () => {
        reqRepo.findOne.mockResolvedValue({
            id: 'req-1', requesterId: 'user-1', status: RequestStatus.SUBMITTED, items: [],
        } as any);
        await expect(
            service.updateDraft('user-1', 'site-1', 'AGENT' as any, 'req-1', { justification: 'x'.repeat(25) }),
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

    it('submit transitions directly to INSTALLATION and marks items as ARRIVED when justification contains [PENJADWALAN PEMASANGAN]', async () => {
        const item1: any = { id: 'it-1', deliveryStatus: 'PENDING' };
        reqRepo.findOne.mockResolvedValue({
            id: 'req-inst-1', requesterId: 'user-1', status: RequestStatus.DRAFT, items: [item1],
            justification: '[PENJADWALAN PEMASANGAN] Pasang unit monitor cadangan',
        } as any);
        const res = await service.submit('user-1', 'req-inst-1');
        expect(res.status).toBe(RequestStatus.INSTALLATION);
        expect(res.approvedAt).toBeInstanceOf(Date);
        expect(item1.deliveryStatus).toBe('ARRIVED');
        expect(item1.arrivedAt).toBeInstanceOf(Date);
        expect(activityRepo.save).toHaveBeenCalledWith(expect.objectContaining({
            action: ActivityAction.SUBMITTED,
            fromStatus: RequestStatus.DRAFT,
            toStatus: RequestStatus.INSTALLATION,
        }));
    });

    it('submitWith keeps SUBMITTED and emits nothing when direct installation is not allowed', async () => {
        const item1: any = { id: 'it-1', deliveryStatus: 'PENDING' };
        reqRepo.findOne.mockResolvedValue({
            id: 'req-2', requesterId: 'user-1', status: RequestStatus.DRAFT, items: [item1],
            justification: '[PENJADWALAN PEMASANGAN] tetap direview IT',
        } as any);
        const mgr = { getRepository: (e: any) => (e === HardwareRequestActivity ? activityRepo : reqRepo) };
        const res = await service.submitWith(mgr as any, 'user-1', 'req-2', { allowDirectInstallation: false });
        expect(res.status).toBe(RequestStatus.SUBMITTED);
        expect(res.approvedAt).toBeUndefined();
        expect(item1.deliveryStatus).toBe('PENDING');
        expect(emitter.emit).not.toHaveBeenCalled();
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

    describe('cancelWith for a request flow (the flow decides who may cancel when)', () => {
        const mgr = () => ({ query: jest.fn(async () => undefined), getRepository: (e: any) => (e === HardwareRequestActivity ? activityRepo : reqRepo) });
        const FLOW_REQUESTER_STATES = [RequestStatus.SUBMITTED, RequestStatus.UNDER_REVIEW];
        const FLOW_IT_STATES = [RequestStatus.SUBMITTED, RequestStatus.UNDER_REVIEW, RequestStatus.APPROVED, RequestStatus.PROCUREMENT, RequestStatus.AWAITING_DELIVERY, RequestStatus.INSTALLATION];

        it.each(FLOW_REQUESTER_STATES)('the requester can withdraw a flow request that is %s', async (status) => {
            reqRepo.findOne.mockResolvedValue({ id: 'req-1', requesterId: 'user-1', status, items: [{}] } as any);
            const { saved } = await service.cancelWith(mgr() as any, { id: 'user-1', role: 'USER' }, 'req-1', { allowed: FLOW_REQUESTER_STATES });
            expect(saved.status).toBe(RequestStatus.CANCELLED);
        });

        it.each(FLOW_IT_STATES)('IT can cancel a flow request that is %s', async (status) => {
            reqRepo.findOne.mockResolvedValue({ id: 'req-1', requesterId: 'user-1', status, items: [{}] } as any);
            const { saved } = await service.cancelWith(mgr() as any, { id: 'it-1', role: 'ICT_STAFF' }, 'req-1', { allowed: FLOW_IT_STATES });
            expect(saved.status).toBe(RequestStatus.CANCELLED);
        });

        it('still refuses a state the flow did not allow', async () => {
            reqRepo.findOne.mockResolvedValue({ id: 'req-1', requesterId: 'user-1', status: RequestStatus.COMPLETED, items: [{}] } as any);
            await expect(service.cancelWith(mgr() as any, { id: 'it-1', role: 'ICT_STAFF' }, 'req-1', { allowed: FLOW_IT_STATES })).rejects.toThrow();
        });

        it('cancelling closes the open installation schedules of the request, so nobody can still pick a slot', async () => {
            reqRepo.findOne.mockResolvedValue({ id: 'req-1', requesterId: 'user-1', status: RequestStatus.INSTALLATION, items: [{}] } as any);
            const query = jest.fn(async () => undefined);
            await service.cancelWith({ ...mgr(), query } as any, { id: 'it-1', role: 'ICT_STAFF' }, 'req-1', { allowed: FLOW_IT_STATES });
            const [sql, params] = query.mock.calls[0] as unknown as [string, unknown[]];
            expect(sql).toContain('installation_schedules');
            expect(sql).toContain("'CANCELLED'");
            expect(params).toEqual(['req-1']);
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

        it('reject also works on a request IT has not started reviewing (SUBMITTED): IT may refuse it straight away', async () => {
            reqRepo.findOne.mockResolvedValue({ id: 'req-1', status: RequestStatus.SUBMITTED, items: [{}] } as any);
            const res = await service.reject('lead-1', 'req-1', { reason: 'Tidak sesuai kebijakan' });
            expect(res.status).toBe(RequestStatus.REJECTED);
            expect(activityRepo.save).toHaveBeenCalledWith(expect.objectContaining({
                action: ActivityAction.REJECTED, fromStatus: RequestStatus.SUBMITTED, toStatus: RequestStatus.REJECTED,
            }));
        });

        it.each([RequestStatus.APPROVED, RequestStatus.PROCUREMENT, RequestStatus.INSTALLATION, RequestStatus.COMPLETED])('reject is still refused from %s', async (status) => {
            reqRepo.findOne.mockResolvedValue({ id: 'req-1', status, items: [{}] } as any);
            await expect(service.reject('lead-1', 'req-1', { reason: 'x' })).rejects.toThrow();
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
        it('INSTALLATION → AWAITING_USER_CONFIRMATION when schedule DONE', async () => {
            reqRepo.findOne.mockResolvedValue({
                id: 'r1', status: RequestStatus.INSTALLATION, items: [{ id: 'i1', quantity: 1 }],
            });
            scheduleRepo.findOne.mockResolvedValue({ status: InstallStatus.DONE });

            const res = await service.completeInstallation('r1', { id: 't1', role: 'ICT_STAFF' });
            expect(scheduleRepo.findOne).toHaveBeenCalledWith({
                where: { requestId: 'r1', status: InstallStatus.DONE },
                order: { createdAt: 'DESC' },
            });
            expect(res.status).toBe(RequestStatus.AWAITING_USER_CONFIRMATION);
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

    describe('autoConfirmInstallation', () => {
        it('transitions AWAITING_USER_CONFIRMATION to COMPLETED and creates activity with null actorId', async () => {
            reqRepo.findOne.mockResolvedValue({
                id: 'r1',
                status: RequestStatus.AWAITING_USER_CONFIRMATION,
                requesterId: 'user-1',
            });

            const res = await service.autoConfirmInstallation('r1');

            expect(res.status).toBe(RequestStatus.COMPLETED);
            expect(res.userConfirmationKind).toBe('ACCEPT_AS_IS');
            expect(activityRepo.save).toHaveBeenCalledWith(expect.objectContaining({
                requestId: 'r1',
                actorId: null,
                action: ActivityAction.USER_CONFIRMED,
                fromStatus: RequestStatus.AWAITING_USER_CONFIRMATION,
                toStatus: RequestStatus.COMPLETED,
                metadata: { kind: 'AUTO', reason: 'TTL_EXCEEDED_24H' },
            }));
            expect(emitter.emit).toHaveBeenCalledWith('hardware-request.install.completed', expect.objectContaining({
                requestId: 'r1',
                actorId: null,
                auto: true,
            }));
        });

        it('throws error when request is not in AWAITING_USER_CONFIRMATION', async () => {
            reqRepo.findOne.mockResolvedValue({
                id: 'r1',
                status: RequestStatus.INSTALLATION,
            });

            await expect(service.autoConfirmInstallation('r1'))
                .rejects.toThrow();
        });
    });
});
