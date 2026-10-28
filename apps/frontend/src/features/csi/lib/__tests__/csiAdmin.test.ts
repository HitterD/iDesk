import { describe, expect, it } from 'vitest';
import { blobErrorMessage, CSI_EXPORT_FAILED } from '../csiAdmin';

const blobError = (body: string) => ({ response: { data: new Blob([body], { type: 'application/json' }) } });

describe('blobErrorMessage', () => {
    it('membaca pesan backend dari body error blob', async () => {
        expect(await blobErrorMessage(blobError(JSON.stringify({ message: 'Periode tidak ditemukan' })))).toBe('Periode tidak ditemukan');
    });
    it('menggabungkan pesan validasi berbentuk array', async () => {
        expect(await blobErrorMessage(blobError(JSON.stringify({ message: ['a', 'b'] })))).toBe('a, b');
    });
    it('memakai pesan umum untuk body non-JSON atau error tanpa respons', async () => {
        expect(await blobErrorMessage(blobError('<html>502</html>'))).toBe(CSI_EXPORT_FAILED);
        expect(await blobErrorMessage(new Error('network'))).toBe(CSI_EXPORT_FAILED);
    });
});
