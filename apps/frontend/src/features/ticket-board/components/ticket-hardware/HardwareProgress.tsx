import React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FLOW_STEPS, currentStep, isStopped, type TicketHardwareRequest } from './hardwareFlow';

/** Compact step bar: done steps filled, the current one ringed, a stopped request greyed out. */
export const HardwareProgress: React.FC<{ request: Pick<TicketHardwareRequest, 'requestType' | 'status'> }> = ({ request }) => {
    const steps = FLOW_STEPS[request.requestType];
    const current = currentStep(request.requestType, request.status);
    const done = request.status === 'COMPLETED' || request.status === 'CLOSED';
    const stopped = isStopped(request.status);
    return (
        <ol className={cn('thw-steps', stopped && 'is-stopped')} aria-label="Progres hardware request">
            {steps.map((step, index) => {
                const state = done || index < current ? 'done' : index === current ? 'current' : 'todo';
                return (
                    <li key={step.label} className={`is-${state}`} aria-current={state === 'current' ? 'step' : undefined}>
                        <span className="thw-dot">{state === 'done' && <Check aria-hidden="true" />}</span>
                        <span className="thw-step-label">{step.label}</span>
                    </li>
                );
            })}
        </ol>
    );
};
