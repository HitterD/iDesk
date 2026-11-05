import { useCsiDepartments } from '../../hooks/useCsi';
import type { CsiScopeParam } from '../../types';
import { DepartmentsTab } from '../admin/DepartmentsTab';
import { StepMaster } from './StepMaster';
import { WIZARD_COPY } from './wizardCopy';

/** Shared department list: shown as a summary when it is already filled. */
export function StepDepartments({ scope }: { scope: CsiScopeParam }) {
    const { data: departments = [] } = useCsiDepartments(scope);
    return (
        <StepMaster title="Departemen" note={WIZARD_COPY.departmentsNote}
            summary={departments.length ? `${departments.length} departemen aktif siap dipakai responden` : null}>
            <DepartmentsTab scope={scope} />
        </StepMaster>
    );
}
