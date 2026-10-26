import type { CsiScopeParam } from '../../types';
import { DimensionsTab } from '../admin/DimensionsTab';
import { StepMaster } from './StepMaster';
import { WIZARD_COPY } from './wizardCopy';

export function StepDimensions({ scope }: { scope: CsiScopeParam }) {
    return (
        <StepMaster title="Dimensi" note={WIZARD_COPY.dimensionsNote}>
            <DimensionsTab scope={scope} compact />
        </StepMaster>
    );
}
