import type { CsiScopeParam } from '../../types';
import { QuestionList } from '../admin/questions/QuestionList';
import { StepMaster } from './StepMaster';
import { STEP_TITLES, WIZARD_COPY } from './wizardCopy';

/** The same inline editor as Master data: questions created here are shared by the team and per-person sections. */
export function StepQuestions({ scope }: { scope: CsiScopeParam }) {
    return (
        <StepMaster title={STEP_TITLES.questions} note={WIZARD_COPY.questionsNote}>
            <QuestionList scope={scope} />
        </StepMaster>
    );
}
