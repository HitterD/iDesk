import { useCsiDimensions } from '../../hooks/useCsi';
import type { CsiScopeParam } from '../../types';
import { QuestionList } from '../admin/questions/QuestionList';
import { StepMaster } from './StepMaster';
import { STEP_TITLES, WIZARD_COPY } from './wizardCopy';

/** The same inline editor as Pengaturan; shown as a summary when the shared bank already has questions. */
export function StepQuestions({ scope }: { scope: CsiScopeParam }) {
    const { data: questions = [] } = useCsiDimensions(scope);
    return (
        <StepMaster title={STEP_TITLES.questions} note={WIZARD_COPY.questionsNote}
            summary={questions.length ? `${questions.length} pertanyaan aktif. Pilih yang dipakai di langkah berikutnya.` : null}>
            <QuestionList scope={scope} />
        </StepMaster>
    );
}
