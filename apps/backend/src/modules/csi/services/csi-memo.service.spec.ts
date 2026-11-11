import { NotFoundException } from '@nestjs/common';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { CsiMemoService } from './csi-memo.service';
import { memoHeader, memoSurvey } from './csi-memo.fixtures';

const NOW = new Date('2026-10-26T03:00:00Z');

describe('CsiMemoService', () => {
    let reports: { getReport: jest.Mock; listAnswers: jest.Mock; departmentParticipation: jest.Mock };
    let settings: { findOne: jest.Mock; save: jest.Mock };
    let service: CsiMemoService;

    beforeEach(() => {
        reports = {
            getReport: jest.fn(async (_scope: ServiceScope, id: string) => {
                if (id === 'other') throw new NotFoundException('Periode tidak ditemukan');
                return memoSurvey(id === 'p2' ? 2 : 1).report;
            }),
            listAnswers: jest.fn(async () => memoSurvey(1).answers),
            departmentParticipation: jest.fn(async () => [{ name: 'Finance', submitted: 2, total: 3, pct: 67, met: false }]),
        };
        settings = { findOne: jest.fn(async () => null), save: jest.fn(async (row) => row) };
        service = new CsiMemoService(reports as any, settings as any);
    });

    it('memo rejects period of other scope (404)', async () => {
        await expect(service.buildMemo(ServiceScope.ICT, ['p1', 'other'], memoHeader(), NOW)).rejects.toBeInstanceOf(NotFoundException);
        expect(settings.save).not.toHaveBeenCalled();
    });

    it('memo saves header as settings after a successful render', async () => {
        const header = memoHeader();
        const result = await service.buildMemo(ServiceScope.ICT, ['p1', 'p2'], header, NOW);
        expect(result.filename).toBe('csi-memo-ict-2026-10-26.pdf');
        expect(result.buffer.slice(0, 4).toString()).toBe('%PDF');
        expect(settings.save).toHaveBeenCalledWith({ scope: 'ICT', data: header });
        expect(reports.getReport.mock.calls.map((call) => call[1])).toEqual(['p1', 'p2']);
    });

    it('HC memo loads the anonymous participation per department; ICT never does', async () => {
        reports.getReport.mockImplementation(async () => ({ ...memoSurvey(1).report, period: { ...memoSurvey(1).report.period, scope: 'HC' } }));
        await service.buildMemo(ServiceScope.HC, ['p1'], memoHeader(), NOW);
        expect(reports.departmentParticipation).toHaveBeenCalledWith(ServiceScope.HC, 'p1', expect.objectContaining({ sla: expect.anything() }));
        reports.departmentParticipation.mockClear();
        reports.getReport.mockImplementation(async () => memoSurvey(1).report);
        await service.buildMemo(ServiceScope.ICT, ['p1'], memoHeader(), NOW);
        expect(reports.departmentParticipation).not.toHaveBeenCalled();
    });

    it('get settings returns saved header or empty defaults', async () => {
        expect(await service.getSettings(ServiceScope.HC)).toMatchObject({ to: '', opening: '', signerLeft: { name: '', title: '' } });
        const saved = memoHeader();
        settings.findOne.mockResolvedValue({ scope: 'HC', data: saved });
        expect(await service.getSettings(ServiceScope.HC)).toEqual(saved);
    });

    it('save settings upserts per scope', async () => {
        await service.saveSettings(ServiceScope.HC, memoHeader());
        expect(settings.save).toHaveBeenCalledWith({ scope: 'HC', data: memoHeader() });
    });
});
