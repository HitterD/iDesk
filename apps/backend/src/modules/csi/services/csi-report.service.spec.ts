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

/** Aggregates in memory exactly like the two GROUP BY queries the report issues (AVG comes back as a string). */
function itemRepository(rows: any[]) {
    const repo: any = memoryRepository(rows);
    repo.createQueryBuilder = jest.fn(() => {
        const builder: any = { params: {}, group: '' };
        for (const method of ['select', 'addSelect']) builder[method] = jest.fn(() => builder);
        builder.where = jest.fn((_sql: string, params: any) => { builder.params = params; return builder; });
        builder.groupBy = jest.fn((column: string) => { builder.group = column; return builder; });
        builder.getRawMany = jest.fn(async () => {
            const scoped = rows.filter((row) => builder.params.rateeIds.includes(row.periodRateeId));
            const byKey = new Map<string, any[]>();
            const key = builder.group.endsWith('periodRateeDimensionId') ? 'periodRateeDimensionId' : 'periodRateeId';
            for (const row of scoped) byKey.set(row[key], [...(byKey.get(row[key]) ?? []), row]);
            return [...byKey.entries()].map(([id, group]) => key === 'periodRateeDimensionId'
                ? { periodRateeDimensionId: id, average: String(group.reduce((sum, row) => sum + row.score, 0) / group.length), count: String(group.length) }
                : { periodRateeId: id, respondents: String(new Set(group.map((row) => row.responseId)).size) });
        });
        return builder;
    });
    return repo;
}

const period = (over: Partial<CsiPeriod> = {}) => ({
    id: 'p1', scope: ICT, siteId: 'site-a', title: 'CSI ICT Oktober', intro: 'Mohon diisi', thankYou: 'Terima kasih!',
    startDate: '2026-10-01', endDate: '2026-10-31', respondentMode: CsiRespondentMode.OPEN, createdById: 'admin', ...over,
});

const ratee1 = { id: 'r1', periodId: 'p1', userId: 'u1', displayName: 'Budi', jobTitle: 'Teknisi', sortOrder: 0 };
const ratee2 = { id: 'r2', periodId: 'p1', userId: 'u2', displayName: 'Sari', jobTitle: null, sortOrder: 1 };
const dimA = { id: 'rd1a', periodRateeId: 'r1', dimensionId: 'd1', dimensionName: 'Responsif', sortOrder: 0 };
const dimB = { id: 'rd1b', periodRateeId: 'r1', dimensionId: 'd2', dimensionName: 'Ramah', sortOrder: 1 };
const dim2A = { id: 'rd2a', periodRateeId: 'r2', dimensionId: 'd1', dimensionName: 'Responsif', sortOrder: 0 };

describe('CsiReportService', () => {
    let periods: ReturnType<typeof memoryRepository>;
    let responses: ReturnType<typeof memoryRepository>;
    let periodRaters: ReturnType<typeof memoryRepository>;
    let items: any;
    let comments: ReturnType<typeof memoryRepository>;
    let audit: { log: jest.Mock };
    let manager: any;
    let deleted: Array<{ target: unknown; criteria: any }>;
    let service: CsiReportService;

    beforeEach(() => {
        periods = memoryRepository<any>([period(), period({ id: 'p-hc', scope: HC })]);
        const ratees = memoryRepository<any>([ratee2, ratee1]);
        const rateeDimensions = memoryRepository<any>([dimB, dimA, dim2A]);
        periodRaters = memoryRepository<any>([]);
        responses = memoryRepository<any>([
            { id: 'resp2', periodId: 'p1', respondentId: 'x2', departmentName: 'Gudang', submittedAt: new Date('2026-10-12T03:00:00Z'), respondent: { id: 'x2', fullName: 'Wati' } },
            { id: 'resp1', periodId: 'p1', respondentId: 'x1', departmentName: 'Keuangan', submittedAt: new Date('2026-10-10T03:00:00Z'), respondent: { id: 'x1', fullName: 'Andi' } },
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
        service = new CsiReportService(
            periods as any, ratees as any, rateeDimensions as any, periodRaters as any,
            responses as any, items, comments as any, dataSource as any, audit as any,
        );
    });

    it('average is mean of dimension means', async () => {
        const report = await service.getReport(ICT, 'p1');
        const budi = report.ratees[0];
        expect(budi.displayName).toBe('Budi');
        expect(budi.dimensions).toEqual([
            { name: 'Responsif', average: 4, count: 2 },
            { name: 'Ramah', average: 2, count: 1 },
        ]);
        expect(budi.average).toBe(3);
        expect(budi.indexPct).toBe(60);
        expect(budi.respondentCount).toBe(2);
    });

    it('ratee without responses has null average', async () => {
        const report = await service.getReport(ICT, 'p1');
        const sari = report.ratees[1];
        expect(sari).toMatchObject({ displayName: 'Sari', respondentCount: 0, average: null, indexPct: null });
        expect(sari.dimensions).toEqual([{ name: 'Responsif', average: null, count: 0 }]);
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
        expect(result.submitted.map((row) => row.fullName)).toEqual(['Andi', 'Wati']);
        expect(result.submitted[0]).toEqual({ responseId: 'resp1', fullName: 'Andi', departmentName: 'Keuangan', submittedAt: new Date('2026-10-10T03:00:00Z') });
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
        expect(detail).toMatchObject({ responseId: 'resp1', fullName: 'Andi', departmentName: 'Keuangan' });
        expect(detail.ratees).toEqual([{
            periodRateeId: 'r1', displayName: 'Budi', jobTitle: 'Teknisi', comment: 'Cepat tanggap',
            scores: [{ dimension: 'Responsif', score: 5 }, { dimension: 'Ramah', score: 2 }],
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
                periodId: 'p1', respondentId: 'x1', respondentName: 'Andi', departmentName: 'Keuangan',
                submittedAt: new Date('2026-10-10T03:00:00Z'),
                scores: [{ ratee: 'Budi', dimension: 'Responsif', score: 5 }, { ratee: 'Budi', dimension: 'Ramah', score: 2 }],
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
