import { describe, expect, it } from 'vitest';
import { getNotificationCenterPath, type UserRole } from '../notificationRouter';

describe('getNotificationCenterPath', () => {
    it('routes USER to client notification center', () => {
        expect(getNotificationCenterPath('USER')).toBe('/client/notifications');
    });

    it.each<UserRole>(['ADMIN', 'AGENT', 'MANAGER'])(
        'routes %s to shared notification center',
        (role) => {
            expect(getNotificationCenterPath(role)).toBe('/notifications');
        },
    );
});
