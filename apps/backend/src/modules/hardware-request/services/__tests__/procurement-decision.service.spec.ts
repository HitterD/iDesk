import { Test } from '@nestjs/testing';
import { DataSource, Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ProcurementDecisionService } from '../procurement-decision.service';
import { HardwareRequest } from '../../domain/entities/hardware-request.entity';
import { HardwareRequestItem } from '../../domain/entities/hardware-request-item.entity';
import { HardwareRequestActivity } from '../../domain/entities/hardware-request-activity.entity';
import { RequestStatus } from '../../domain/enums/request-status.enum';
import { BadRequestException } from '@nestjs/common';

describe('ProcurementDecisionService', () => {
  let service: ProcurementDecisionService;
  let mockItemRepo: jest.Mocked<Repository<HardwareRequestItem>>;
  let mockReqRepo: jest.Mocked<Repository<HardwareRequest>>;
  let mockEmitter: jest.Mocked<EventEmitter2>;
  let mockDataSource: jest.Mocked<DataSource>;
  let mockActivityRepo: { create: jest.Mock; save: jest.Mock };
  let txManager: { getRepository: (e: unknown) => unknown };

  beforeEach(async () => {
    mockItemRepo = { findBy: jest.fn(), save: jest.fn((x) => x) } as any;
    mockReqRepo = { findOne: jest.fn(), save: jest.fn((x) => x) } as any;
    mockEmitter = { emit: jest.fn() } as any;
    mockActivityRepo = { create: jest.fn((x) => x), save: jest.fn(async (x) => x) };
    txManager = {
      getRepository: (e: any) => {
        if (e === HardwareRequestItem) return mockItemRepo;
        if (e === HardwareRequest) return mockReqRepo;
        if (e === HardwareRequestActivity) return mockActivityRepo;
        return {};
      },
    };
    mockDataSource = { transaction: jest.fn((cb: any) => cb(txManager)) } as any;

    const moduleRef = await Test.createTestingModule({
      providers: [
        ProcurementDecisionService,
        { provide: getRepositoryToken(HardwareRequestItem), useValue: mockItemRepo },
        { provide: getRepositoryToken(HardwareRequest), useValue: mockReqRepo },
        { provide: EventEmitter2, useValue: mockEmitter },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = moduleRef.get(ProcurementDecisionService);
  });

  describe('decideItems', () => {
    it('persists decisions for valid items', async () => {
      mockReqRepo.findOne.mockResolvedValue({ id: 'r1', status: RequestStatus.PROCUREMENT } as any);
      mockItemRepo.findBy.mockResolvedValue([
        { id: 'i1', requestId: 'r1' } as any,
        { id: 'i2', requestId: 'r1' } as any,
      ]);

      await service.decideItems('r1', {
        decisions: [
          { itemId: 'i1', decision: 'APPROVED' },
          { itemId: 'i2', decision: 'REJECTED' },
        ],
      }, 'user-1');

      expect(mockItemRepo.save).toHaveBeenCalledWith(expect.arrayContaining([
        expect.objectContaining({ id: 'i1', procurementDecision: 'APPROVED', procurementDecidedBy: 'user-1' }),
        expect.objectContaining({ id: 'i2', procurementDecision: 'REJECTED' }),
      ]));
    });

    it('rejects when item not in request', async () => {
      mockReqRepo.findOne.mockResolvedValue({ id: 'r1', status: RequestStatus.PROCUREMENT } as any);
      mockItemRepo.findBy.mockResolvedValue([{ id: 'i-other', requestId: 'other-r' } as any]);
      await expect(service.decideItems('r1', {
        decisions: [{ itemId: 'i-other', decision: 'APPROVED' }],
      }, 'user-1')).rejects.toThrow(/item not in request/i);
    });
  });

  describe('completeProcurement', () => {
    it('transitions to AWAITING_DELIVERY when ≥1 APPROVED', async () => {
      mockReqRepo.findOne.mockResolvedValue({
        id: 'r1', status: RequestStatus.PROCUREMENT, items: [
          { id: 'i1', procurementDecision: 'APPROVED', deliveryStatus: 'PENDING' },
          { id: 'i2', procurementDecision: 'REJECTED', deliveryStatus: 'PENDING' },
        ],
      } as any);

      const result = await service.completeProcurement('r1', {}, 'ict-1');

      expect(result.status).toBe(RequestStatus.AWAITING_DELIVERY);
      expect(mockEmitter.emit).toHaveBeenCalledWith('procurement.completed', expect.any(Object));
    });

    it('transitions to REJECTED when all REJECTED + reason given', async () => {
      mockReqRepo.findOne.mockResolvedValue({
        id: 'r1', status: RequestStatus.PROCUREMENT, items: [
          { id: 'i1', procurementDecision: 'REJECTED' },
        ],
      } as any);

      const result = await service.completeProcurement('r1', { rejectReason: 'no stock' }, 'ict-1');

      expect(result.status).toBe(RequestStatus.REJECTED);
    });

    it('throws if any item undecided', async () => {
      mockReqRepo.findOne.mockResolvedValue({
        id: 'r1', status: RequestStatus.PROCUREMENT, items: [
          { id: 'i1', procurementDecision: 'APPROVED' },
          { id: 'i2', procurementDecision: null },
        ],
      } as any);

      await expect(service.completeProcurement('r1', {}, 'ict-1'))
        .rejects.toThrow(/undecided items/i);
    });

    it('throws if all REJECTED but no reason', async () => {
      mockReqRepo.findOne.mockResolvedValue({
        id: 'r1', status: RequestStatus.PROCUREMENT, items: [
          { id: 'i1', procurementDecision: 'REJECTED' },
        ],
      } as any);

      await expect(service.completeProcurement('r1', {}, 'ict-1'))
        .rejects.toThrow(/reason required/i);
    });
  });

  describe('completion events', () => {
    it('procurement completion emits PROCUREMENT_DONE for the listeners', async () => {
      mockReqRepo.findOne.mockResolvedValue({
        id: 'r1', requesterId: 'u1', status: RequestStatus.PROCUREMENT, items: [{ id: 'i1', procurementDecision: 'APPROVED' }],
      } as any);

      await service.completeProcurement('r1', {}, 'ict-1');

      expect(mockEmitter.emit).toHaveBeenCalledWith('hardware-request.procurement.completed', expect.objectContaining({ requestId: 'r1', requesterId: 'u1' }));
      expect(mockEmitter.emit).toHaveBeenCalledWith('procurement.completed', expect.objectContaining({ requestId: 'r1' }));
    });

    it('does not announce a finished procurement when everything was rejected', async () => {
      mockReqRepo.findOne.mockResolvedValue({
        id: 'r1', requesterId: 'u1', status: RequestStatus.PROCUREMENT, items: [{ id: 'i1', procurementDecision: 'REJECTED' }],
      } as any);

      await service.completeProcurement('r1', { rejectReason: 'no stock' }, 'ict-1');

      expect(mockEmitter.emit).not.toHaveBeenCalledWith('hardware-request.procurement.completed', expect.anything());
    });

    it('keeps the completion note in the activity metadata', async () => {
      mockReqRepo.findOne.mockResolvedValue({
        id: 'r1', requesterId: 'u1', status: RequestStatus.PROCUREMENT, items: [{ id: 'i1', procurementDecision: 'APPROVED' }],
      } as any);

      await service.completeProcurement('r1', { note: 'vendor kirim Jumat' }, 'ict-1');

      expect(mockActivityRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        requestId: 'r1', actorId: 'ict-1', metadata: expect.objectContaining({ note: 'vendor kirim Jumat' }),
      }));
    });
  });

  describe('recordWith (per-item procurement)', () => {
    const units = () => [
      { id: 'i1', requestId: 'r1', procurementDecision: null, deliveryStatus: 'PENDING' },
      { id: 'i2', requestId: 'r1', procurementDecision: null, deliveryStatus: 'PENDING' },
      { id: 'i3', requestId: 'r1', procurementDecision: null, deliveryStatus: 'PENDING' },
    ];
    const request = (items: any[] = units(), status = RequestStatus.PROCUREMENT) =>
      ({ id: 'r1', requesterId: 'u1', status, items }) as any;

    it('procurement stores vendor, cost and invoice per item', async () => {
      mockReqRepo.findOne.mockResolvedValue(request());

      const outcome = await service.recordWith(txManager as any, 'r1', 'ict-1', {
        lines: [
          { itemIds: ['i1', 'i2'], decision: 'APPROVED', vendor: ' CV Sinar ', unitCost: 12400000, invoiceNumber: 'INV-1', invoiceDate: '2026-11-20' },
          { itemIds: ['i3'], decision: 'REJECTED' },
        ],
      });

      const saved = mockItemRepo.save.mock.calls[0][0] as any[];
      const first = saved.find((i) => i.id === 'i1');
      expect(first).toMatchObject({
        procurementDecision: 'APPROVED', vendor: 'CV Sinar', actualCost: '12400000.00', invoiceNumber: 'INV-1',
        deliveryStatus: 'PENDING', procurementDecidedBy: 'ict-1',
      });
      expect(first.invoiceDate).toEqual(new Date('2026-11-20'));
      expect(saved.find((i) => i.id === 'i3')).toMatchObject({ procurementDecision: 'REJECTED', deliveryStatus: 'NOT_PROCURED' });
      expect(outcome.request.status).toBe(RequestStatus.AWAITING_DELIVERY);
      expect(outcome).toMatchObject({ approvedItems: 2, rejectedItems: 1 });
    });

    it('all items rejected needs a note', async () => {
      const lines = [{ itemIds: ['i1', 'i2', 'i3'], decision: 'REJECTED' as const }];
      mockReqRepo.findOne.mockResolvedValue(request());
      await expect(service.recordWith(txManager as any, 'r1', 'ict-1', { lines })).rejects.toThrow('Isi alasan penolakan');
      mockReqRepo.findOne.mockResolvedValue(request());
      await expect(service.recordWith(txManager as any, 'r1', 'ict-1', { lines, note: 'abc' })).rejects.toThrow('Isi alasan penolakan');

      mockReqRepo.findOne.mockResolvedValue(request());
      const done = await service.recordWith(txManager as any, 'r1', 'ict-1', { lines, note: 'Stok vendor habis' });
      expect(done.request.status).toBe(RequestStatus.REJECTED);
      expect(done.request.rejectReason).toBe('Stok vendor habis');
    });

    it('lines must cover every undecided unit exactly once', async () => {
      const approve = (itemIds: string[]) => ({ itemIds, decision: 'APPROVED' as const, vendor: 'V', unitCost: 1 });
      const attempt = async (lines: any[]) => {
        mockReqRepo.findOne.mockResolvedValue(request());
        return service.recordWith(txManager as any, 'r1', 'a', { lines });
      };

      await expect(attempt([approve(['i1', 'i2'])])).rejects.toThrow(BadRequestException);
      await expect(attempt([approve(['i1', 'i2', 'i3']), approve(['i1'])])).rejects.toThrow(BadRequestException);
      await expect(attempt([approve(['i1', 'i2', 'i3', 'zzz'])])).rejects.toThrow(BadRequestException);
    });

    it('a purchased line needs vendor and cost', async () => {
      mockReqRepo.findOne.mockResolvedValue(request());
      await expect(service.recordWith(txManager as any, 'r1', 'a', {
        lines: [{ itemIds: ['i1', 'i2', 'i3'], decision: 'APPROVED', vendor: 'V' }],
      })).rejects.toThrow('Vendor dan harga wajib diisi untuk barang yang dibeli');
    });

    it('saves the note in the activity metadata', async () => {
      mockReqRepo.findOne.mockResolvedValue(request());
      await service.recordWith(txManager as any, 'r1', 'ict-1', {
        lines: [{ itemIds: ['i1', 'i2', 'i3'], decision: 'APPROVED', vendor: 'V', unitCost: 5 }], note: 'dibayar tunai',
      });
      expect(mockActivityRepo.create).toHaveBeenCalledWith(expect.objectContaining({ metadata: expect.objectContaining({ note: 'dibayar tunai' }) }));
    });

    it('refuses a request that is not waiting for procurement', async () => {
      mockReqRepo.findOne.mockResolvedValue(request(units(), RequestStatus.AWAITING_DELIVERY));
      await expect(service.recordWith(txManager as any, 'r1', 'a', { lines: [] })).rejects.toThrow(BadRequestException);
    });
  });
});
