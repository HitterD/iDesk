import { TicketPill } from '@/components/ui/ticket-pill';
import type { CsiQuestionType } from '../../../types';
import { QUESTION_TYPE_LABELS } from './questionCopy';

/** Small neutral chip naming the answer type of a question. */
export function QuestionTypeChip({ type }: { type: CsiQuestionType }) {
    return <TicketPill tone="neutral">{QUESTION_TYPE_LABELS[type]}</TicketPill>;
}
