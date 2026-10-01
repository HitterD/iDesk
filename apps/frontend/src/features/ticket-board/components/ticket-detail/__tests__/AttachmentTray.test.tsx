import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AttachmentTray } from '../AttachmentTray';

const files = [
    new File(['abc'], 'Anggaran.xlsx'),
    new File(['de'], 'arsip.zip'),
];

describe('AttachmentTray', () => {
    it('renders nothing without files', () => {
        const { container } = render(<AttachmentTray files={[]} onRemove={vi.fn()} progress={null} />);
        expect(container).toBeEmptyDOMElement();
    });

    it('lists each file with a remove button that is always rendered', () => {
        const onRemove = vi.fn();
        render(<AttachmentTray files={files} onRemove={onRemove} progress={null} />);

        expect(screen.getByText('Anggaran.xlsx')).toBeInTheDocument();
        expect(screen.getByText('2/5 file · 5 Bytes')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Hapus arsip.zip' }));
        expect(onRemove).toHaveBeenCalledWith(1);
    });

    it('shows upload progress and locks removal while sending', () => {
        render(<AttachmentTray files={files} onRemove={vi.fn()} progress={42} />);

        expect(screen.getByText('Mengunggah 42%')).toBeInTheDocument();
        expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '42');
        expect(screen.getByRole('button', { name: 'Hapus Anggaran.xlsx' })).toBeDisabled();
    });
});
