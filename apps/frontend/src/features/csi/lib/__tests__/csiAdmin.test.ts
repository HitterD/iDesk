import { describe, expect, it } from 'vitest';
import { blobErrorMessage, CSI_EXPORT_FAILED } from '../csiAdmin';
import { canAdminCsi, canReadCsi } from '../useCsiAdminAccess';

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

describe('canReadCsi / canAdminCsi', () => {
    it('MANAGER tanpa kunci hanya boleh baca ICT (bukan HC) dan tidak boleh ubah', () => {
        expect(canReadCsi('MANAGER', {}, 'ict', false)).toBe(true);
        expect(canReadCsi('MANAGER', {}, 'hc', false)).toBe(false);
        expect(canAdminCsi('MANAGER', {}, 'ict')).toBe(false);
    });
    it('penanggung jawab ICT tidak membaca HC, penanggung jawab HC tidak membaca ICT', () => {
        expect(canReadCsi('AGENT', {}, 'hc', false)).toBe(false);
        expect(canReadCsi('USER', {}, 'ict', false)).toBe(false);
    });
    it('MANAGER dengan kunci boleh ubah scope itu saja', () => {
        expect(canAdminCsi('MANAGER', { csi_admin_ict: true }, 'ict')).toBe(true);
        expect(canAdminCsi('MANAGER', { csi_admin_ict: true }, 'hc')).toBe(false);
    });
    it('penanggung jawab report role apa pun boleh baca, tidak ubah', () => {
        expect(canReadCsi('AGENT', {}, 'ict', true)).toBe(true);
        expect(canAdminCsi('AGENT', {}, 'ict')).toBe(false);
        expect(canReadCsi('USER', {}, 'ict', false)).toBe(false);
    });
    it('HC_ADMIN: HC saja, ICT hanya jika penanggung jawab', () => {
        expect(canReadCsi('HC_ADMIN', {}, 'ict', false)).toBe(false);
        expect(canReadCsi('HC_ADMIN', {}, 'ict', true)).toBe(true);
        expect(canAdminCsi('HC_ADMIN', {}, 'hc')).toBe(true);
    });
});
