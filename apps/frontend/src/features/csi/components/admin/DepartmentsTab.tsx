import type { CsiScopeParam } from '../../types';
import { InlineMasterList } from './InlineMasterList';

export function DepartmentsTab({ scope }: { scope: CsiScopeParam }) {
    return <InlineMasterList scope={scope} />;
}
