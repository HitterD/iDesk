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
});
