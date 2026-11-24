import { describe, expect, it } from 'vitest';
import { nextActionLabel } from '../nextActionLabel';

describe('nextActionLabel', () => {
    it.each([
        ['review', 'Tinjau permintaan'],
        ['appr_mgr', 'Perlu tanda tangan Anda'],
        ['appr_gm', 'Perlu tanda tangan Anda'],
        ['procure', 'Catat pembelian'],
        ['delivery', 'Konfirmasi barang tiba'],
        ['schedule', 'Atur jadwal pemasangan'],
        ['install', 'Selesaikan pemasangan'],
        ['fulfill', 'Aktifkan akses'],
        ['confirm', 'Perlu konfirmasi Anda'],
    ])('%s -> %s', (phase, label) => expect(nextActionLabel(phase)).toBe(label));

    it('an unknown phase still says something clear instead of "Giliran Anda"', () => {
        expect(nextActionLabel('nope')).toBe('Perlu tindakan Anda');
        expect(nextActionLabel(null)).toBe('Perlu tindakan Anda');
    });
});
