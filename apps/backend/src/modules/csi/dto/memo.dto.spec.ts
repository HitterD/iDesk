import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { MemoHeaderDto, MemoRequestDto } from './memo.dto';
import { memoHeader } from '../services/csi-memo.fixtures';

const UUID = '11111111-1111-4111-8111-111111111111';
const check = (cls: any, plain: unknown) => validate(plainToInstance(cls, plain));

describe('memo dto', () => {
    it('accepts a valid request and trims/cleans strings', async () => {
        const dto = plainToInstance(MemoRequestDto, { periodIds: [UUID], header: memoHeader({ to: '  Pak\u0000 Budi  ' }) });
        expect(await validate(dto)).toHaveLength(0);
        expect(dto.header.to).toBe('Pak Budi');
    });

    it('keeps newlines in paragraphs', () => {
        expect(plainToInstance(MemoHeaderDto, memoHeader({ closing: 'a\nb' })).closing).toBe('a\nb');
    });

    it('rejects 0 or 21 periods, duplicates, non-uuid', async () => {
        const many = Array.from({ length: 21 }, (_, i) => `11111111-1111-4111-8111-${String(i).padStart(12, '0')}`);
        for (const periodIds of [[], many, [UUID, UUID], ['x']]) {
            expect((await check(MemoRequestDto, { periodIds, header: memoHeader() })).length).toBeGreaterThan(0);
        }
    });

    it('rejects long strings and bad date', async () => {
        expect((await check(MemoHeaderDto, memoHeader({ to: 'x'.repeat(301) }))).length).toBeGreaterThan(0);
        expect((await check(MemoHeaderDto, memoHeader({ opening: 'x'.repeat(2001) }))).length).toBeGreaterThan(0);
        expect((await check(MemoHeaderDto, memoHeader({ opening: 'x'.repeat(2000) }))).length).toBe(0);
        expect((await check(MemoHeaderDto, memoHeader({ date: '28/11/2025' }))).length).toBeGreaterThan(0);
        expect((await check(MemoHeaderDto, memoHeader({ date: '2025-02-31' }))).length).toBeGreaterThan(0);
    });
});
