import type { ElementType } from 'react';

export type KpiTone = 'navy' | 'amber' | 'sky' | 'red' | 'green' | 'neutral';

interface KpiProps {
    icon: ElementType;
    label: string;
    value: number;
    tone: KpiTone;
    /** A KPI that filters the list below is a button; `active` marks the current filter. */
    onClick?: () => void;
    active?: boolean;
}

/** One KPI card of "Perangkat & Akses" (mockup ticket-unify `.kpi`): tinted card, round icon top-left, big number top-right. */
export function Kpi({ icon: Icon, label, value, tone, onClick, active }: KpiProps) {
    const body = (
        <>
            <span className="da-kpi__r"><span className="da-kpi__ico"><Icon aria-hidden="true" /></span><span className="da-kpi__v">{value}</span></span>
            <span className="da-kpi__l">{label}</span>
        </>
    );
    return onClick
        ? <button type="button" className={`da-kpi da-kpi--${tone}${active ? ' is-on' : ''}`} aria-pressed={active} onClick={onClick}>{body}</button>
        : <div className={`da-kpi da-kpi--${tone}`} aria-label={label}>{body}</div>;
}
