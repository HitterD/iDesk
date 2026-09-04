import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ArticleMarkdownViewer } from '../ArticleMarkdownViewer';

describe('ArticleMarkdownViewer Image & Markdown parsing', () => {
    it('renders standalone image with alignment, size, and caption', () => {
        const content = `
## Panduan Setup
![Langkah 1|Klik tombol Network Settings](https://example.com/image1.png){align=center size=50}
        `.trim();

        render(<ArticleMarkdownViewer content={content} />);

        // Image should be rendered
        const img = screen.getByAltText('Langkah 1');
        expect(img).toBeInTheDocument();
        expect(img).toHaveAttribute('src', 'https://example.com/image1.png');

        // Caption should be visible
        expect(screen.getByText('Klik tombol Network Settings')).toBeInTheDocument();
    });

    it('opens ImageLightboxModal when image is clicked', () => {
        const content = `![Screenshot Panduan](https://example.com/screenshot.png)`;

        render(<ArticleMarkdownViewer content={content} />);

        const img = screen.getByAltText('Screenshot Panduan');
        expect(img).toBeInTheDocument();

        // Click image to trigger lightbox
        fireEvent.click(img);

        // Lightbox modal toolbar elements should appear (e.g. ZoomIn, Copy URL, Close)
        expect(screen.getByTitle('Tutup (Esc)')).toBeInTheDocument();
        expect(screen.getByTitle('Salin Link Gambar')).toBeInTheDocument();
        expect(screen.getByTitle('Perbesar (+)')).toBeInTheDocument();
    });

    it('renders step checklist cards with toggle button', () => {
        const content = `
### Step 1: Buka Pengaturan
1. Klik menu Start
2. Pilih Settings
        `.trim();

        const handleToggle = vi.fn();

        render(
            <ArticleMarkdownViewer
                content={content}
                completedSteps={{ '1': false }}
                onToggleStep={handleToggle}
            />
        );

        expect(screen.getByText('LANGKAH 1')).toBeInTheDocument();
        expect(screen.getByText('Buka Pengaturan')).toBeInTheDocument();

        const toggleBtn = screen.getByRole('button', { name: /Tandai Selesai/i });
        fireEvent.click(toggleBtn);
        expect(handleToggle).toHaveBeenCalledWith('1');
    });

    it('renders callout boxes for notes and warnings', () => {
        const content = `
## Catatan
Pastikan kabel LAN terpasang.

## Tips Keamanan
Jangan bagikan password kepada siapa pun.
        `.trim();

        render(<ArticleMarkdownViewer content={content} />);

        expect(screen.getByText('Catatan Penting')).toBeInTheDocument();
        expect(screen.getByText('Pastikan kabel LAN terpasang.')).toBeInTheDocument();
        expect(screen.getByText('Tips Keamanan & Peringatan')).toBeInTheDocument();
        expect(screen.getByText('Jangan bagikan password kepada siapa pun.')).toBeInTheDocument();
    });
});
