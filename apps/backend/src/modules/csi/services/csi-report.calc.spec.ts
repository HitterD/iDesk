import { questionStat } from './csi-report.calc';
import { CsiQuestionType } from '../csi.constants';
import { CsiPeriodRateeDimension } from '../entities/csi-period-ratee-dimension.entity';

describe('CSI text question report', () => {
    it('includes text answers without assigning a numeric average', () => {
        const dimension = { id: 'q1', dimensionName: 'Saran', type: CsiQuestionType.TEXT, options: [] } as unknown as CsiPeriodRateeDimension;
        const items = [{ responseId: 'a', periodRateeId: 'r1', periodRateeDimensionId: 'q1', score: null, answerLabel: null, answerText: 'Respons sudah baik' }];
        const result = questionStat(dimension, items);
        expect(result.average).toBeNull();
        expect(result.distribution).toEqual([{ label: 'Respons sudah baik', count: 1 }]);
    });
});
