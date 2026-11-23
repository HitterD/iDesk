import { describe, expect, it } from 'vitest';
import { getNotificationCenterPath, getNotificationRedirectPath, type UserRole } from '../notificationRouter';
import { NotificationCategory, type Notification } from '../../types/notification.types';

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

describe('getNotificationRedirectPath — every category lands on its page', () => {
    const id = '23841455-c9a9-494c-952f-e68309dc9fca';
    const n = (fields: Partial<Notification>) => fields as Notification;

    it('sends managers to the ticket itself, not the list', () => {
        expect(getNotificationRedirectPath(n({ link: `/tickets/${id}` }), 'MANAGER')).toBe(`/tickets/${id}`);
    });

    const ticket = '0b6d3c4e-1111-4222-8333-444455556677';

    it('a request notification that names its ticket opens that ticket, in the reader portal', () => {
        expect(getNotificationRedirectPath(n({ category: NotificationCategory.CATEGORY_HARDWARE, ticketId: ticket, referenceId: `${id}_submitted` }), 'USER')).toBe(`/client/tickets/${ticket}`);
        expect(getNotificationRedirectPath(n({ category: NotificationCategory.CATEGORY_EFORM, ticketId: ticket, referenceId: id }), 'AGENT')).toBe(`/tickets/${ticket}`);
    });

    it('an old link to a request page is routed to the legacy redirect of the reader portal, which finds the ticket', () => {
        expect(getNotificationRedirectPath(n({ link: `/hardware-requests/${id}` }), 'USER')).toBe(`/client/hardware-requests/${id}`);
        expect(getNotificationRedirectPath(n({ link: `/eform-access/${id}` }), 'AGENT')).toBe(`/eform-access/${id}`);
    });

    it('without a ticket id, request notifications fall back to the legacy redirect by the old request id (step suffix stripped)', () => {
        expect(getNotificationRedirectPath(n({ category: NotificationCategory.CATEGORY_EFORM, referenceId: id }), 'USER')).toBe(`/client/eform-access/${id}`);
        expect(getNotificationRedirectPath(n({ category: NotificationCategory.CATEGORY_HARDWARE, referenceId: `${id}_submitted` }), 'AGENT')).toBe(`/hardware-requests/${id}`);
    });

    it('opens a Zoom booking in the client calendar, ignoring external join URLs', () => {
        expect(getNotificationRedirectPath(n({ category: NotificationCategory.CATEGORY_ZOOM, referenceId: 'b-1', link: 'https://zoom.us/j/1' }), 'USER'))
            .toBe('/client/zoom-calendar?booking=b-1');
    });

    it('maps the old VPN link to the VPN tab', () => {
        expect(getNotificationRedirectPath(n({ link: '/vpn-access' }), 'AGENT')).toBe('/renewal?tab=vpn');
    });

    it('falls back to the reader ticket list when nothing names a page', () => {
        expect(getNotificationRedirectPath(n({}), 'USER')).toBe('/client/my-tickets');
        expect(getNotificationRedirectPath(n({}), 'AGENT_ORACLE')).toBe('/tickets/oracle-k2');
        expect(getNotificationRedirectPath(n({ category: NotificationCategory.CATEGORY_RENEWAL }), 'USER')).toBe('/client/my-tickets');
    });
});
