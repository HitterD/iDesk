import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ReassignConfirmDialog } from '../ReassignConfirmDialog';

describe('ReassignConfirmDialog', () => {
    const mockTicket = {
        id: 'ticket-1',
        ticketNumber: '190826-GEN-0005',
        title: 'Network Issue',
        assignedTo: {
            id: 'agent-1',
            fullName: 'Agent Lama',
        },
    };

    const mockTargetAgent = {
        id: 'agent-2',
        fullName: 'Agent Baru',
    };

    it('renders reassignment details between current PIC and target agent', () => {
        render(
            <ReassignConfirmDialog
                isOpen={true}
                onClose={vi.fn()}
                ticket={mockTicket}
                targetAgent={mockTargetAgent}
                onConfirm={vi.fn()}
            />
        );

        expect(screen.getByText('Konfirmasi Pengalihan PIC')).toBeInTheDocument();
        expect(screen.getByText('Agent Lama')).toBeInTheDocument();
        expect(screen.getByText('Agent Baru')).toBeInTheDocument();
        expect(screen.getByText(/#190826-GEN-0005/)).toBeInTheDocument();
    });

    it('renders unassign mode when targetAgent is null', () => {
        render(
            <ReassignConfirmDialog
                isOpen={true}
                onClose={vi.fn()}
                ticket={mockTicket}
                targetAgent={null}
                onConfirm={vi.fn()}
            />
        );

        expect(screen.getByText('Lepas Penugasan Tiket')).toBeInTheDocument();
        expect(screen.getByText('Unassigned (Lepas PIC)')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Lepas Penugasan/i })).toBeInTheDocument();
    });

    it('submits selected preset reason when confirmed', () => {
        const onConfirm = vi.fn();
        render(
            <ReassignConfirmDialog
                isOpen={true}
                onClose={vi.fn()}
                ticket={mockTicket}
                targetAgent={mockTargetAgent}
                onConfirm={onConfirm}
            />
        );

        // Click preset 'Kebutuhan Spesialis / Skillset'
        const presetChip = screen.getByText('Kebutuhan Spesialis / Skillset');
        fireEvent.click(presetChip);

        // Click confirm
        const confirmBtn = screen.getByRole('button', { name: /Konfirmasi Pengalihan/i });
        fireEvent.click(confirmBtn);

        expect(onConfirm).toHaveBeenCalledWith('Kebutuhan Spesialis / Skillset');
    });

    it('requires custom text when Lainnya is selected', () => {
        const onConfirm = vi.fn();
        render(
            <ReassignConfirmDialog
                isOpen={true}
                onClose={vi.fn()}
                ticket={mockTicket}
                targetAgent={mockTargetAgent}
                onConfirm={onConfirm}
            />
        );

        // Select 'Lainnya' preset
        const otherChip = screen.getByText('Lainnya');
        fireEvent.click(otherChip);

        // Confirm button should be disabled when textarea is empty
        const confirmBtn = screen.getByRole('button', { name: /Konfirmasi Pengalihan/i });
        expect(confirmBtn).toBeDisabled();

        // Type reason into textarea
        const textarea = screen.getByRole('textbox');
        fireEvent.change(textarea, { target: { value: 'Sedang ada maintenance darurat di server' } });

        expect(confirmBtn).not.toBeDisabled();
        fireEvent.click(confirmBtn);

        expect(onConfirm).toHaveBeenCalledWith('Sedang ada maintenance darurat di server');
    });
    it('renders keep button only when onKeepAssignee is passed', () => {
        const { rerender } = render(
            <ReassignConfirmDialog
                isOpen={true}
                onClose={vi.fn()}
                ticket={mockTicket}
                targetAgent={mockTargetAgent}
                onConfirm={vi.fn()}
            />
        );
        expect(screen.queryByRole('button', { name: 'Ubah status tanpa alihkan PIC' })).not.toBeInTheDocument();

        const onKeepAssignee = vi.fn();
        rerender(
            <ReassignConfirmDialog
                isOpen={true}
                onClose={vi.fn()}
                ticket={mockTicket}
                targetAgent={mockTargetAgent}
                onConfirm={vi.fn()}
                onKeepAssignee={onKeepAssignee}
            />
        );
        fireEvent.click(screen.getByRole('button', { name: 'Ubah status tanpa alihkan PIC' }));
        expect(onKeepAssignee).toHaveBeenCalledTimes(1);
    });

    it('lists every conflicting ticket in bulk mode', () => {
        render(
            <ReassignConfirmDialog
                isOpen={true}
                onClose={vi.fn()}
                ticket={{ id: 'bulk', ticketNumber: '2 tiket', title: 'Ubah status massal' }}
                targetAgent={mockTargetAgent}
                onConfirm={vi.fn()}
                ticketsSummary={[
                    { ticketNumber: '201026-GEN-0001', assigneeName: 'Agent A' },
                    { ticketNumber: '201026-GEN-0002', assigneeName: 'Agent B' },
                ]}
            />
        );

        expect(screen.getByText('201026-GEN-0001')).toBeInTheDocument();
        expect(screen.getByText('Agent B')).toBeInTheDocument();
    });

    it('shows the single PIC name instead of "Beberapa PIC" when bulk has one conflict', () => {
        const props = {
            isOpen: true, onClose: vi.fn(), targetAgent: mockTargetAgent, onConfirm: vi.fn(),
            ticket: { id: 'bulk', ticketNumber: '1 tiket', title: 'Ubah status massal' },
        };
        const { rerender } = render(
            <ReassignConfirmDialog {...props} ticketsSummary={[{ ticketNumber: '201026-GEN-0001', assigneeName: 'Agent A' }]} />
        );
        expect(screen.queryByText('Beberapa PIC')).not.toBeInTheDocument();
        expect(screen.getAllByText('Agent A').length).toBeGreaterThan(0);

        rerender(
            <ReassignConfirmDialog
                {...props}
                ticketsSummary={[
                    { ticketNumber: '201026-GEN-0001', assigneeName: 'Agent A' },
                    { ticketNumber: '201026-GEN-0002', assigneeName: 'Agent B' },
                ]}
            />
        );
        expect(screen.getByText('Beberapa PIC')).toBeInTheDocument();

        rerender(
            <ReassignConfirmDialog
                {...props}
                ticketsSummary={[
                    { ticketNumber: '201026-GEN-0001', assigneeName: 'Agent A' },
                    { ticketNumber: '201026-GEN-0003', assigneeName: 'Agent A' },
                ]}
            />
        );
        expect(screen.queryByText('Beberapa PIC')).not.toBeInTheDocument();
    });
});
