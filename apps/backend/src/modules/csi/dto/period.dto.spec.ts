import { ValidationPipe } from '@nestjs/common';
import { CreatePeriodDto, SetRateesDto, UpdatePeriodDto } from './period.dto';

const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });
const parse = (metatype: any, value: unknown) => pipe.transform(value, { type: 'body', metatype });
const SITE = '6f1c1a2e-4b1d-4c3a-9a1e-2f3b4c5d6e7f';
const valid = { siteId: SITE, title: 'Q4', startDate: '2026-10-01', endDate: '2026-10-31' };

describe('CSI period DTO validation', () => {
    it('accepts a minimal period and rejects bad dates, lengths and scope injection', async () => {
        expect(await parse(CreatePeriodDto, { ...valid, title: ' Q4 ' })).toMatchObject({ title: 'Q4' });
        await expect(parse(CreatePeriodDto, { ...valid, startDate: '2026-10-01T00:00:00Z' })).rejects.toThrow();
        await expect(parse(CreatePeriodDto, { ...valid, endDate: '2026-02-30' })).rejects.toThrow();
        await expect(parse(CreatePeriodDto, { ...valid, siteId: 'x' })).rejects.toThrow();
        await expect(parse(CreatePeriodDto, { ...valid, title: 'x'.repeat(151) })).rejects.toThrow();
        await expect(parse(CreatePeriodDto, { ...valid, intro: 'x'.repeat(2001) })).rejects.toThrow();
        await expect(parse(CreatePeriodDto, { ...valid, respondentMode: 'ALL' })).rejects.toThrow();
        await expect(parse(CreatePeriodDto, { ...valid, scope: 'HC' })).rejects.toThrow();
        await expect(parse(UpdatePeriodDto, { siteId: SITE })).rejects.toThrow();
    });

    it('validates nested ratee assignments', async () => {
        await expect(parse(SetRateesDto, { ratees: [{ userId: SITE, dimensionIds: [] }] })).rejects.toThrow();
        await expect(parse(SetRateesDto, { ratees: [{ userId: 'x', dimensionIds: [SITE] }] })).rejects.toThrow();
        expect(await parse(SetRateesDto, { ratees: [{ userId: SITE, dimensionIds: [SITE] }] }))
            .toMatchObject({ ratees: [{ userId: SITE, dimensionIds: [SITE] }] });
    });
});
