import { CsiPeriodPublishStatus } from '../csi.constants';
import { CsiPeriod } from '../entities/csi-period.entity';
import { computeStatus } from './csi-period.service';

/**
 * Where a survey stands for master edits (team delete, PIC rename): `finished` = published and ended, or cancelled;
 * `answered` = has responses; `running` = published and open now; `draft` = DRAFT whatever its dates, or published but
 * not started, without answers. Only drafts may still change their ratee snapshot.
 */
export type CsiSurveyStage = 'finished' | 'answered' | 'running' | 'draft';

export function surveyStage(period: Pick<CsiPeriod, 'publishStatus' | 'startDate' | 'endDate'>, answered: boolean, now: Date): CsiSurveyStage {
    const isDraft = period.publishStatus === CsiPeriodPublishStatus.DRAFT;
    const status = computeStatus(period, now);
    if (period.publishStatus === CsiPeriodPublishStatus.CANCELLED || (!isDraft && status === 'ENDED')) return 'finished';
    if (answered) return 'answered';
    if (!isDraft && status === 'ACTIVE') return 'running';
    return 'draft';
}
