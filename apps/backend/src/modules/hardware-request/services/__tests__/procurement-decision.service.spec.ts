import { Test } from '@nestjs/testing';
import { DataSource, Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ProcurementDecisionService } from '../procurement-decision.service';
import { HardwareRequest } from '../../domain/entities/hardware-request.entity';
import { HardwareRequestItem } from '../../domain/entities/hardware-request-item.entity';
import { RequestStatus } from '../../domain/enums/request-status.enum';

describe('ProcurementDecisionService', () => {
  let service: ProcurementDecisionService;
  let mockItemRepo: jest.Mocked<Repository<HardwareRequestItem>>;
  let mockReqRepo: jest.Mocked<Repository<HardwareRequest>>;
  let mockEmitter: jest.Mocked<EventEmitter2>;
  let mockDataSource: jest.Mocked<DataSource>;

  beforeEach(async () => {
    mockItemRepo = { findBy: jest.fn(), save: jest.fn((x) => x) } as any;
    mockReqRepo = { findOne: jest.fn(), save: jest.fn((x) => x) } as any;
    mockEmitter = { emit: jest.fn() } as any;
    mockDataSource = {
      transaction: jest.fn((cb: any) => cb({
        getRepository: (e: any) => {
          if (e === HardwareRequestItem) return mockItemRepo;
          if (e === HardwareRequest) return mockReqRepo;
          return {};
        },
      })),
    } as any;

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
});
