import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/stores/useAuth', () => ({
    useAuth: () => ({ user: null }),
}));

const { UserAvatar, AVATAR_GRADIENTS } = await import('../UserAvatar');

const FORBIDDEN_HUES = /(purple|violet|fuchsia|pink|indigo)-/;

describe('UserAvatar', () => {
    it('shows the profile photo when the user has one', () => {
        render(<UserAvatar user={{ fullName: 'User SPJ', avatarUrl: '/uploads/avatars/a.png' }} />);

        expect(screen.getByRole('img', { name: 'User SPJ' }).getAttribute('src')).toContain('/uploads/avatars/a.png');
    });

    it('falls back to initials without a photo', () => {
        render(<UserAvatar user={{ fullName: 'User SPJ' }} />);

        expect(screen.getByText('US')).toBeTruthy();
    });

    it('retries the photo after a new one is uploaded, even if the old one failed', () => {
        const { rerender } = render(<UserAvatar user={{ fullName: 'User SPJ', avatarUrl: '/uploads/avatars/old.png' }} />);
        fireEvent.error(screen.getByRole('img'));
        expect(screen.queryByRole('img')).toBeNull();

        rerender(<UserAvatar user={{ fullName: 'User SPJ', avatarUrl: '/uploads/avatars/new.png' }} />);

        expect(screen.getByRole('img').getAttribute('src')).toContain('/uploads/avatars/new.png');
    });

    it('uses a fallback palette without purple-family hues', () => {
        expect(AVATAR_GRADIENTS).toHaveLength(8);
        AVATAR_GRADIENTS.forEach((gradient) => expect(gradient).not.toMatch(FORBIDDEN_HUES));
    });

    it('never renders a purple-family fallback for any initial', () => {
        const names = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((c) => `${c}ser Name`);
        names.forEach((fullName) => {
            const { container, unmount } = render(<UserAvatar user={{ fullName }} />);
            expect((container.firstChild as HTMLElement).className).not.toMatch(FORBIDDEN_HUES);
            unmount();
        });
    });
});
