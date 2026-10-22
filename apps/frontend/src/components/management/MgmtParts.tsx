import React, { useRef } from 'react';
import { cn } from '@/lib/utils';
import type { TicketPillTone } from '@/components/ui/ticket-pill';
import { SegmentedControl, type SegmentedOption } from '@/components/ui/segmented-control';
import '@/features/dashboard/dashboard.css';
import '@/components/resources/resources.css';
import './management.css';

/**
 * Round-2 management/admin vocabulary (mockup docs/mockups/pages.css): page tabs with direction-aware
 * panel entry, static stat card with a sub line, switch, status banner. Builds on ResourceParts.
 */

interface MgTabsProps<V extends string> {
    options: readonly SegmentedOption<V>[];
    value: V;
    onChange: (value: V) => void;
    label: string;
}

/** Mockup `.seg.page-tabs`: segmented tabs with the sliding thumb; scrolls horizontally on narrow screens. */
export function MgTabs<V extends string>({ options, value, onChange, label }: MgTabsProps<V>) {
    return (
        <div className="mg-tabs-scroll">
            <SegmentedControl aria-label={label} className="dash-seg res-tabs" options={options} value={value} onValueChange={onChange} />
        </div>
    );
}

/** Direction of travel between two tab values (`r` = to the right). Mockup `wireTabs`. */
export function useTabDirection<V extends string>(order: readonly V[], value: V): 'l' | 'r' {
    const prev = useRef(value);
    const dir = useRef<'l' | 'r'>('r');
    if (prev.current !== value) {
        dir.current = order.indexOf(value) >= order.indexOf(prev.current) ? 'r' : 'l';
        prev.current = value;
    }
    return dir.current;
}

/** Tab panel that slides in from the direction of travel (keyed by the caller on the tab value). */
export const MgPanel: React.FC<{ dir: 'l' | 'r'; label?: string; id?: string; children: React.ReactNode; className?: string }> = ({ dir, label, id, children, className }) => (
    <div id={id} role="tabpanel" aria-label={label} className={cn('mg-panel', `is-enter-${dir}`, className)}>{children}</div>
);

interface MgStatProps {
    icon: React.ElementType;
    tone: TicketPillTone;
    label: string;
    value: React.ReactNode;
    sub?: React.ReactNode;
    attention?: boolean;
    zero?: boolean;
    active?: boolean;
    isLoading?: boolean;
    onClick?: () => void;
    ariaLabel?: string;
}

/** Mockup `.stat` (+ optional `.sub`): icon bubble, number top-right, name, sub line. */
export const MgStat: React.FC<MgStatProps> = ({ icon: Icon, tone, label, value, sub, attention, zero, active, isLoading, onClick, ariaLabel }) => {
    const className = cn('queue-stat', `ticket-tone-${tone}`, attention && 'is-attention', active && 'is-active', zero && 'is-zero', !onClick && 'res-stat-static');
    const body = (
        <>
            <span className="portal-stat-top">
                <span className="portal-stat-icon"><Icon aria-hidden="true" /></span>
                {isLoading ? <i className="dash-sk is-num" aria-hidden="true" /> : <span className="portal-stat-value">{value}</span>}
            </span>
            <span className="portal-stat-label">{label}</span>
            {sub !== undefined && <span className="mg-stat-sub">{sub}</span>}
        </>
    );
    if (!onClick) return <div className={className}>{body}</div>;
    return <button type="button" role="button" className={className} aria-pressed={Boolean(active)} aria-label={ariaLabel} onClick={onClick}>{body}</button>;
};

interface MgSwitchProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    label: string;
    disabled?: boolean;
    id?: string;
}

/** Mockup `.switch` (role=switch). */
export const MgSwitch: React.FC<MgSwitchProps> = ({ checked, onChange, label, disabled, id }) => (
    <button id={id} type="button" role="switch" className="res-switch" aria-checked={checked} aria-label={label} disabled={disabled}
        onClick={() => onChange(!checked)} />
);

interface MgBannerProps {
    tone?: 'ok' | 'warn' | 'crit';
    icon: React.ElementType;
    title: React.ReactNode;
    children?: React.ReactNode;
    actions?: React.ReactNode;
}

/** Mockup `.status-banner` (green), `.crit` (red), plus an orange warning variant. */
export const MgBanner: React.FC<MgBannerProps> = ({ tone = 'ok', icon: Icon, title, children, actions }) => (
    <div className={cn('mg-banner', tone === 'warn' && 'is-warn', tone === 'crit' && 'is-crit')} role={tone === 'ok' ? 'status' : 'alert'}>
        <span className="mg-banner-ico"><Icon aria-hidden="true" /></span>
        <div><b>{title}</b>{children && <small>{children}</small>}</div>
        {actions}
    </div>
);
