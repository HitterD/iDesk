import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ResolveTicketModal } from '../ResolveTicketModal';

describe('ResolveTicketModal Component', () => {
    const mockTicket = {
        id: 't-12345678',
        ticketNumber: 'TICK-1001',
        title: 'Printer Epson L3110 Paper Jam',
    };

    it('does not render when isOpen is false', () => {
        const { container } = render(
            <ResolveTicketModal
                isOpen={false}
                onClose={vi.fn()}
                ticket={mockTicket}
                onConfirm={vi.fn()}
            />
        );
        expect(container.firstChild).toBeNull();
    });

    it('renders ticket header and quick templates when open', () => {
        render(
            <ResolveTicketModal
                isOpen={true}
                onClose={vi.fn()}
                ticket={mockTicket}
                onConfirm={vi.fn()}
            />
        );

        expect(screen.getByText('Selesaikan Tiket (Resolve)')).toBeInTheDocument();
        expect(screen.getByText('Printer Epson L3110 Paper Jam')).toBeInTheDocument();
        expect(screen.getByText(/Tindakan & Penjelasan Solusi/i)).toBeInTheDocument();
        expect(screen.getByText(/Template Solusi Cepat:/i)).toBeInTheDocument();
    });

    it('populates textarea when a quick template chip is clicked', () => {
        render(
            <ResolveTicketModal
                isOpen={true}
                onClose={vi.fn()}
                ticket={mockTicket}
                onConfirm={vi.fn()}
            />
        );

        const templateBtn = screen.getByText(/Masalah berhasil diperbaiki/i);
        fireEvent.click(templateBtn);

        const textarea = screen.getByPlaceholderText(/Jelaskan tindakan teknis atau solusi/i) as HTMLTextAreaElement;
        expect(textarea.value).toContain('Masalah berhasil diperbaiki');
    });

    it('calls onConfirm with written notes on submit', () => {
        const mockConfirm = vi.fn();
        render(
            <ResolveTicketModal
                isOpen={true}
                onClose={vi.fn()}
                ticket={mockTicket}
                onConfirm={mockConfirm}
            />
        );

        const textarea = screen.getByPlaceholderText(/Jelaskan tindakan teknis atau solusi/i);
        fireEvent.change(textarea, { target: { value: 'Roller printer telah dibersihkan dan kalibrasi selesai.' } });

        const submitBtn = screen.getByText('Ya, Selesaikan Tiket');
        fireEvent.click(submitBtn);

        expect(mockConfirm).toHaveBeenCalledWith('Roller printer telah dibersihkan dan kalibrasi selesai.', []);
    });

    it('calls onClose when Kembali button is clicked', () => {
        const mockClose = vi.fn();
        render(
            <ResolveTicketModal
                isOpen={true}
                onClose={mockClose}
                ticket={mockTicket}
                onConfirm={vi.fn()}
            />
        );

        const cancelBtn = screen.getByText('Kembali');
        fireEvent.click(cancelBtn);

        expect(mockClose).toHaveBeenCalled();
    });
});
