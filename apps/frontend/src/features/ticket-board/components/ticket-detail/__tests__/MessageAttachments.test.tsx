import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MessageAttachments } from '../MessageAttachments';

const XLSX_PATH = '/uploads/tickets/t-1/1730000000-123.xlsx';
const PDF_PATH = '/uploads/tickets/t-1/1730000000-456.pdf';

describe('MessageAttachments', () => {
    it('shows the original name, type and size when attachmentInfo is present', () => {
        render(
            <MessageAttachments
                attachments={[XLSX_PATH]}
                attachmentInfo={[{ path: XLSX_PATH, name: 'Laporan Q3.xlsx', size: 2048, mime: 'application/vnd.ms-excel' }]}
                onImageClick={vi.fn()}
                isRequester={false}
            />,
        );

        const link = screen.getByRole('link', { name: 'Download Laporan Q3.xlsx' });
        expect(link).toHaveAttribute('download', 'Laporan Q3.xlsx');
        expect(screen.getByText('XLSX · 2 KB')).toBeInTheDocument();
    });

    it('falls back to the stored file name for messages without attachmentInfo', () => {
        render(<MessageAttachments attachments={[XLSX_PATH]} onImageClick={vi.fn()} isRequester={false} />);

        expect(screen.getByText('1730000000-123.xlsx')).toBeInTheDocument();
        expect(screen.getByText('XLSX')).toBeInTheDocument();
    });

    it('opens PDFs in the previewer with the original name', () => {
        const onPdfClick = vi.fn();
        render(
            <MessageAttachments
                attachments={[PDF_PATH]}
                attachmentInfo={[{ path: PDF_PATH, name: 'SOP.pdf', size: 10, mime: 'application/pdf' }]}
                onImageClick={vi.fn()}
                onPdfClick={onPdfClick}
                isRequester
            />,
        );

        fireEvent.click(screen.getByRole('button', { name: 'Preview SOP.pdf' }));
        expect(onPdfClick).toHaveBeenCalledWith(expect.stringContaining(PDF_PATH), 'SOP.pdf');
    });
});
