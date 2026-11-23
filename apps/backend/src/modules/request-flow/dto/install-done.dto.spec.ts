import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { InstallDoneDto } from './install-done.dto';

const ITEM = '0b6d3c4e-1111-4222-8333-444455556677';
const SIGNATURE = 'data:image/png;base64,AAAA';

const check = async (over: Record<string, unknown> = {}) => {
    const dto = plainToInstance(InstallDoneDto, { assets: [{ itemId: ITEM, code: 'AST-0001' }], signatureData: SIGNATURE, ...over });
    return (await validate(dto, { whitelist: true, forbidNonWhitelisted: true })).length === 0;
};
const withCode = (code: string) => check({ assets: [{ itemId: ITEM, code }] });

describe('InstallDoneDto', () => {
    it('accepts a valid report', async () => {
        expect(await check()).toBe(true);
    });

    it('asset code: 4 to 128 characters of letters, digits, - and _', async () => {
        expect(await withCode('abc')).toBe(false);
        expect(await withCode('A'.repeat(129))).toBe(false);
        expect(await withCode('A'.repeat(128))).toBe(true);
        expect(await withCode('AST 0001')).toBe(false);
        expect(await withCode('AST/0001')).toBe(false);
        expect(await withCode('ast_0001-x')).toBe(true);
        expect(await withCode('  AST-0001  ')).toBe(true);
    });

    it('needs at least one asset with a unit id', async () => {
        expect(await check({ assets: [] })).toBe(false);
        expect(await check({ assets: [{ itemId: 'nope', code: 'AST-0001' }] })).toBe(false);
    });

    it('signature must be a PNG data URL of at most 300KB', async () => {
        expect(await check({ signatureData: 'data:image/jpeg;base64,AAAA' })).toBe(false);
        expect(await check({ signatureData: 'hello' })).toBe(false);
        expect(await check({ signatureData: `data:image/png;base64,${'A'.repeat(300 * 1024)}` })).toBe(false);
        expect(await check({ signatureData: undefined })).toBe(false);
    });

    it('photo is optional; when given it is an https URL or an internal /uploads path (max 500)', async () => {
        expect(await check({ photoUrl: undefined })).toBe(true);
        expect(await check({ photoUrl: 'https://idesk.example.com/uploads/a.jpg' })).toBe(true);
        expect(await check({ photoUrl: '/uploads/install/a.jpg' })).toBe(true);
        expect(await check({ photoUrl: 'http://evil.example.com/a.jpg' })).toBe(false);
        expect(await check({ photoUrl: 'javascript:alert(1)' })).toBe(false);
        expect(await check({ photoUrl: '//evil.example.com/uploads/a.jpg' })).toBe(false);
        expect(await check({ photoUrl: '/uploads/../etc/passwd' })).toBe(false);
        expect(await check({ photoUrl: `/uploads/${'a'.repeat(500)}` })).toBe(false);
    });
});
