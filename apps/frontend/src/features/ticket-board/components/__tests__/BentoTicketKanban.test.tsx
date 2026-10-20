import React from 'react';
import { render, screen } from '@testing-library/react';
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
    Draggable: ({ children }: { children: Function }) => children({ innerRef: vi.fn(), draggableProps: {}, dragHandleProps: {} }, { isDragging: false }),
}));

const ticket = {
    id: 'vendor-ticket', title: 'Vendor ticket', status: 'WAITING_VENDOR' as const,
    priority: 'HIGH' as const, createdAt: '2026-10-20T01:00:00Z',
    slaTarget: '2020-01-01T00:00:00Z', isOverdue: true,
};

describe('Kanban paused SLA', () => {
    it.each([120, null, 0])('never shows a target or urgency while paused: %s', (remaining) => {
        render(<EnhancedKanbanCard ticket={{ ...ticket, slaRemainingMinutes: remaining }} index={0} onSelect={vi.fn()} onQuickAssign={vi.fn()} onOpen={vi.fn()} />);
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
