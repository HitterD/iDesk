import { describe, expect, it } from 'vitest';
import { invalidFields, mapSubmitError, validateTicketForm } from '../createTicketValidation';

const base = { title: '', description: '', priority: 'MEDIUM', criticalReason: '' };

describe('validateTicketForm', () => {
    it('flags every empty required field on submit, in form order', () => {
        const errors = validateTicketForm({ ...base, priority: 'CRITICAL' });
        expect(invalidFields(errors)).toEqual(['title', 'description', 'criticalReason']);
        expect(errors.title).toBe('Judul tiket wajib diisi');
    });

    it('does not scold empty fields before the first submit, only too-short text', () => {
        expect(validateTicketForm(base, false)).toEqual({});
        expect(validateTicketForm({ ...base, title: 'abc' }, false)).toEqual({ title: 'Judul tiket minimal 5 karakter' });
    });

    it('requires a critical reason only for CRITICAL priority', () => {
        const filled = { ...base, title: 'Printer mati', description: 'Printer lantai 2 tidak menyala.' };
        expect(validateTicketForm(filled)).toEqual({});
        expect(validateTicketForm({ ...filled, priority: 'CRITICAL' })).toEqual({ criticalReason: 'Jelaskan kenapa tiket ini Blocker' });
        expect(validateTicketForm({ ...filled, priority: 'CRITICAL', criticalReason: 'Produksi berhenti' })).toEqual({});
    });
});

describe('mapSubmitError', () => {
    it('maps DTO messages to their fields', () => {
        const { fields } = mapSubmitError({ response: { status: 400, data: { message: ['Title must be at least 5 characters'] } } });
        expect(Object.keys(fields)).toEqual(['title']);
    });

    it('explains a lost connection, an oversized upload and a server failure', () => {
        expect(mapSubmitError(new Error('Network Error')).message).toMatch(/tidak dapat terhubung/i);
        expect(mapSubmitError({ response: { status: 413, data: {} } }).message).toMatch(/lampiran terlalu besar/i);
        expect(mapSubmitError({ response: { status: 503, data: {} } }).message).toMatch(/server sedang bermasalah/i);
    });

    it('keeps the server wording for other rejections', () => {
        expect(mapSubmitError({ response: { status: 409, data: { message: 'Duplikat' } } }).message).toBe('Gagal membuat tiket: Duplikat');
    });
});
