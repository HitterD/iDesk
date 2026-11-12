import { NotificationPreferenceGate, isInQuietHours } from './notification-preference-gate.service';
import { NotificationType } from './entities/notification.entity';

describe('NotificationPreferenceGate', () => {
    const base = { inAppEnabled: true, emailEnabled: true, pushEnabled: true, typeSettings: {}, quietHoursEnabled: false, quietHoursStart: null, quietHoursEnd: null, timezone: 'Asia/Jakarta' };
    const gateWith = (prefs: any) => new NotificationPreferenceGate({ findOne: jest.fn().mockResolvedValue(prefs) } as any);

    it('allows everything when the user never saved settings', async () => {
        expect(await gateWith(null).allows('u', 'email', NotificationType.TICKET_UPDATED)).toBe(true);
    });

    it('honours the global switch and the per-type switch (in_app key)', async () => {
        const gate = gateWith({ ...base, pushEnabled: false, typeSettings: { TICKET_UPDATED: { in_app: false } } });
        expect(await gate.allows('u', 'push', NotificationType.TICKET_REPLY)).toBe(false);
        expect(await gate.allows('u', 'in_app', NotificationType.TICKET_UPDATED)).toBe(false);
        expect(await gate.allows('u', 'in_app', NotificationType.TICKET_REPLY)).toBe(true);
    });

    it('holds push and email during quiet hours but not in-app, and never blocks critical notices', async () => {
        const gate = gateWith({ ...base, emailEnabled: false, quietHoursEnabled: true, quietHoursStart: '22:00', quietHoursEnd: '07:00' });
        const night = new Date('2026-11-12T16:00:00Z'); // 23:00 WIB
        expect(await gate.allows('u', 'push', NotificationType.TICKET_REPLY, { at: night })).toBe(false);
        expect(await gate.allows('u', 'in_app', NotificationType.TICKET_REPLY, { at: night })).toBe(true);
        expect(await gate.allows('u', 'push', NotificationType.TICKET_REPLY, { at: night, critical: true })).toBe(true);
        expect(await gate.allows('u', 'email', NotificationType.SLA_BREACHED, { at: night })).toBe(true);
    });

    it('handles overnight and same-day quiet hours in the user timezone', () => {
        const prefs = { quietHoursEnabled: true, quietHoursStart: '22:00', quietHoursEnd: '07:00', timezone: 'Asia/Jakarta' };
        expect(isInQuietHours(prefs, new Date('2026-11-12T23:30:00Z'))).toBe(true);  // 06:30 WIB
        expect(isInQuietHours(prefs, new Date('2026-11-12T01:00:00Z'))).toBe(false); // 08:00 WIB
        expect(isInQuietHours({ ...prefs, quietHoursStart: '12:00', quietHoursEnd: '13:00' }, new Date('2026-11-12T05:30:00Z'))).toBe(true);
    });
});
