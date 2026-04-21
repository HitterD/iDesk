import { Test } from '@nestjs/testing';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DeliveryTrackingService } from '../delivery-tracking.service';
import { HardwareRequestItem } from '../../domain/entities/hardware-request-item.entity';

describe('DeliveryTrackingService', () => {
  let service: DeliveryTrackingService;
  let mockRepo: jest.Mocked<Repository<HardwareRequestItem>>;
  let mockEmitter: jest.Mocked<EventEmitter2>;

  beforeEach(async () => {
    mockRepo = { findOne: jest.fn(), save: jest.fn() } as any;
    mockEmitter = { emit: jest.fn() } as any;

    const moduleRef = await Test.createTestingModule({
      providers: [
        DeliveryTrackingService,
        { provide: getRepositoryToken(HardwareRequestItem), useValue: mockRepo },
        { provide: EventEmitter2, useValue: mockEmitter },
      ],
    }).compile();

    service = moduleRef.get(DeliveryTrackingService);
  });

  it('marks item as ARRIVED + sets arrivedAt + emits event', async () => {
    mockRepo.findOne.mockResolvedValue({
      id: 'i1', requestId: 'r1', name: 'Monitor',
      deliveryStatus: 'PENDING', procurementDecision: 'APPROVED',
      request: { id: 'r1', requesterId: 'u1' },
    } as any);
    mockRepo.save.mockImplementation(async (x: any) => x);

    const result = await service.updateDelivery('r1', 'i1', { status: 'ARRIVED' });

    expect(result.deliveryStatus).toBe('ARRIVED');
    expect(result.arrivedAt).toBeInstanceOf(Date);
    expect(mockEmitter.emit).toHaveBeenCalledWith('hardware-item.arrived', expect.objectContaining({
      requestId: 'r1', itemId: 'i1', ownerId: 'u1',
    }));
  });

  it('reverts ARRIVED → PENDING + clears arrivedAt', async () => {
    mockRepo.findOne.mockResolvedValue({
      id: 'i1', requestId: 'r1',
      deliveryStatus: 'ARRIVED', arrivedAt: new Date(),
      procurementDecision: 'APPROVED',
      request: { id: 'r1', userId: 'u1' },
    } as any);
    mockRepo.save.mockImplementation(async (x: any) => x);

    const result = await service.updateDelivery('r1', 'i1', { status: 'PENDING' });
    expect(result.deliveryStatus).toBe('PENDING');
    expect(result.arrivedAt).toBeNull();
  });

  it('rejects update when item is NOT_PROCURED', async () => {
    mockRepo.findOne.mockResolvedValue({
      id: 'i1', requestId: 'r1',
      deliveryStatus: 'NOT_PROCURED', procurementDecision: 'REJECTED',
    } as any);

    await expect(service.updateDelivery('r1', 'i1', { status: 'ARRIVED' }))
      .rejects.toThrow(/cannot update non-procured/i);
  });

  it('rejects update when item not in request', async () => {
    mockRepo.findOne.mockResolvedValue({
      id: 'i1', requestId: 'other', deliveryStatus: 'PENDING',
      procurementDecision: 'APPROVED',
    } as any);

    await expect(service.updateDelivery('r1', 'i1', { status: 'ARRIVED' }))
      .rejects.toThrow(/not in request/i);
  });
});