import type { CsiScopeParam } from '../../types';
import { QuestionList } from './questions/QuestionList';

/** Questions tab: the inline editor replaces the old dialog list. */
export function DimensionsTab({ scope }: { scope: CsiScopeParam }) {
    return <QuestionList scope={scope} />;
}
