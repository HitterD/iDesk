import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { DEFAULT_TIMEZONE, localDateKey } from '../../sla-config/business-hours.calc';
import { MemoHeaderDto } from '../dto/memo.dto';
import { CsiMemoSetting } from '../entities/csi-memo-setting.entity';
import { renderMemoPdf } from './csi-memo-pdf';
import { CsiReportService } from './csi-report.service';

const EMPTY_SIGNER = { name: '', title: '' };
const EMPTY_HEADER = (): MemoHeaderDto => ({
    to: '', cc: '', number: '', from: '', subject: '', date: '', opening: '', closing: '',
    signerLeft: { ...EMPTY_SIGNER }, signerRight: { ...EMPTY_SIGNER },
});

@Injectable()
export class CsiMemoService {
    constructor(
        private readonly reports: CsiReportService,
        @InjectRepository(CsiMemoSetting) private readonly settings: Repository<CsiMemoSetting>,
    ) { }

    async getSettings(scope: ServiceScope): Promise<MemoHeaderDto> {
        const row = await this.settings.findOne({ where: { scope } });
        return row?.data ?? EMPTY_HEADER();
    }

    async saveSettings(scope: ServiceScope, header: MemoHeaderDto): Promise<MemoHeaderDto> {
        await this.settings.save({ scope, data: header });
        return header;
    }

    /** Renders the memo for the periods (in the given order); the header is remembered only after a successful render. */
    async buildMemo(scope: ServiceScope, periodIds: string[], header: MemoHeaderDto, now: Date = new Date()): Promise<{ filename: string; buffer: Buffer }> {
        // Sequential: each call asserts the period belongs to the scope (404 otherwise) before anything is rendered.
        const surveys = [];
        for (const periodId of periodIds) {
            const report = await this.reports.getReport(scope, periodId);
            const answers = await this.reports.listAnswers(scope, periodId);
            // HC memos never list raters: the SLA appendix shows participation per department instead.
            const departments = scope === ServiceScope.HC ? await this.reports.departmentParticipation(scope, periodId, report) : undefined;
            surveys.push({ report, answers, departments });
        }
        const buffer = await renderMemoPdf(header, surveys);
        await this.saveSettings(scope, header);
        return { filename: `csi-memo-${scope.toLowerCase()}-${localDateKey(now, DEFAULT_TIMEZONE)}.pdf`, buffer };
    }
}
