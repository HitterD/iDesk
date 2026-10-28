import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { AuditAction } from '../../audit/entities/audit-log.entity';
import { CsiRespondentMode } from '../csi.constants';
import { CsiPeriod } from '../entities/csi-period.entity';
import { CsiResponseComment } from '../entities/csi-response-comment.entity';
import { CsiResponseItem } from '../entities/csi-response-item.entity';
import { CsiResponse } from '../entities/csi-response.entity';
import { CsiReportService } from './csi-report.service';

const ICT = ServiceScope.ICT;
const HC = ServiceScope.HC;

/** Equality filter good enough for the plain where clauses the service uses (plus In()). */
function matches(row: Record<string, any>, where: Record<string, any> = {}): boolean {
    return Object.entries(where).every(([key, value]): boolean => {
        if (value && typeof value === 'object' && '_type' in value) {
            if (value._type === 'in') return value._value.includes(row[key]);
            throw new Error(`Unsupported operator ${value._type}`);
        }
        return row[key] === value;
    });
}

function sortRows<T extends Record<string, any>>(rows: T[], order: Record<string, 'ASC' | 'DESC'> = {}) {
    const [key, direction] = Object.entries(order)[0] ?? [];
    if (!key) return rows;
    const sign = direction === 'DESC' ? -1 : 1;
    return [...rows].sort((a, b) => (a[key] < b[key] ? -sign : a[key] > b[key] ? sign : 0));
}

function memoryRepository<T extends Record<string, any>>(rows: T[] = []) {
    return {
        rows,
        find: jest.fn(async (options: any = {}) => sortRows(rows.filter((row) => matches(row, options.where)), options.order)),
        findOne: jest.fn(async (options: any = {}) => rows.find((row) => matches(row, options.where)) ?? null),
        count: jest.fn(async (options: any = {}) => rows.filter((row) => matches(row, options.where)).length),
    };
}

const itemRepository = (rows: any[]) => memoryRepository(rows);

const period = (over: Partial<CsiPeriod> = {}) => ({
    id: 'p1', scope: ICT, sites: [{ siteId: 'site-a' }] as CsiPeriod['sites'], title: 'CSI ICT Oktober', intro: 'Mohon diisi', thankYou: 'Terima kasih!',
    startDate: '2026-10-01', endDate: '2026-10-31', respondentMode: CsiRespondentMode.OPEN, createdById: 'admin', ...over,
});

const ratee1 = { id: 'r1', periodId: 'p1', kind: 'PERSON', userId: 'u1', displayName: 'Budi', jobTitle: 'Teknisi', sortOrder: 0 };
const ratee2 = { id: 'r2', periodId: 'p1', kind: 'PERSON', userId: 'u2', displayName: 'Sari', jobTitle: null, sortOrder: 1 };
const dimA = { id: 'rd1a', periodRateeId: 'r1', dimensionId: 'd1', dimensionName: 'Responsif', type: 'STAR', options: [], sortOrder: 0 };
const dimB = { id: 'rd1b', periodRateeId: 'r1', dimensionId: 'd2', dimensionName: 'Ramah', type: 'STAR', options: [], sortOrder: 1 };
const dim2A = { id: 'rd2a', periodRateeId: 'r2', dimensionId: 'd1', dimensionName: 'Responsif', type: 'STAR', options: [], sortOrder: 0 };

describe('CsiReportService', () => {
    let periods: ReturnType<typeof memoryRepository>;
    let responses: ReturnType<typeof memoryRepository>;
    let periodRaters: ReturnType<typeof memoryRepository>;
    let rateeDimensions: ReturnType<typeof memoryRepository>;
    let items: any;
    let comments: ReturnType<typeof memoryRepository>;
    let audit: { log: jest.Mock };
    let manager: any;
    let deleted: Array<{ target: unknown; criteria: any }>;
    let sla: { compute: jest.Mock };
    let service: CsiReportService;

    beforeEach(() => {
        periods = memoryRepository<any>([period(), period({ id: 'p-hc', scope: HC })]);
        const ratees = memoryRepository<any>([ratee2, ratee1]);
        rateeDimensions = memoryRepository<any>([dimB, dimA, dim2A]);
        periodRaters = memoryRepository<any>([]);
        responses = memoryRepository<any>([
            { id: 'resp2', periodId: 'p1', respondentId: 'x2', departmentName: 'Gudang', submittedAt: new Date('2026-10-12T03:00:00Z'), respondentName: 'Wati Nama', respondent: { id: 'x2', fullName: 'Wati', site: { name: 'Sepanjang' } } },
            { id: 'resp1', periodId: 'p1', respondentId: 'x1', departmentName: 'Keuangan', submittedAt: new Date('2026-10-10T03:00:00Z'), respondentName: 'Andi Nama', respondent: { id: 'x1', fullName: 'Andi', site: null } },
        ]);
        // Dimension A: 5 and 3 -> 4; dimension B: only 2 -> 2. Ratee 2 has no scores at all.
        items = itemRepository([
            { id: 'i1', responseId: 'resp1', periodRateeId: 'r1', periodRateeDimensionId: 'rd1a', score: 5, periodRatee: ratee1, periodRateeDimension: dimA },
            { id: 'i2', responseId: 'resp1', periodRateeId: 'r1', periodRateeDimensionId: 'rd1b', score: 2, periodRatee: ratee1, periodRateeDimension: dimB },
            { id: 'i3', responseId: 'resp2', periodRateeId: 'r1', periodRateeDimensionId: 'rd1a', score: 3, periodRatee: ratee1, periodRateeDimension: dimA },
        ]);
        comments = memoryRepository<any>([{ id: 'c1', responseId: 'resp1', periodRateeId: 'r1', comment: 'Cepat tanggap' }]);
        audit = { log: jest.fn(async () => ({})) };
        deleted = [];
        const txRepos = new Map<unknown, any>([[CsiResponse, responses], [CsiResponseItem, items], [CsiResponseComment, comments]]);
        manager = {
            getRepository: jest.fn((target: unknown) => {
                if (target === CsiPeriod) {
                    const builder: any = { params: {} };
                    builder.setLock = jest.fn(() => builder);
                    builder.where = jest.fn((_sql: string, params: any) => { builder.params = params; return builder; });
                    builder.getOne = jest.fn(async () => periods.rows.find((row) => row.id === builder.params.id) ?? null);
                    return { createQueryBuilder: jest.fn(() => builder), builder };
                }
                return txRepos.get(target);
            }),
            delete: jest.fn(async (target: unknown, criteria: any) => {
                deleted.push({ target, criteria });
                const index = responses.rows.findIndex((row) => row.id === criteria.id);
                if (index >= 0) responses.rows.splice(index, 1);
            }),
        };
        const dataSource = { transaction: jest.fn(async (work: (m: any) => unknown) => work(manager)) };
        sla = { compute: jest.fn(async () => ({ basis: 0, pengisiPct: null })) };
        service = new CsiReportService(
            periods as any, ratees as any, rateeDimensions as any, periodRaters as any,
            responses as any, items, comments as any, dataSource as any, audit as any, sla as any,
        );
    });

    it('ratee average is mean of response averages', async () => {
        const report = await service.getReport(ICT, 'p1');
        const budi = report.ratees[0];
        expect(budi.displayName).toBe('Budi');
        // resp1 scores 5,2 -> 3.5; resp2 scores 3 -> 3; mean of response averages = 3.25 (not the question-mean 3)
        expect(budi.average).toBe(3.25);
        expect(budi.indexPct).toBe(65);
        expect(budi.respondentCount).toBe(2);
        expect(budi.questions).toEqual([
            { name: 'Responsif', type: 'STAR', average: 4, count: 2, distribution: [
                { label: '1', count: 0 }, { label: '2', count: 0 }, { label: '3', count: 1 }, { label: '4', count: 0 }, { label: '5', count: 1 },
            ] },
            { name: 'Ramah', type: 'STAR', average: 2, count: 1, distribution: [
                { label: '1', count: 0 }, { label: '2', count: 1 }, { label: '3', count: 0 }, { label: '4', count: 0 }, { label: '5', count: 0 },
            ] },
        ]);
    });

    it('ratees of a disabled section are left out of the report', async () => {
        const team = { id: 'rt', periodId: 'p1', kind: 'TEAM', userId: null, displayName: 'Tim IT Support', jobTitle: null, sortOrder: -1 };
        (service as any).ratees.rows.push(team);
        periods.rows[0] = { ...periods.rows[0], teamEnabled: false, individualEnabled: true };
        expect((await service.getReport(ICT, 'p1')).ratees.map((row) => row.displayName)).toEqual(['Budi', 'Sari']);
        periods.rows[0] = { ...periods.rows[0], teamEnabled: true, individualEnabled: false };
        expect((await service.getReport(ICT, 'p1')).ratees.map((row) => row.displayName)).toEqual(['Tim IT Support']);
    });

    it('reset audit log keeps choice and text answers, not only scores', async () => {
        items.rows.push({ id: 'tx', responseId: 'resp1', periodRateeId: 'r1', periodRateeDimensionId: 'rd1b', score: null, answerLabel: null, answerText: 'Ramah sekali', periodRatee: ratee1, periodRateeDimension: dimB });
        await service.resetResponse(ICT, 'p1', 'resp1', 'Salah input', { id: 'admin' });
        const logged = audit.log.mock.calls[0][0].oldValue.scores;
        expect(logged).toContainEqual(expect.objectContaining({ dimension: 'Ramah', score: null, answerText: 'Ramah sekali' }));
    });

    it('report reads legacy STAR answers', async () => {
        // Legacy rows have no type/options on the snapshot and no answerLabel/answerText on items.
        for (const dimension of [dimA, dimB]) { delete (dimension as any).type; delete (dimension as any).options; }
        const report = await service.getReport(ICT, 'p1');
        expect(report.ratees[0].average).toBe(3.25);
        expect(report.ratees[0].questions[0]).toMatchObject({ type: 'STAR', average: 4, count: 2 });
        expect(report.period.sites).toEqual([{ id: 'site-a', code: null, name: null }]);
        dimA.type = 'STAR'; dimA.options = []; dimB.type = 'STAR'; dimB.options = [];
    });

    it('overall average uses all scored items', async () => {
        responses.rows.push({ id: 'resp9', periodId: 'p1', respondentId: 'x9', respondentName: 'titi yusliyanti', departmentName: 'D', submittedAt: new Date(), respondent: { fullName: 'T' } });
        [4, 5, 4, 4, 4, 5, 4, 4].forEach((score, index) => items.rows.push({
            id: `t${index}`, responseId: 'resp9', periodRateeId: 'r2', periodRateeDimensionId: 'rd2a', score,
            periodRatee: ratee2, periodRateeDimension: dim2A,
        }));
        const report = await service.getReport(ICT, 'p1');
        // responses: 3.5, 3, 4.25 -> (3.5 + 3 + 4.25) / 3 = 3.58
        expect(report.overall).toEqual({ average: 3.58, respondentCount: 3 });
        expect(report.sla).toEqual({ basis: 0, pengisiPct: null });
        expect(sla.compute).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1' }), [{ id: 'site-a', code: null, name: null }], 3);
    });

    it('CHOICE and TEXT questions have null average and keep their answers', async () => {
        const choice = { id: 'rd1c', periodRateeId: 'r1', dimensionId: 'd3', dimensionName: 'Channel', type: 'CHOICE', options: [{ label: 'Telepon', points: null }, { label: 'Email', points: null }], sortOrder: 2 };
        const text = { id: 'rd1t', periodRateeId: 'r1', dimensionId: 'd4', dimensionName: 'Saran', type: 'TEXT', options: [], sortOrder: 3 };
        rateeDimensions.rows.push(choice, text);
        items.rows.push(
            { id: 'c1', responseId: 'resp1', periodRateeId: 'r1', periodRateeDimensionId: 'rd1c', score: null, answerLabel: 'Email', answerText: null, periodRatee: ratee1, periodRateeDimension: choice },
            { id: 'c2', responseId: 'resp1', periodRateeId: 'r1', periodRateeDimensionId: 'rd1t', score: null, answerLabel: null, answerText: 'Mantap', periodRatee: ratee1, periodRateeDimension: text },
        );
        const report = await service.getReport(ICT, 'p1');
        const [, , channel, saran] = report.ratees[0].questions;
        expect(channel).toEqual({ name: 'Channel', type: 'CHOICE', average: null, count: 0, distribution: [{ label: 'Telepon', count: 0 }, { label: 'Email', count: 1 }] });
        expect(saran).toEqual({ name: 'Saran', type: 'TEXT', average: null, count: 0, distribution: [{ label: 'Mantap', count: 1 }] });
        expect(report.ratees[0].average).toBe(3.25);
        const detail = await service.getResponseDetail(ICT, 'p1', 'resp1');
        expect(detail.ratees[0].scores.slice(2)).toEqual([
            { dimension: 'Channel', type: 'CHOICE', score: null, answerLabel: 'Email', answerText: null },
            { dimension: 'Saran', type: 'TEXT', score: null, answerLabel: null, answerText: 'Mantap' },
        ]);
    });

    it('ratee without responses has null average', async () => {
        const report = await service.getReport(ICT, 'p1');
        const sari = report.ratees[1];
        expect(sari).toMatchObject({ displayName: 'Sari', respondentCount: 0, average: null, indexPct: null });
        expect(sari.questions).toEqual([expect.objectContaining({ name: 'Responsif', average: null, count: 0 })]);
    });

    it('report rejects period of other scope (404)', async () => {
        await expect(service.getReport(ICT, 'p-hc')).rejects.toThrow(NotFoundException);
        await expect(service.getReport(ICT, 'missing')).rejects.toThrow(NotFoundException);
    });

    it('pending lists LISTED raters without response', async () => {
        periods.rows[0].respondentMode = CsiRespondentMode.LISTED;
        periodRaters.rows.push(
            { id: 'pr1', periodId: 'p1', userId: 'x1', user: { id: 'x1', fullName: 'Andi' } },
            { id: 'pr3', periodId: 'p1', userId: 'x3', user: { id: 'x3', fullName: 'Yudi' } },
            { id: 'pr4', periodId: 'p1', userId: 'x4', user: { id: 'x4', fullName: 'Citra' } },
        );
        const result = await service.getRespondents(ICT, 'p1');
        expect(result.mode).toBe(CsiRespondentMode.LISTED);
        expect(result.submitted.map((row) => row.respondentName)).toEqual(['Andi Nama', 'Wati Nama']);
        expect(result.submitted[0]).toEqual({ responseId: 'resp1', respondentName: 'Andi Nama', accountName: 'Andi', departmentName: 'Keuangan', submittedAt: new Date('2026-10-10T03:00:00Z') });
        expect(result.pending).toEqual([{ userId: 'x4', fullName: 'Citra' }, { userId: 'x3', fullName: 'Yudi' }]);
        expect(result.totals).toEqual({ submitted: 2, pending: 2 });
    });

    it('pending is null for OPEN', async () => {
        const result = await service.getRespondents(ICT, 'p1');
        expect(result.pending).toBeNull();
        expect(result.totals).toEqual({ submitted: 2, pending: null });
    });

    it('response detail lists scores and comments per ratee, 404 for other period', async () => {
        const detail = await service.getResponseDetail(ICT, 'p1', 'resp1');
        expect(detail).toMatchObject({ responseId: 'resp1', respondentName: 'Andi Nama', accountName: 'Andi', areaName: null, departmentName: 'Keuangan' });
        expect(detail.ratees).toEqual([{
            periodRateeId: 'r1', kind: 'PERSON', displayName: 'Budi', jobTitle: 'Teknisi', comment: 'Cepat tanggap',
            scores: [{ dimension: 'Responsif', type: 'STAR', score: 5, answerLabel: null, answerText: null }, { dimension: 'Ramah', type: 'STAR', score: 2, answerLabel: null, answerText: null }],
        }]);
        await expect(service.getResponseDetail(ICT, 'p-hc', 'resp1')).rejects.toThrow(NotFoundException);
        await expect(service.getResponseDetail(ICT, 'p1', 'nope')).rejects.toThrow(NotFoundException);
    });

    it('reset requires reason ≥5 chars (400)', async () => {
        await expect(service.resetResponse(ICT, 'p1', 'resp1', '  abc  ', { id: 'admin' }, undefined))
            .rejects.toThrow(new BadRequestException('Alasan reset minimal 5 karakter'));
        expect(deleted).toHaveLength(0);
        expect(audit.log).not.toHaveBeenCalled();
    });

    it('reset writes audit log and allows resubmit', async () => {
        const req = { headers: {} } as any;
        await expect(service.resetResponse(ICT, 'p1', 'resp1', '  Salah isi departemen ', { id: 'admin' }, req))
            .resolves.toEqual({ reset: true });
        expect(manager.getRepository).toHaveBeenCalledWith(CsiPeriod);
        expect(deleted).toEqual([{ target: CsiResponse, criteria: { id: 'resp1' } }]);
        // Response row gone: the (period, respondent) unique slot is free, so the respondent can submit again.
        expect(await responses.count({ where: { periodId: 'p1', respondentId: 'x1' } })).toBe(0);
        expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({
            userId: 'admin', action: AuditAction.CSI_RESPONSE_RESET, entityType: 'csi_response', entityId: 'resp1', request: req,
            oldValue: {
                periodId: 'p1', respondentId: 'x1', respondentName: 'Andi Nama', departmentName: 'Keuangan',
                submittedAt: new Date('2026-10-10T03:00:00Z'),
                scores: [
                    { ratee: 'Budi', dimension: 'Responsif', score: 5, answerLabel: null, answerText: null },
                    { ratee: 'Budi', dimension: 'Ramah', score: 2, answerLabel: null, answerText: null },
                ],
            },
        }));
        expect(audit.log.mock.calls[0][0].description).toContain('Salah isi departemen');
    });

    it('reset of a response outside the period is 404 and writes nothing', async () => {
        await expect(service.resetResponse(ICT, 'p1', 'nope', 'alasan valid', { id: 'admin' }, undefined)).rejects.toThrow(NotFoundException);
        await expect(service.resetResponse(ICT, 'p-hc', 'resp1', 'alasan valid', { id: 'admin' }, undefined)).rejects.toThrow(NotFoundException);
        expect(deleted).toHaveLength(0);
        expect(audit.log).not.toHaveBeenCalled();
    });

    it('reset propagates audit failure', async () => {
        audit.log.mockRejectedValueOnce(new Error('audit down'));
        await expect(service.resetResponse(ICT, 'p1', 'resp1', 'alasan valid', { id: 'admin' }, undefined)).rejects.toThrow('audit down');
    });
});
