import type { Ref } from 'react';
import type { WizardStepKey } from '../../lib/wizard';
import type { CsiPeriodDetail, CsiScopeParam } from '../../types';
import type { PeriodEditorStatus } from '../admin/PeriodEditor';
import { StepDepartments } from './StepDepartments';
import { StepDimensions } from './StepDimensions';
import { StepInfo } from './StepInfo';
import { StepRaters } from './StepRaters';
import { StepRatees } from './StepRatees';
import { StepReview } from './StepReview';

export interface WizardStepBodyProps {
    scope: CsiScopeParam;
    step: WizardStepKey;
    period: CsiPeriodDetail | undefined;
    formRef: Ref<HTMLFormElement>;
    onInfoStatus: (status: PeriodEditorStatus) => void;
    onInfoSaved: (period: CsiPeriodDetail) => void;
    onDirtyChange: (dirty: boolean) => void;
    onEditStep: (step: WizardStepKey) => void;
    onPublished: (periodId: string) => void;
}

export function WizardStepBody(props: WizardStepBodyProps) {
    const { scope, step, period } = props;
    if (step === 'info' || !period) {
        return <StepInfo scope={scope} period={period} formRef={props.formRef} onStatusChange={props.onInfoStatus} onSaved={props.onInfoSaved} />;
    }
    switch (step) {
        case 'dimensions': return <StepDimensions scope={scope} />;
        case 'ratees': return <StepRatees scope={scope} period={period} onDirtyChange={props.onDirtyChange} />;
        case 'raters': return <StepRaters scope={scope} period={period} onDirtyChange={props.onDirtyChange} />;
        case 'departments': return <StepDepartments scope={scope} />;
        default: return <StepReview scope={scope} period={period} onEditStep={props.onEditStep} onPublished={props.onPublished} />;
    }
}
