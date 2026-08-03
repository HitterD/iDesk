import { getAttachmentUrl, isImageUrl } from './utils';

describe('utils - getAttachmentUrl & isImageUrl', () => {
    it('should return empty string for invalid or legacy telegram URLs', () => {
        expect(getAttachmentUrl('')).toBe('');
        expect(getAttachmentUrl(null as any)).toBe('');
        expect(getAttachmentUrl('telegram:photo:12345')).toBe('');
        expect(getAttachmentUrl('telegram:document:67890')).toBe('');
    });

    it('should normalize relative paths (/uploads/xyz.png) correctly', () => {
        const url = '/uploads/2026/07/test.png';
        const result = getAttachmentUrl(url);
        expect(result).toContain('/uploads/2026/07/test.png');
    });

    it('should strip /api/v1 from stored upload URLs and return clean path', () => {
        const apiPrefixUrl = 'http://10.10.6.13:5050/api/v1/uploads/document.pdf';
        const result = getAttachmentUrl(apiPrefixUrl);
        expect(result).toContain('/uploads/document.pdf');
        expect(result).not.toContain('/api/v1');
    });

    it('should identify valid image URLs correctly', () => {
        expect(isImageUrl('/uploads/image.png')).toBe(true);
        expect(isImageUrl('/uploads/photo.JPEG')).toBe(true);
        expect(isImageUrl('/uploads/graphic.webp')).toBe(true);
        expect(isImageUrl('/uploads/telegram/abc.jpg')).toBe(true);
        expect(isImageUrl('/uploads/image.png?v=2')).toBe(true);
        expect(isImageUrl('/uploads/document.pdf')).toBe(false);
        expect(isImageUrl('telegram:photo:123')).toBe(false);
    });

    it('should not treat a non-image whose name merely contains an image extension as an image', () => {
        expect(isImageUrl('/uploads/report.png.pdf')).toBe(false);
        expect(isImageUrl('/uploads/gif-guide/manual.pdf')).toBe(false);
        expect(isImageUrl('/uploads/svg-export.zip')).toBe(false);
    });
});
