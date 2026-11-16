import { useCsiDimensions } from '../../hooks/useCsi';
import type { CsiPeriodDetail, CsiScopeParam } from '../../types';
import { PeriodQuestionModes } from '../admin/PeriodQuestionModes';
import { QuestionList } from '../admin/questions/QuestionList';
import { StepMaster } from './StepMaster';
import { STEP_TITLES, WIZARD_COPY } from './wizardCopy';

/** The same inline editor as Pengaturan; shown as a summary when the shared bank already has questions. */
export function StepQuestions({ scope, period }: { scope: CsiScopeParam; period?: CsiPeriodDetail }) {
    const { data: questions = [] } = useCsiDimensions(scope);
    return (
        <StepMaster title={STEP_TITLES.questions} note={WIZARD_COPY.questionsNote}
            summary={questions.length ? `${questions.length} pertanyaan aktif. Pilih yang dipakai di langkah berikutnya.` : null}>
            <div className="grid gap-5">
                {period && <PeriodQuestionModes scope={scope} period={period} />}
                <QuestionList scope={scope} />
            </div>
        </StepMaster>
    );
}
