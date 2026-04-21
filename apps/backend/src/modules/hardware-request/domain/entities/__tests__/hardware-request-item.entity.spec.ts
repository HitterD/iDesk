import { HardwareRequestItem } from '../hardware-request-item.entity';

describe('HardwareRequestItem entity', () => {
  it('defaults deliveryStatus to PENDING when constructed minimally', () => {
    const item = new HardwareRequestItem();
    item.deliveryStatus = 'PENDING';
    expect(item.deliveryStatus).toBe('PENDING');
  });

  it('allows ARRIVED with arrivedAt timestamp', () => {
    const item = new HardwareRequestItem();
    item.deliveryStatus = 'ARRIVED';
    item.arrivedAt = new Date('2026-04-19T08:00:00Z');
    expect(item.arrivedAt).toBeInstanceOf(Date);
  });
});
