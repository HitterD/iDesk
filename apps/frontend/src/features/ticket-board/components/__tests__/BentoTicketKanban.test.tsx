import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { Draggable } from '@hello-pangea/dnd';
import { describe, expect, it, vi } from 'vitest';
import { BentoTicketKanban, EnhancedKanbanCard, isCountedOverdue } from '../BentoTicketKanban';

vi.mock('@/lib/api', () => ({ default: { get: vi.fn(async (url: string) => ({ data: url === '/tickets' ? [
    { id: 'mine-attention', ticketNumber: 'MY-1', title: 'Mine attention', status: 'TODO', priority: 'CRITICAL', isOverdue: true, assignedTo: { id: 'me', fullName: 'Me' }, createdAt: '2026-10-20T01:00:00Z' },
    { id: 'other-attention', ticketNumber: 'OTHER-1', title: 'Other attention', status: 'TODO', priority: 'CRITICAL', isOverdue: true, assignedTo: { id: 'other', fullName: 'Other' }, createdAt: '2026-10-20T01:00:00Z' },
    { id: 'mine-normal', ticketNumber: 'MY-2', title: 'Mine normal', status: 'TODO', priority: 'MEDIUM', isOverdue: false, assignedTo: { id: 'me', fullName: 'Me' }, createdAt: '2026-10-20T01:00:00Z' },
] : [] })) } }));
vi.mock('@/lib/socket', () => ({ useSocket: () => ({ isConnected: true }) }));
vi.mock('@/stores/useAuth', () => ({ useAuth: () => ({ user: { id: 'me', role: 'AGENT' } }) }));
vi.mock('../../hooks/useStatusTakeover', () => ({ useStatusTakeover: () => ({}), isHandledByTakeoverDialog: () => false }));

it.each(['Overdue', 'Critical'])('keeps personal scope when applying %s attention', async (attention) => {
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter><BentoTicketKanban /></MemoryRouter>
    </QueryClientProvider>);
    const personal = await screen.findByRole('button', { name: 'Tugas Saya' });
    fireEvent.click(personal);
    fireEvent.click(screen.getByRole('button', { name: new RegExp(attention) }));
    expect(personal).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('article', { name: 'MY-1: Mine attention' })).toBeInTheDocument();
    expect(screen.queryByRole('article', { name: 'OTHER-1: Other attention' })).not.toBeInTheDocument();
    expect(screen.queryByRole('article', { name: 'MY-2: Mine normal' })).not.toBeInTheDocument();
});

vi.mock('@/lib/slaCountdown', async (importOriginal) => ({
    ...await importOriginal<typeof import('@/lib/slaCountdown')>(),
    useSlaClock: () => null,
}));
vi.mock('@/components/ui/TicketQuickPreview', () => ({
    TicketQuickPreview: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('@hello-pangea/dnd', () => ({
    DragDropContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    Droppable: ({ children }: { children: Function }) => children({ innerRef: vi.fn(), droppableProps: {}, placeholder: null }, { isDraggingOver: false }),
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
        expect(screen.getByText(remaining == null ? 'Dijeda' : `Dijeda · sisa ${remaining === 120 ? '2 jam' : '0 mnt'}`)).toBeInTheDocument();
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
