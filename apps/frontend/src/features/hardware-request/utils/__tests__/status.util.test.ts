import { INSTALL_STATUS_CHIP } from '../status.util';
import type { InstallStatus } from '../status.util';

const ALL: InstallStatus[] = [
  'PROPOSED','PROPOSED_AWAITING_USER','CONFIRMED',
  'IN_PROGRESS','DONE','RESCHEDULED','RESCHEDULE_REQUESTED','CANCELLED',
];

describe('INSTALL_STATUS_CHIP', () => {
  it('covers every InstallStatus', () => {
    ALL.forEach(s => expect(INSTALL_STATUS_CHIP[s]).toBeDefined());
  });
  it('each entry has required keys', () => {
    ALL.forEach(s => {
      const c = INSTALL_STATUS_CHIP[s];
      expect(c).toHaveProperty('bg');
      expect(c).toHaveProperty('border');
      expect(c).toHaveProperty('dot');
      expect(c).toHaveProperty('text');
      expect(c).toHaveProperty('badge');
    });
  });
});