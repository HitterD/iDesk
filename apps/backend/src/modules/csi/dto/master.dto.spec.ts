import { ValidationPipe } from '@nestjs/common';
import { CsiQuestionType } from '../csi.constants';
import { AddRatersDto, CreateDimensionDto, CreateDepartmentDto, ReorderDto, UpdateDimensionDto, MasterListQueryDto, UserSearchQueryDto } from './master.dto';

const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });
const parse = (metatype: any, value: unknown) => pipe.transform(value, { type: 'body', metatype });
const messagesOf = async (metatype: any, value: unknown): Promise<string[]> => {
    try {
        await parse(metatype, value);
        return [];
    } catch (error: any) {
        return error.getResponse().message;
    }
};
const INVALID_OPTIONS = 'Pilihan tidak valid untuk jenis pertanyaan ini';
const scaleOptions = (count: number, points: unknown = 3) => Array.from({ length: count }, (_, index) => ({ label: `Opsi ${index + 1}`, points }));
const choiceOptions = (count: number) => Array.from({ length: count }, (_, index) => ({ label: `Opsi ${index + 1}`, points: null }));

describe('CSI master DTO validation', () => {
    it('requires a nonempty bounded name and rejects unexpected scope', async () => {
        for (const name of ['', ' ', 'x'.repeat(101), 1, null]) {
            await expect(parse(CreateDepartmentDto, { name })).rejects.toThrow();
        }
        await expect(parse(CreateDimensionDto, { name: 'Baik', type: CsiQuestionType.STAR, scope: 'HC' })).rejects.toThrow();
        await expect(parse(CreateDimensionDto, { name: 'Baik', type: CsiQuestionType.STAR, description: 'x'.repeat(301) })).rejects.toThrow();
        await expect(parse(UpdateDimensionDto, { name: null })).rejects.toThrow();
        expect(await parse(CreateDimensionDto, { name: ' Baik ', type: CsiQuestionType.STAR, description: null }))
            .toMatchObject({ name: 'Baik', type: CsiQuestionType.STAR, description: null });
    });

    it('question text may be up to 300 characters and sortOrder is server-assigned', async () => {
        expect(await parse(CreateDimensionDto, { name: 'x'.repeat(300), type: CsiQuestionType.STAR })).toMatchObject({ name: 'x'.repeat(300) });
        await expect(parse(CreateDimensionDto, { name: 'x'.repeat(301), type: CsiQuestionType.STAR })).rejects.toThrow();
        await expect(parse(CreateDimensionDto, { name: 'Baik', type: CsiQuestionType.STAR, sortOrder: 2 })).rejects.toThrow();
        await expect(parse(UpdateDimensionDto, { sortOrder: 1 })).rejects.toThrow();
        await expect(parse(CreateDepartmentDto, { name: 'Gudang', sortOrder: 1 })).rejects.toThrow();
        await expect(parse(CreateDimensionDto, { name: 'Baik' })).rejects.toThrow();
        await expect(parse(CreateDimensionDto, { name: 'Baik', type: 'RATING' })).rejects.toThrow();
        await expect(parse(CreateDimensionDto, { name: 'Baik', type: CsiQuestionType.TEXT, required: 'yes' })).rejects.toThrow();
        expect(await parse(CreateDimensionDto, { name: 'Baik', type: CsiQuestionType.TEXT, required: false })).toMatchObject({ required: false });
    });

    it('SCALE requires 2-10 options with points 1-5', async () => {
        const scale = (options: unknown) => ({ name: 'Puas?', type: CsiQuestionType.SCALE, options });
        expect(await parse(CreateDimensionDto, scale(scaleOptions(2)))).toMatchObject({ options: scaleOptions(2) });
        expect(await parse(CreateDimensionDto, scale(scaleOptions(10, 5)))).toMatchObject({ type: CsiQuestionType.SCALE });
        for (const options of [undefined, [], scaleOptions(1), scaleOptions(11), scaleOptions(2, 0), scaleOptions(2, 6), scaleOptions(2, null)]) {
            expect(await messagesOf(CreateDimensionDto, scale(options))).toContain(INVALID_OPTIONS);
        }
        await expect(parse(CreateDimensionDto, scale(scaleOptions(2, 2.5)))).rejects.toThrow();
        await expect(parse(CreateDimensionDto, scale([{ label: '', points: 1 }, { label: 'B', points: 2 }]))).rejects.toThrow();
        await expect(parse(CreateDimensionDto, scale([{ label: 'x'.repeat(201), points: 1 }, { label: 'B', points: 2 }]))).rejects.toThrow();
        await expect(parse(CreateDimensionDto, scale([{ label: 'A', points: 1, extra: true }, { label: 'B', points: 2 }]))).rejects.toThrow();
        expect(await parse(CreateDimensionDto, scale([{ label: ' A ', points: 1 }, { label: 'B', points: 2 }])))
            .toMatchObject({ options: [{ label: 'A', points: 1 }, { label: 'B', points: 2 }] });
    });

    it('CHOICE options must have null points', async () => {
        const choice = (options: unknown) => ({ name: 'Berapa kali?', type: CsiQuestionType.CHOICE, options });
        expect(await parse(CreateDimensionDto, choice(choiceOptions(3)))).toMatchObject({ options: choiceOptions(3) });
        for (const options of [scaleOptions(3, 1), choiceOptions(1), choiceOptions(11), [{ label: 'A', points: null }, { label: 'B', points: 2 }]]) {
            expect(await messagesOf(CreateDimensionDto, choice(options))).toContain(INVALID_OPTIONS);
        }
        await expect(parse(CreateDimensionDto, choice([{ label: 'A' }, { label: 'B' }]))).rejects.toThrow();
    });

    it('STAR and TEXT take no options', async () => {
        for (const type of [CsiQuestionType.STAR, CsiQuestionType.TEXT]) {
            expect(await parse(CreateDimensionDto, { name: 'Q', type, options: [] })).toMatchObject({ type });
            expect(await messagesOf(CreateDimensionDto, { name: 'Q', type, options: choiceOptions(2) })).toContain(INVALID_OPTIONS);
        }
        expect(await messagesOf(UpdateDimensionDto, { type: CsiQuestionType.STAR, options: choiceOptions(2) })).toContain(INVALID_OPTIONS);
        // Partial updates without a type are re-checked against the stored type in the service.
        expect(await parse(UpdateDimensionDto, { options: choiceOptions(2) })).toMatchObject({ options: choiceOptions(2) });
    });

    it('reorder body is a UUID array', async () => {
        const id = '7f1c6a2e-7a35-4c55-9a43-5d3c2a1b0e9f';
        expect(await parse(ReorderDto, { ids: [id] })).toMatchObject({ ids: [id] });
        await expect(parse(ReorderDto, { ids: ['order'] })).rejects.toThrow();
        await expect(parse(ReorderDto, { ids: id })).rejects.toThrow();
        await expect(parse(ReorderDto, {})).rejects.toThrow();
    });

    it('validates user UUID arrays and query types without truthy false conversion', async () => {
        await expect(parse(AddRatersDto, { userIds: ['not-a-uuid'] })).rejects.toThrow();
        await expect(parse(AddRatersDto, { userIds: 'invalid' })).rejects.toThrow();
        expect(await parse(AddRatersDto, { userIds: [] })).toMatchObject({ userIds: [] });
        expect(await parse(MasterListQueryDto, { includeInactive: 'false' })).toMatchObject({ includeInactive: false });
        expect(await parse(MasterListQueryDto, { includeInactive: 'true' })).toMatchObject({ includeInactive: true });
        await expect(parse(MasterListQueryDto, { includeInactive: 'anything' })).rejects.toThrow();
        expect(await parse(UserSearchQueryDto, { limit: '100' })).toMatchObject({ limit: 50 });
        await expect(parse(UserSearchQueryDto, { limit: 'no' })).rejects.toThrow();
    });

    it('shortLabel is optional, trimmed and at most 40 characters', async () => {
        expect(await parse(CreateDimensionDto, { name: 'Baik', type: CsiQuestionType.STAR, shortLabel: ' Kecepatan respon ' }))
            .toMatchObject({ shortLabel: 'Kecepatan respon' });
        expect(await parse(UpdateDimensionDto, { shortLabel: null })).toMatchObject({ shortLabel: null });
        await expect(parse(CreateDimensionDto, { name: 'Baik', type: CsiQuestionType.STAR, shortLabel: 'x'.repeat(41) })).rejects.toThrow();
        await expect(parse(UpdateDimensionDto, { shortLabel: 5 })).rejects.toThrow();
    });
});
