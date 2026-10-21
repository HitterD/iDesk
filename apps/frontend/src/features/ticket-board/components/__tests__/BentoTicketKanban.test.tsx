import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Draggable } from '@hello-pangea/dnd';
import { describe, expect, it, vi } from 'vitest';
import { EnhancedKanbanCard, isCountedOverdue } from '../BentoTicketKanban';

vi.mock('@/lib/slaCountdown', async (importOriginal) => ({
    ...await importOriginal<typeof import('@/lib/slaCountdown')>(),
    useSlaClock: () => null,
}));
vi.mock('@/components/ui/TicketQuickPreview', () => ({
    TicketQuickPreview: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('@hello-pangea/dnd', () => ({
    DragDropContext: vi.fn(), Droppable: vi.fn(),
    Draggable: vi.fn(({ children }: { children: Function }) => children({ innerRef: vi.fn(), draggableProps: {}, dragHandleProps: {} }, { isDragging: false })),
}));

const ticket = {
    id: 'vendor-ticket', title: 'Vendor ticket', status: 'WAITING_VENDOR' as const,
    priority: 'HIGH' as const, createdAt: '2026-10-20T01:00:00Z',
    slaTarget: '2020-01-01T00:00:00Z', isOverdue: true,
};

const renderCard = (t: React.ComponentProps<typeof EnhancedKanbanCard>['ticket'], onOpen = vi.fn()) => render(
    <MemoryRouter><EnhancedKanbanCard ticket={t} index={0} onSelect={vi.fn()} onQuickAssign={vi.fn()} onOpen={onOpen} /></MemoryRouter>,
);
const lastDragDisabled = () => vi.mocked(Draggable).mock.calls.at(-1)?.[0].isDragDisabled;

describe('Kanban card (round 2)', () => {
    it('locks a CLOSED card: not draggable, lock icon, no PIC action', async () => {
        renderCard({ ...ticket, status: 'CLOSED', ticketNumber: 'K-1' });
        expect(lastDragDisabled()).toBe(true);
        expect(screen.getByLabelText('Hanya baca')).toBeInTheDocument();
        expect(screen.getByRole('article', { name: 'K-1: Vendor ticket' })).toHaveAttribute('data-locked', 'true');
    });

    it('keeps active cards draggable with a labelled ⋯ menu that does not open the ticket', () => {
        const onOpen = vi.fn();
        renderCard({ ...ticket, status: 'IN_PROGRESS', ticketNumber: 'K-2' }, onOpen);
        expect(lastDragDisabled()).toBe(false);
        screen.getByRole('button', { name: 'Aksi lainnya #K-2' }).click();
        expect(onOpen).not.toHaveBeenCalled();
        expect(screen.queryByLabelText('Hanya baca')).not.toBeInTheDocument();
    });
});

describe('Kanban paused SLA', () => {
    it.each([120, null, 0])('never shows a target or urgency while paused: %s', (remaining) => {
        renderCard({ ...ticket, slaRemainingMinutes: remaining });
        expect(screen.getByText(remaining == null ? 'Dijeda' : `Dijeda · sisa ${remaining === 120 ? '2j 0m' : '0m'}`)).toBeInTheDocument();
        expect(screen.queryByText(/Target:|Due soon:|Overdue:/)).not.toBeInTheDocument();
    });
});

describe('isCountedOverdue (overdue filter + stat)', () => {
    it('excludes paused WAITING_VENDOR tickets even when flagged overdue', () => {
        expect(isCountedOverdue({ status: 'WAITING_VENDOR', isOverdue: true })).toBe(false);
    });

    it.each(['TODO', 'IN_PROGRESS'] as const)('counts overdue %s tickets', (status) => {
        expect(isCountedOverdue({ status, isOverdue: true })).toBe(true);
        expect(isCountedOverdue({ status, isOverdue: false })).toBe(false);
    });

    it.each(['RESOLVED', 'CLOSED', 'CANCELLED'] as const)('excludes finished %s tickets', (status) => {
        expect(isCountedOverdue({ status, isOverdue: true })).toBe(false);
    });
});
