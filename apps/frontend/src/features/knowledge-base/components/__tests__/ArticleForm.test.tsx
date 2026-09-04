import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ArticleForm } from '../ArticleForm';

describe('ArticleForm Component', () => {
    it('renders form inputs, editor tabs, and toolbar buttons', () => {
        const handleSubmit = vi.fn();
        const handleCancel = vi.fn();

        render(
            <ArticleForm
                onSubmit={handleSubmit}
                onCancel={handleCancel}
                mode="create"
                isAdmin={true}
            />
        );

        expect(screen.getByPlaceholderText(/Contoh: Cara Mengatasi Outlook Error/i)).toBeInTheDocument();
        expect(screen.getByText('Split Preview')).toBeInTheDocument();
        expect(screen.getByText('Preview Penuh')).toBeInTheDocument();
        expect(screen.getByText('Sisipkan Gambar')).toBeInTheDocument();
        expect(screen.getByText('+ Langkah')).toBeInTheDocument();
        expect(screen.getByText('Batal')).toBeInTheDocument();
        expect(screen.getByText('Simpan Draft')).toBeInTheDocument();
        expect(screen.getByText('Publikasikan')).toBeInTheDocument();
    });

    it('opens image configuration modal and inserts markdown when confirmed', () => {
        const handleSubmit = vi.fn();

        render(
            <ArticleForm
                onSubmit={handleSubmit}
                initialData={{
                    images: ['https://example.com/test-guide.png']
                }}
            />
        );

        // Click "Atur & Sisipkan" from gallery
        const aturBtn = screen.getByText('Atur & Sisipkan');
        fireEvent.click(aturBtn);

        // Modal should open
        expect(screen.getByText('Atur Penempatan Gambar di Teks')).toBeInTheDocument();
        expect(screen.getByText('Posisi / Alignment Gambar:')).toBeInTheDocument();
        expect(screen.getByText('Ukuran Gambar:')).toBeInTheDocument();

        // Select Left Alignment and 50% size
        fireEvent.click(screen.getByText('Rata Kiri'));
        fireEvent.click(screen.getByText('50% (Sedang)'));

        // Click Sisipkan ke Teks
        fireEvent.click(screen.getByText('Sisipkan ke Teks'));

        // Textarea should contain formatted markdown with options
        const textarea = screen.getByPlaceholderText(/Tulis panduan langkah demi langkah/i) as HTMLTextAreaElement;
        expect(textarea.value).toContain('https://example.com/test-guide.png');
        expect(textarea.value).toContain('{align=left size=50}');
    });
});
