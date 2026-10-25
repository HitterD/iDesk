import { ValidationPipe } from '@nestjs/common';
import { AddRatersDto, CreateDimensionDto, CreateDepartmentDto, UpdateDimensionDto, MasterListQueryDto, UserSearchQueryDto } from './master.dto';

const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });
const parse = (metatype: any, value: unknown) => pipe.transform(value, { type: 'body', metatype });

describe('CSI master DTO validation', () => {
    it('requires a nonempty bounded name and rejects unexpected scope', async () => {
        for (const name of ['', ' ', 'x'.repeat(101), 1, null]) {
            await expect(parse(CreateDepartmentDto, { name })).rejects.toThrow();
        }
        await expect(parse(CreateDimensionDto, { name: 'Baik', scope: 'HC' })).rejects.toThrow();
        await expect(parse(CreateDimensionDto, { name: 'Baik', description: 'x'.repeat(301) })).rejects.toThrow();
        await expect(parse(UpdateDimensionDto, { name: null })).rejects.toThrow();
        await expect(parse(UpdateDimensionDto, { sortOrder: 1.5 })).rejects.toThrow();
        expect(await parse(CreateDimensionDto, { name: ' Baik ', description: null, sortOrder: 2 })).toMatchObject({ name: 'Baik', description: null, sortOrder: 2 });
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
});
