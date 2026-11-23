import { describe, expect, it, vi } from 'vitest';
import { readQrFromFile } from '../qrReader';

const png = new File(['x'], 'scan.png', { type: 'image/png' });
const pdf = new File(['%PDF'], 'scan.pdf', { type: 'application/pdf' });

describe('readQrFromFile', () => {
    it('an image is decoded directly', async () => {
        const decodeImage = vi.fn(async () => '221126-QC-0035/v4');
        const renderPdfPage = vi.fn();
        await expect(readQrFromFile(png, { decodeImage, renderPdfPage, decodeCanvas: vi.fn() })).resolves.toBe('221126-QC-0035/v4');
        expect(decodeImage).toHaveBeenCalledWith(png);
        expect(renderPdfPage).not.toHaveBeenCalled();
    });

    it('a PDF is rendered (first page) and the canvas decoded', async () => {
        const canvas = {} as HTMLCanvasElement;
        const renderPdfPage = vi.fn(async () => canvas);
        const decodeCanvas = vi.fn(async () => '221126-QC-0035/v4');
        await expect(readQrFromFile(pdf, { decodeImage: vi.fn(), renderPdfPage, decodeCanvas })).resolves.toBe('221126-QC-0035/v4');
        expect(renderPdfPage).toHaveBeenCalledWith(pdf, 1);
        expect(decodeCanvas).toHaveBeenCalledWith(canvas);
    });

    it('a scan without a readable QR gives null, not an error', async () => {
        const decodeImage = vi.fn(async () => { throw new Error('NotFoundException'); });
        await expect(readQrFromFile(png, { decodeImage, renderPdfPage: vi.fn(), decodeCanvas: vi.fn() })).resolves.toBeNull();
    });

    it('any other file type is refused', async () => {
        const text = new File(['x'], 'a.txt', { type: 'text/plain' });
        await expect(readQrFromFile(text, { decodeImage: vi.fn(), renderPdfPage: vi.fn(), decodeCanvas: vi.fn() })).rejects.toThrow(/PDF atau gambar/);
    });
});
