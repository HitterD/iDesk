import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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

        expect(screen.getByRole('dialog', { name: 'Selesaikan tiket' })).toBeInTheDocument();
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

        const submitBtn = screen.getByRole('button', { name: 'Selesaikan tiket' });
        fireEvent.click(submitBtn);

        expect(mockConfirm).toHaveBeenCalledWith('Roller printer telah dibersihkan dan kalibrasi selesai.', []);
    });

    it('calls onConfirm when Ctrl+Enter is pressed in textarea', () => {
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
        fireEvent.change(textarea, { target: { value: 'Solusi via shortcut keyboard.' } });
        fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true });

        expect(mockConfirm).toHaveBeenCalledWith('Solusi via shortcut keyboard.', []);
    });

    it('stops keyboard event propagation so parent list row does not intercept Space', () => {
        const parentKeyDown = vi.fn();
        render(
            <div onKeyDown={parentKeyDown}>
                <ResolveTicketModal
                    isOpen={true}
                    onClose={vi.fn()}
                    ticket={mockTicket}
                    onConfirm={vi.fn()}
                />
            </div>
        );

        const textarea = screen.getByPlaceholderText(/Jelaskan tindakan teknis atau solusi/i);
        fireEvent.keyDown(textarea, { key: ' ' });

        expect(parentKeyDown).not.toHaveBeenCalled();
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

        const cancelBtn = screen.getByRole('button', { name: 'Batal' });
        fireEvent.click(cancelBtn);

        expect(mockClose).toHaveBeenCalled();
    });
    it('labels the resolution field and prevents cancellation or submission while loading', () => {
        const onClose = vi.fn();
        const onConfirm = vi.fn();
        render(<ResolveTicketModal isOpen onClose={onClose} ticket={mockTicket} onConfirm={onConfirm} isLoading />);
        expect(screen.getByRole('textbox', { name: /Tindakan & Penjelasan Solusi/ })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Batal' })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Tutup dialog' })).toBeDisabled();
        fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter', ctrlKey: true });
        expect(onConfirm).not.toHaveBeenCalled();
        expect(onClose).not.toHaveBeenCalled();
    });

    it('Escape dismisses preview only, preserving draft and files, then dismisses resolve', async () => {
        vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:preview'), revokeObjectURL: vi.fn() });
        const onClose = vi.fn();
        const { container } = render(<ResolveTicketModal isOpen onClose={onClose} ticket={mockTicket} onConfirm={vi.fn()} />);
        const note = screen.getByRole('textbox');
        fireEvent.change(note, { target: { value: 'Draft solusi tetap ada' } });
        const file = new File(['image'], 'bukti.png', { type: 'image/png' });
        const input = document.querySelector('input[type="file"]') as HTMLInputElement;
        fireEvent.change(input, { target: { files: [file] } });
        fireEvent.click(screen.getByRole('button', { name: 'Lihat lampiran bukti.png' }));
        expect(screen.getByRole('button', { name: 'Tutup pratinjau lampiran' })).toBeInTheDocument();
        fireEvent.keyDown(document, { key: 'Escape' });
        await waitFor(() => expect(screen.queryByRole('button', { name: 'Tutup pratinjau lampiran' })).not.toBeInTheDocument());
        expect(onClose).not.toHaveBeenCalled();
        expect(note).toHaveValue('Draft solusi tetap ada');
        expect(screen.getByRole('button', { name: 'Lihat lampiran bukti.png' })).toBeInTheDocument();
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(onClose).toHaveBeenCalledOnce();
        vi.unstubAllGlobals();
    });
});
