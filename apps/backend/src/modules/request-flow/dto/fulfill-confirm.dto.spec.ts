import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ConfirmDto } from './confirm.dto';
import { DocumentNumberDto } from './document-number.dto';
import { FulfillDto } from './fulfill.dto';

const SIGNATURE = 'data:image/png;base64,AAAA';
const ok = async (cls: new () => object, plain: Record<string, unknown>) =>
    (await validate(plainToInstance(cls, plain), { whitelist: true, forbidNonWhitelisted: true })).length === 0;

describe('FulfillDto', () => {
    const base = { mode: 'CREDENTIALS', username: 'leony.r', password: 'x', signatureData: SIGNATURE };

    it('accepts both modes with a signature', async () => {
        expect(await ok(FulfillDto, base)).toBe(true);
        expect(await ok(FulfillDto, { mode: 'NO_CREDENTIALS', note: 'Folder ditambahkan', accountName: 'leony.r', signatureData: SIGNATURE })).toBe(true);
    });

    it('needs a known mode and a PNG signature of at most 300 KB', async () => {
        expect(await ok(FulfillDto, { ...base, mode: 'OTHER' })).toBe(false);
        expect(await ok(FulfillDto, { ...base, signatureData: undefined })).toBe(false);
        expect(await ok(FulfillDto, { ...base, signatureData: 'data:image/jpeg;base64,AAAA' })).toBe(false);
        expect(await ok(FulfillDto, { ...base, signatureData: `data:image/png;base64,${'A'.repeat(300 * 1024)}` })).toBe(false);
    });

    it('limits the text fields', async () => {
        expect(await ok(FulfillDto, { ...base, username: 'u'.repeat(256) })).toBe(false);
        expect(await ok(FulfillDto, { ...base, password: 'p'.repeat(256) })).toBe(false);
        expect(await ok(FulfillDto, { ...base, server: 's'.repeat(256) })).toBe(false);
        expect(await ok(FulfillDto, { ...base, accountName: 'a'.repeat(256) })).toBe(false);
        expect(await ok(FulfillDto, { ...base, note: 'n'.repeat(2001) })).toBe(false);
        expect(await ok(FulfillDto, { ...base, note: 'n'.repeat(2000) })).toBe(true);
    });
});

describe('ConfirmDto', () => {
    it('OK needs no note', async () => {
        expect(await ok(ConfirmDto, { result: 'OK' })).toBe(true);
        expect(await ok(ConfirmDto, { result: 'OK', note: 'Terima kasih' })).toBe(true);
    });

    it('an issue needs a note of 5 to 1000 characters', async () => {
        expect(await ok(ConfirmDto, { result: 'ISSUE' })).toBe(false);
        expect(await ok(ConfirmDto, { result: 'ISSUE', note: 'abcd' })).toBe(false);
        expect(await ok(ConfirmDto, { result: 'ISSUE', note: 'abcde' })).toBe(true);
        expect(await ok(ConfirmDto, { result: 'ISSUE', note: 'a'.repeat(1001) })).toBe(false);
    });

    it('refuses an unknown result', async () => {
        expect(await ok(ConfirmDto, { result: 'MAYBE' })).toBe(false);
    });
});

describe('DocumentNumberDto', () => {
    it('needs a string value', async () => {
        expect(await ok(DocumentNumberDto, { value: 'F/ICT/04/0120' })).toBe(true);
        expect(await ok(DocumentNumberDto, {})).toBe(false);
        expect(await ok(DocumentNumberDto, { value: 12 })).toBe(false);
    });
});
