import { NotificationCenterService } from './notification-center.service';
import { DeliveryChannel } from './entities/notification-log.entity';

/**
 * Regression: notification_preferences.emailAddress was a copy of the account email taken once, so after
 * an email change mail kept going to (and the settings page kept showing) the old address.
 */
describe('NotificationCenterService account email sync', () => {
  let service: NotificationCenterService;
  let userRepo: any;
  let preferenceRepo: any;

  const build = () => {
    service = new NotificationCenterService(
      {} as any, {} as any, {} as any, preferenceRepo, {} as any, userRepo,
      {} as any, {} as any, {} as any, {} as any, {} as any,
    );
  };

  beforeEach(() => {
    userRepo = { findOne: jest.fn().mockResolvedValue({ id: 'u1', email: 'new@company.co.id' }) };
    preferenceRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 'p1', userId: 'u1', emailAddress: 'old@company.co.id', emailEnabled: true }),
      create: jest.fn((x) => x),
      save: jest.fn(async (x: any) => x),
      update: jest.fn().mockResolvedValue(undefined),
    };
    build();
  });

  it('re-points a stale copy at the current account email and persists it', async () => {
    const prefs = await service.getOrCreatePreferences('u1');

    expect(prefs.emailAddress).toBe('new@company.co.id');
    expect(preferenceRepo.update).toHaveBeenCalledWith('p1', { emailAddress: 'new@company.co.id' });
  });

  it('does not write when the address already matches', async () => {
    preferenceRepo.findOne.mockResolvedValue({ id: 'p1', userId: 'u1', emailAddress: 'new@company.co.id' });

    await service.getOrCreatePreferences('u1');

    expect(preferenceRepo.update).not.toHaveBeenCalled();
  });

  it('routes the email channel to the current account email', async () => {
    const prefs = await service.getOrCreatePreferences('u1');
    const recipient = (service as any).getRecipientForChannel(DeliveryChannel.EMAIL, prefs, 'u1');

    expect(recipient).toBe('new@company.co.id');
  });

  it('ignores a client-supplied emailAddress so it cannot drift from the account email', async () => {
    await service.updatePreferences('u1', { emailAddress: 'elsewhere@x.com', emailEnabled: false } as any);

    const saved = preferenceRepo.save.mock.calls.at(-1)[0];
    expect(saved.emailAddress).toBe('new@company.co.id');
    expect(saved.emailEnabled).toBe(false);
  });
});
