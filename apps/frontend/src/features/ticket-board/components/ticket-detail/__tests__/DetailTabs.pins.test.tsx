import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DetailTabs, pinsOf } from '../DetailTabs';

vi.mock('@/hooks/useMediaQuery', () => ({ useMediaQuery: () => true }));

const msg = (id: string, over: object = {}) => ({ id, content: `isi ${id}`, isSystemMessage: false, isPinned: false, sender: { fullName: 'RM BAGASTYO' }, ...over });

describe('pins next to the tabs', () => {
    it('lists pinned, live messages oldest first', () => {
        const pins = pinsOf([
            msg('a', { isPinned: true, pinnedAt: '2026-11-02T08:00:00Z' }),
            msg('b', { isPinned: true, pinnedAt: '2026-11-02T07:00:00Z' }),
            msg('c'),
            msg('d', { isPinned: true, pinnedAt: '2026-11-02T06:00:00Z', isDeleted: true }),
        ]);
        expect(pins.map((p) => p.id)).toEqual(['b', 'a']);
    });

    it('shows the newest pin in the tab row, and a click jumps to it', () => {
        const onJump = vi.fn();
        render(<DetailTabs value="chat" onChange={vi.fn()} pins={[{ id: 'a', senderName: 'RM BAGASTYO', snippet: 'IP printer 10.0.0.12' }]} onJumpToPin={onJump} />);
        const bar = screen.getByRole('button', { name: 'Pesan disematkan 1 dari 1' });
        expect(bar).toHaveTextContent('IP printer 10.0.0.12');
        fireEvent.click(bar);
        expect(onJump).toHaveBeenCalledWith('a');
    });

    it('releases a pin from the tab row', () => {
        const onUnpin = vi.fn();
        render(<DetailTabs value="chat" onChange={vi.fn()} pins={[{ id: 'a', senderName: 'A', snippet: 'x' }]} onJumpToPin={vi.fn()} onUnpinPin={onUnpin} />);
        fireEvent.click(screen.getByRole('button', { name: 'Lepas sematan' }));
        expect(onUnpin).toHaveBeenCalledWith('a');
    });

    it('is only there on the conversation tab, and only with pins', () => {
        const { rerender } = render(<DetailTabs value="activity" onChange={vi.fn()} pins={[{ id: 'a', senderName: 'A', snippet: 'x' }]} onJumpToPin={vi.fn()} />);
        expect(screen.queryByRole('button', { name: /Pesan disematkan/ })).not.toBeInTheDocument();
        rerender(<DetailTabs value="chat" onChange={vi.fn()} pins={[]} onJumpToPin={vi.fn()} />);
        expect(screen.queryByRole('button', { name: /Pesan disematkan/ })).not.toBeInTheDocument();
    });
});
