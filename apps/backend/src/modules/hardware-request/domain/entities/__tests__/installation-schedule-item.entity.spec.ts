import { InstallationScheduleItem } from '../installation-schedule-item.entity';

describe('InstallationScheduleItem entity', () => {
  it('exposes scheduleId + itemId for join', () => {
    const link = new InstallationScheduleItem();
    link.scheduleId = '11111111-1111-1111-1111-111111111111';
    link.itemId = '22222222-2222-2222-2222-222222222222';
    expect(link.scheduleId).toBeDefined();
    expect(link.itemId).toBeDefined();
  });
});
