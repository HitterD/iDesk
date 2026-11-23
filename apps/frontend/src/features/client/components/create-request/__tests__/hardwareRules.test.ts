import { describe, expect, it } from 'vitest';
import type { BasketLine } from '@/features/ticket-board/components/request-flow/picker/basket';
import { hardwareMissing, toHardwarePayload, type HardwareForm } from '../hardwareRules';

const line = (over: Partial<BasketLine> = {}): BasketLine => ({ catalogId: 'c-1', name: 'Laptop Standar', quantity: 1, fields: {}, requiredFields: [], ...over });
const form = (over: Partial<HardwareForm> = {}): HardwareForm => ({
    title: 'Laptop untuk staf baru', justification: 'Staf baru mulai Senin', division: 'QC', recipients: ['Leony'], managerId: '',
    lines: [line()], signature: 'data:image/png;base64,AAAA', ...over,
});

describe('hardwareMissing', () => {
    it('a complete request passes', () => {
        expect(hardwareMissing(form())).toBe('');
    });

    it('needs a basket, a reason, a division, a recipient and a signature, in that order of the form', () => {
        expect(hardwareMissing(form({ lines: [] }))).toBe('Pilih minimal satu barang');
        expect(hardwareMissing(form({ justification: ' ' }))).toBe('Isi alasan permintaan');
        expect(hardwareMissing(form({ division: '' }))).toBe('Isi divisi penerima');
        expect(hardwareMissing(form({ recipients: [] }))).toBe('Isi minimal satu penerima');
        expect(hardwareMissing(form({ signature: null }))).toBe('Tanda tangan dulu');
    });

    it('names the item and the field that is still empty', () => {
        const software = line({ name: 'Lisensi Software', requiredFields: [{ key: 'seat', label: 'Jumlah seat', type: 'number', required: true }] });
        expect(hardwareMissing(form({ lines: [software] }))).toBe('Lengkapi Lisensi Software: Jumlah seat');
        expect(hardwareMissing(form({ lines: [{ ...software, fields: { seat: 3 } }] }))).toBe('');
    });

    it('with several recipients every item must say who it is for', () => {
        expect(hardwareMissing(form({ recipients: ['Leony', 'Budi'], lines: [line({ recipient: '' })] }))).toBe('Pilih untuk siapa Laptop Standar');
        expect(hardwareMissing(form({ recipients: ['Leony', 'Budi'], lines: [line({ recipient: 'Budi' })] }))).toBe('');
    });
});

describe('toHardwarePayload', () => {
    it('sends the basket as items, the recipients and the signature; and the ticket title names the first item', () => {
        const payload = toHardwarePayload(form({ title: '', lines: [line({ quantity: 2 }), line({ catalogId: null, name: 'Kabel HDMI' })], managerId: 'm-1' }));
        expect(payload.title).toBe('Laptop Standar +1 barang lain');
        expect(payload).toMatchObject({
            justification: 'Staf baru mulai Senin', division: 'QC', recipients: ['Leony'], managerId: 'm-1', signatureData: 'data:image/png;base64,AAAA',
        });
        expect(payload.items).toEqual([
            { catalogId: 'c-1', quantity: 2, recipientName: 'Leony' },
            { manualName: 'Kabel HDMI', quantity: 1, recipientName: 'Leony' },
        ]);
    });

    it('a single recipient is set on every item; with several, each item keeps its own', () => {
        const single = toHardwarePayload(form({ lines: [line()] }));
        expect((single.items as Array<Record<string, unknown>>)[0].recipientName).toBe('Leony');
        const many = toHardwarePayload(form({ recipients: ['Leony', 'Budi'], lines: [line({ recipient: 'Budi' })] }));
        expect((many.items as Array<Record<string, unknown>>)[0].recipientName).toBe('Budi');
    });
});
