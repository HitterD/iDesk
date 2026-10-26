import type { CsiScopeParam } from '../../types';
import { DepartmentsTab } from '../admin/DepartmentsTab';
import { StepMaster } from './StepMaster';
import { WIZARD_COPY } from './wizardCopy';

export function StepDepartments({ scope }: { scope: CsiScopeParam }) {
    return (
        <StepMaster title="Departemen" note={WIZARD_COPY.departmentsNote}>
            <DepartmentsTab scope={scope} compact />
        </StepMaster>
    );
}
