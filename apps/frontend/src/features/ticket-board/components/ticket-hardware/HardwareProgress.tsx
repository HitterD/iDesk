import React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FLOW_STEPS, currentStep, isStopped, type TicketHardwareRequest } from './hardwareFlow';

/**
 * Step bar: done steps filled, the current one ringed, a stopped request greyed out. `compact` (the narrow sidebar,
 * which already says where the request stands) keeps the labels for screen readers and hover only.
 */
export const HardwareProgress: React.FC<{ request: Pick<TicketHardwareRequest, 'requestType' | 'status'>; compact?: boolean }> = ({ request, compact = false }) => {
    const steps = FLOW_STEPS[request.requestType];
    const current = currentStep(request.requestType, request.status);
    const done = request.status === 'COMPLETED' || request.status === 'CLOSED';
    const stopped = isStopped(request.status);
    return (
        <ol className={cn('thw-steps', stopped && 'is-stopped', compact && 'is-compact')} aria-label="Progres hardware request">
            {steps.map((step, index) => {
                const state = done || index < current ? 'done' : index === current ? 'current' : 'todo';
                return (
                    <li key={step.label} className={`is-${state}`} title={compact ? step.label : undefined} aria-current={state === 'current' ? 'step' : undefined}>
                        <span className="thw-dot">{state === 'done' && <Check aria-hidden="true" />}</span>
                        <span className="thw-step-label">{step.label}</span>
                    </li>
                );
            })}
        </ol>
    );
};
