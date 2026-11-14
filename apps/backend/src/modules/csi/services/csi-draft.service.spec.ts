import { ConflictException, ValidationPipe } from '@nestjs/common';
import { CsiQuestionType } from '../csi.constants';
import { SaveDraftDto } from '../dto/draft.dto';
import { CsiDraftService } from './csi-draft.service';

describe('CsiDraftService', () => {
    const PERIOD_ID = '11111111-1111-4111-8111-111111111111';
    const USER_ID = '22222222-2222-4222-8222-222222222222';
    const DEPT_ID = '33333333-3333-4333-8333-333333333333';
    const RATEE_ID = '44444444-4444-4444-8444-444444444444';
    const DIM_STAR = '55555555-5555-4555-8555-555555555555';
    const DIM_TEXT = '66666666-6666-4666-8666-666666666666';
    const DIM_CHOICE = '77777777-7777-4777-8777-777777777777';

    const makeHarness = (overrides?: { submittedAt?: Date | null; respondentPicks?: boolean }) => {
        const draftsRepo = {
            find: jest.fn().mockResolvedValue([]),
            findOne: jest.fn().mockResolvedValue(null),
            upsert: jest.fn().mockResolvedValue(undefined),
            delete: jest.fn().mockResolvedValue(undefined),
        };
        const respondent = {
            draftContext: jest.fn().mockResolvedValue({
                period: { id: PERIOD_ID, respondentPicks: overrides?.respondentPicks ?? false },
                respondentId: USER_ID,
                ratees: [{ id: RATEE_ID }],
                dimensions: [
                    { id: DIM_STAR, periodRateeId: RATEE_ID, type: CsiQuestionType.STAR, options: null },
                    { id: DIM_TEXT, periodRateeId: RATEE_ID, type: CsiQuestionType.TEXT, options: null },
                    { id: DIM_CHOICE, periodRateeId: RATEE_ID, type: CsiQuestionType.CHOICE, options: [{ label: 'A', points: 1 }, { label: 'B', points: 2 }] },
                ],
                departmentIds: new Set([DEPT_ID]),
                submittedAt: overrides?.submittedAt ?? null,
            }),
        };
        const service = new CsiDraftService(draftsRepo as any, respondent as any);
        return { service, draftsRepo, respondent };
    };

    it('marks only unsubmitted periods that have a saved draft row', async () => {
        const { service, draftsRepo } = makeHarness();
        const OTHER_PERIOD = '99999999-9999-4999-8999-999999999999';
        draftsRepo.find.mockResolvedValue([{ periodId: PERIOD_ID }]);

        const result = await service.withDraftFlags(USER_ID, [
            { id: PERIOD_ID, submitted: false },
            { id: OTHER_PERIOD, submitted: true },
        ]);

        expect(draftsRepo.find).toHaveBeenCalledWith({
            where: { respondentId: USER_ID, periodId: expect.anything() },
            select: { periodId: true },
        });
        expect(result).toEqual([
            { id: PERIOD_ID, submitted: false, hasDraft: true },
            { id: OTHER_PERIOD, submitted: true, hasDraft: false },
        ]);
    });

    it('sanitizes invalid keys/out-of-range answers and persists valid draft via upsert', async () => {
        const { service, draftsRepo } = makeHarness({ respondentPicks: true });
        const now = new Date('2026-11-14T10:00:00.000Z');

        const res = await service.save(
            { id: USER_ID },
            PERIOD_ID,
            {
                departmentId: DEPT_ID,
                position: 5, // clamped to ratees.length (1)
                answers: {
                    [RATEE_ID]: {
                        [DIM_STAR]: 4,
                        [DIM_TEXT]: '  Respons cepat  ',
                        [DIM_CHOICE]: 1,
                        'unknown-dim': 5,
                    },
                    'unknown-ratee': { [DIM_STAR]: 5 },
                },
                comments: {
                    [RATEE_ID]: '  Bagus  ',
                    'unknown-ratee': 'spam',
                },
                picks: [RATEE_ID, RATEE_ID, 'unknown-ratee'],
            },
            now,
        );

        expect(draftsRepo.upsert).toHaveBeenCalledWith(
            {
                periodId: PERIOD_ID,
                respondentId: USER_ID,
                departmentId: DEPT_ID,
                position: 1,
                answers: {
                    [RATEE_ID]: {
                        [DIM_STAR]: 4,
                        [DIM_TEXT]: 'Respons cepat',
                        [DIM_CHOICE]: 1,
                    },
                },
                comments: { [RATEE_ID]: 'Bagus' },
                picks: [RATEE_ID],
                updatedAt: now,
            },
            ['periodId', 'respondentId'],
        );
        expect(res.draft).toEqual({
            departmentId: DEPT_ID,
            position: 1,
            answers: { [RATEE_ID]: { [DIM_STAR]: 4, [DIM_TEXT]: 'Respons cepat', [DIM_CHOICE]: 1 } },
            comments: { [RATEE_ID]: 'Bagus' },
            picks: [RATEE_ID],
            updatedAt: '2026-11-14T10:00:00.000Z',
        });
    });

    it('deletes the server draft when all fields become empty instead of keeping an empty row', async () => {
        const { service, draftsRepo } = makeHarness();
        const res = await service.save({ id: USER_ID }, PERIOD_ID, {
            departmentId: null,
            position: 0,
            answers: {},
            comments: {},
            picks: null,
        });

        expect(draftsRepo.delete).toHaveBeenCalledWith({ periodId: PERIOD_ID, respondentId: USER_ID });
        expect(draftsRepo.upsert).not.toHaveBeenCalled();
        expect(res).toEqual({ draft: null });
    });

    it('rejects saving a draft after the respondent has already submitted', async () => {
        const { service } = makeHarness({ submittedAt: new Date('2026-11-14T09:00:00.000Z') });
        await expect(service.save({ id: USER_ID }, PERIOD_ID, { departmentId: DEPT_ID })).rejects.toThrow(ConflictException);
    });

    it('passes the global ValidationPipe (whitelist + forbidNonWhitelisted) with nested Record answers/comments', async () => {
        const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
        const payload = {
            departmentId: DEPT_ID,
            position: 0,
            answers: { [RATEE_ID]: { [DIM_STAR]: 5, [DIM_TEXT]: 'Oke' } },
            comments: { [RATEE_ID]: 'Mantap' },
            picks: [RATEE_ID],
        };

        const validated = await pipe.transform(payload, { type: 'body', metatype: SaveDraftDto });
        expect(validated).toEqual(expect.objectContaining({
            departmentId: DEPT_ID,
            position: 0,
            answers: payload.answers,
            comments: payload.comments,
            picks: payload.picks,
        }));
    });
});
