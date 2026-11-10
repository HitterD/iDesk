import { ValidationPipe } from '@nestjs/common';
import { CreatePeriodDto, SetRateesDto, SetTeamQuestionsDto, UpdatePeriodDto, UpdatePeriodRateeDto } from './period.dto';

const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });
const parse = (metatype: any, value: unknown) => pipe.transform(value, { type: 'body', metatype });
const SITE = '6f1c1a2e-4b1d-4c3a-9a1e-2f3b4c5d6e7f';
const valid = { siteIds: [SITE], title: 'Q4', startDate: '2026-10-01', endDate: '2026-10-31' };

describe('CSI period DTO validation', () => {
    it('accepts a minimal period and rejects bad dates, lengths and scope injection', async () => {
        expect(await parse(CreatePeriodDto, { ...valid, title: ' Q4 ' })).toMatchObject({ title: 'Q4' });
        await expect(parse(CreatePeriodDto, { ...valid, startDate: '2026-10-01T00:00:00Z' })).rejects.toThrow();
        await expect(parse(CreatePeriodDto, { ...valid, endDate: '2026-02-30' })).rejects.toThrow();
        await expect(parse(CreatePeriodDto, { ...valid, siteIds: ['x'] })).rejects.toThrow();
        await expect(parse(CreatePeriodDto, { ...valid, title: 'x'.repeat(151) })).rejects.toThrow();
        await expect(parse(CreatePeriodDto, { ...valid, intro: 'x'.repeat(2001) })).rejects.toThrow();
        await expect(parse(CreatePeriodDto, { ...valid, respondentMode: 'ALL' })).rejects.toThrow();
        await expect(parse(CreatePeriodDto, { ...valid, scope: 'HC' })).rejects.toThrow();
        await expect(parse(UpdatePeriodDto, { siteId: SITE })).rejects.toThrow();
        await expect(parse(CreatePeriodDto, { ...valid, siteId: SITE })).rejects.toThrow();
    });

    it('validates siteIds (1-20 unique UUIDs) and requires them unless copying', async () => {
        const OTHER = '7f1c1a2e-4b1d-4c3a-9a1e-2f3b4c5d6e7f';
        expect(await parse(CreatePeriodDto, { ...valid, siteIds: [SITE, OTHER] })).toMatchObject({ siteIds: [SITE, OTHER] });
        await expect(parse(CreatePeriodDto, { ...valid, siteIds: [] })).rejects.toThrow();
        await expect(parse(CreatePeriodDto, { ...valid, siteIds: [SITE, SITE] })).rejects.toThrow();
        const many = Array.from({ length: 21 }, (_, index) => `6f1c1a2e-4b1d-4c3a-9a1e-2f3b4c5d6e${String(index).padStart(2, '0')}`);
        await expect(parse(CreatePeriodDto, { ...valid, siteIds: many })).rejects.toThrow();
        const { siteIds: _omitted, ...withoutSites } = valid;
        await expect(parse(CreatePeriodDto, withoutSites)).rejects.toThrow();
        expect(await parse(CreatePeriodDto, { ...withoutSites, copyFromPeriodId: SITE })).toMatchObject({ copyFromPeriodId: SITE });
        expect(await parse(UpdatePeriodDto, { siteIds: [SITE] })).toMatchObject({ siteIds: [SITE] });
        await expect(parse(UpdatePeriodDto, { siteIds: [] })).rejects.toThrow();
    });

    it('validates team and SLA fields', async () => {
        expect(await parse(UpdatePeriodDto, { teamEnabled: true, teamLabel: ' Tim X ', individualEnabled: false, slaTargetPct: 100 }))
            .toMatchObject({ teamEnabled: true, teamLabel: 'Tim X', individualEnabled: false, slaTargetPct: 100 });
        await expect(parse(UpdatePeriodDto, { teamLabel: '' })).rejects.toThrow();
        await expect(parse(UpdatePeriodDto, { teamLabel: 'x'.repeat(101) })).rejects.toThrow();
        await expect(parse(UpdatePeriodDto, { slaTargetPct: 0 })).rejects.toThrow();
        await expect(parse(UpdatePeriodDto, { slaTargetPct: 101 })).rejects.toThrow();
        await expect(parse(UpdatePeriodDto, { slaTargetPct: 80.5 })).rejects.toThrow();
        await expect(parse(UpdatePeriodDto, { teamEnabled: 'yes' })).rejects.toThrow();
    });

    it('validates score bands (1–5, one decimal)', async () => {
        expect(await parse(UpdatePeriodDto, { scoreFairMin: 3.5, scoreGoodMin: 4.2 })).toMatchObject({ scoreFairMin: 3.5, scoreGoodMin: 4.2 });
        expect(await parse(CreatePeriodDto, { ...valid, scoreFairMin: 1, scoreGoodMin: 5 })).toMatchObject({ scoreFairMin: 1, scoreGoodMin: 5 });
        for (const bad of [0.9, 5.1, 4.25, '4.0']) {
            await expect(parse(UpdatePeriodDto, { scoreFairMin: bad })).rejects.toThrow();
            await expect(parse(UpdatePeriodDto, { scoreGoodMin: bad })).rejects.toThrow();
        }
    });

    it('validates team question ids per site', async () => {
        expect(await parse(SetTeamQuestionsDto, { siteId: SITE, questionIds: [SITE] })).toMatchObject({ siteId: SITE, questionIds: [SITE] });
        expect(await parse(SetTeamQuestionsDto, { siteId: SITE, questionIds: [] })).toMatchObject({ questionIds: [] });
        await expect(parse(SetTeamQuestionsDto, { siteId: SITE, questionIds: ['x'] })).rejects.toThrow();
        await expect(parse(SetTeamQuestionsDto, { questionIds: [SITE] })).rejects.toThrow();
        await expect(parse(SetTeamQuestionsDto, { siteId: 'x', questionIds: [] })).rejects.toThrow();
    });

    it('validates the per-period ratee override', async () => {
        expect(await parse(UpdatePeriodRateeDto, { tagline: ' Siap ', photoUrl: null, siteId: SITE }))
            .toMatchObject({ tagline: 'Siap', photoUrl: null, siteId: SITE });
        expect(await parse(UpdatePeriodRateeDto, { tagline: null })).toMatchObject({ tagline: null });
        await expect(parse(UpdatePeriodRateeDto, { tagline: 'x'.repeat(91) })).rejects.toThrow();
        await expect(parse(UpdatePeriodRateeDto, { photoUrl: '/uploads/csi/a.jpg' })).rejects.toThrow();
        await expect(parse(UpdatePeriodRateeDto, { siteId: 'x' })).rejects.toThrow();
        await expect(parse(UpdatePeriodRateeDto, { displayName: 'X' })).rejects.toThrow();
    });

    it('validates nested ratee assignments', async () => {
        await expect(parse(SetRateesDto, { ratees: [{ userId: SITE, dimensionIds: [] }] })).rejects.toThrow();
        await expect(parse(SetRateesDto, { ratees: [{ userId: 'x', dimensionIds: [SITE] }] })).rejects.toThrow();
        expect(await parse(SetRateesDto, { ratees: [{ userId: SITE, dimensionIds: [SITE] }] }))
            .toMatchObject({ ratees: [{ userId: SITE, dimensionIds: [SITE] }] });
    });
});
