import { describe, expect, it } from 'vitest';
import { getNotificationCenterPath, getNotificationRedirectPath, type UserRole } from '../notificationRouter';
import type { Notification } from '../../types/notification.types';

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

describe('getNotificationRedirectPath — CSI reminder link', () => {
    const reminder = { link: '/csi/p1' } as Notification;

    it.each<[UserRole, string]>([
        ['USER', '/client/csi/p1'],
        ['MANAGER', '/manager/csi/p1'],
        ['ADMIN', '/csi/p1'],
        ['AGENT', '/csi/p1'],
    ])('routes %s to %s', (role, expected) => {
        expect(getNotificationRedirectPath(reminder, role)).toBe(expected);
    });

    it('does not prefix a link that only starts with "/csi"', () => {
        expect(getNotificationRedirectPath({ link: '/csix' } as Notification, 'USER')).toBe('/csix');
    });
});
