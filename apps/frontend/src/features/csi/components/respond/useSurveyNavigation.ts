import { useEffect, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { buildSubmitPayload, isNameTaken, isNameValid, missingRequired } from '../../lib/csiForm';
import type { CsiOpenForm, SubmitCsiResponse } from '../../types';
import { answeredScreens, firstIncomplete, type SurveyAnswers } from './useSurveyAnswers';

type Ratee = CsiOpenForm['ratees'][number];
const NO_MISSING: ReadonlySet<string> = new Set();

const missingIn = (ratee: Ratee, answers: SurveyAnswers['draft']['answers']) =>
    new Set(missingRequired(ratee, answers).map((dimension) => dimension.periodRateeDimensionId));

/** Scrolls the first highlighted (missing) star row into view once it has rendered. */
function useScrollToMissing(attempt: number) {
    const reduce = useReducedMotion();
    useEffect(() => {
        if (!attempt) return;
        document.querySelector('[data-missing]')?.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
    }, [attempt, reduce]);
}

interface NavigationOptions {
    form: CsiOpenForm;
    answers: SurveyAnswers;
    preview: boolean;
    onSubmit?: (payload: SubmitCsiResponse) => void;
}

/**
 * Screen position (0 = intro, 1..n = ratees, n + 1 = review) and the guards around it:
 * missing required answers block "Lanjut", and leaving the last ratee or sending returns to anyone skipped via the chips.
 */
export function useSurveyNavigation({ form, answers, preview, onSubmit }: NavigationOptions) {
    const { draft } = answers;
    const [flagged, setFlagged] = useState(false);
    const [attempt, setAttempt] = useState(0);
    const [motion, setMotion] = useState({ navigated: false, direction: 1 });
    useScrollToMissing(attempt);

    const reviewPosition = form.ratees.length + 1;
    const position = Math.min(draft.position, reviewPosition);
    // Ratee indexes (0-based) the respondent has opened; a restored draft counts screens it already answered on.
    const [visited, setVisited] = useState<ReadonlySet<number>>(() => new Set([...answeredScreens(form, draft.answers), position - 1]));
    const ratee = position >= 1 && position < reviewPosition ? form.ratees[position - 1] : null;

    const goTo = (target: number) => {
        setFlagged(false);
        setMotion({ navigated: true, direction: target >= position ? 1 : -1 });
        setVisited((previous) => new Set(previous).add(target - 1));
        answers.setPosition(target);
    };
    const flag = () => {
        setFlagged(true);
        setAttempt((count) => count + 1);
    };
    const guardComplete = () => {
        const pending = firstIncomplete(form, draft.answers);
        if (pending === -1) return true;
        if (pending + 1 !== position) goTo(pending + 1);
        flag();
        return false;
    };
    const next = (): void => {
        if (ratee && missingIn(ratee, draft.answers).size > 0) return flag();
        if (position === reviewPosition - 1 && !guardComplete()) return;
        goTo(position + 1);
    };
    const submit = (): void => {
        if (preview) return;
        if (!draft.departmentId || !isNameValid(draft.respondentName) || isNameTaken(draft.respondentName, form.submittedNames)) return goTo(0);
        if (!guardComplete()) return;
        answers.settle();
        onSubmit?.(buildSubmitPayload(form, { name: draft.respondentName, departmentId: draft.departmentId, answers: draft.answers, comments: draft.comments }));
    };
    const missing = ratee && flagged ? missingIn(ratee, draft.answers) : NO_MISSING;
    return { position, reviewPosition, ratee, missing, visited, navigated: motion.navigated, direction: motion.direction, goTo, next, submit };
}
