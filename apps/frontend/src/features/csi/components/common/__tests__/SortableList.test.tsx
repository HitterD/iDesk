import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SortableList } from '../SortableList';

const ITEMS = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
const ROW_HEIGHT = 40;
const ROW_GAP = 10;

// jsdom has no layout: give each sortable row a rectangle by its index so keyboard moves can find neighbours.
beforeEach(() => {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function mockRect(this: Element) {
        const index = ITEMS.findIndex((item) => item.id === this.getAttribute('data-sortable-id'));
        const top = Math.max(index, 0) * (ROW_HEIGHT + ROW_GAP);
        return { x: 0, y: top, top, left: 0, width: 200, height: ROW_HEIGHT, right: 200, bottom: top + ROW_HEIGHT, toJSON: () => ({}) };
    });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const renderList = (onReorder: (ids: string[]) => unknown = vi.fn(), disabled = false) => render(
    <SortableList items={ITEMS} getId={(item) => item.id} onReorder={onReorder} disabled={disabled} label="pertanyaan"
        renderItem={(item, handle) => <div>{handle}<span>{`isi ${item.id}`}</span></div>} />,
);
const order = () => screen.getAllByText(/^isi /).map((node) => node.textContent);

async function moveFirstDown(user: ReturnType<typeof userEvent.setup>) {
    screen.getAllByRole('button', { name: 'Ubah urutan pertanyaan' })[0].focus();
    await user.keyboard(' ');
    await user.keyboard('{ArrowDown}');
    await user.keyboard(' ');
}

describe('SortableList', () => {
    it('keyboard reorder calls onReorder with the new id order', async () => {
        const onReorder = vi.fn();
        renderList(onReorder);
        expect(screen.getAllByRole('button', { name: 'Ubah urutan pertanyaan' })).toHaveLength(3);
        await moveFirstDown(userEvent.setup());
        expect(onReorder).toHaveBeenCalledTimes(1);
        expect(onReorder).toHaveBeenCalledWith(['b', 'a', 'c']);
    });

    it('renders the optimistic new order right after a drop', async () => {
        renderList(vi.fn(() => new Promise(() => undefined)));
        await moveFirstDown(userEvent.setup());
        expect(order()).toEqual(['isi b', 'isi a', 'isi c']);
    });

    it('rolls the order back when onReorder rejects', async () => {
        renderList(vi.fn(() => Promise.reject(new Error('gagal'))));
        await moveFirstDown(userEvent.setup());
        await vi.waitFor(() => expect(order()).toEqual(['isi a', 'isi b', 'isi c']));
    });

    it('disables the handles', () => {
        renderList(vi.fn(), true);
        screen.getAllByRole('button', { name: 'Ubah urutan pertanyaan' }).forEach((handle) => expect(handle).toBeDisabled());
    });
});
