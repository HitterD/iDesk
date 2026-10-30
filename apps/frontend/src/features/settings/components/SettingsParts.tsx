import React from 'react';
import { cn } from '@/lib/utils';
import { MgSwitch } from '@/components/management/MgmtParts';
import '@/components/management/management.css';
import './settings.css';

/** Round-2 settings vocabulary (mockup docs/mockups/settings.html): section head, `.setting` row, `.submit-bar`, form grid field. */

export const SetHead: React.FC<{ title: string; sub?: React.ReactNode; actions?: React.ReactNode }> = ({ title, sub, actions }) => (
    <div className="set-head">
        <div className="min-w-0">
            <h2 className="set-title">{title}</h2>
            {sub && <p className="set-sub">{sub}</p>}
        </div>
        {actions && <div className="set-head-acts">{actions}</div>}
    </div>
);

interface SetRowProps {
    title: React.ReactNode;
    sub?: React.ReactNode;
    /** Right side control (switch, pop, button, bubble). */
    children?: React.ReactNode;
    className?: string;
}

export const SetRow: React.FC<SetRowProps> = ({ title, sub, children, className }) => (
    <div className={cn('mg-setting', className)}>
        <div><b>{title}</b>{sub && <small>{sub}</small>}</div>
        {children}
    </div>
);

/** `.setting` row with the mockup switch. */
export const SetSwitchRow: React.FC<{ title: string; sub?: React.ReactNode; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label?: string }> = ({ title, sub, checked, onChange, disabled, label }) => (
    <SetRow title={title} sub={sub}><MgSwitch checked={checked} onChange={onChange} disabled={disabled} label={label ?? title} /></SetRow>
);

/** Mockup `.submit-bar`: secondary actions left, single primary right. */
export const SetSubmit: React.FC<{ children: React.ReactNode; left?: React.ReactNode; className?: string }> = ({ children, left, className }) => (
    <div className={cn('set-submit', className)}>{left}<span className="set-spacer" />{children}</div>
);

/** Formgrid cell: label, control, hint/error. */
export const SetField: React.FC<{ label: React.ReactNode; htmlFor?: string; hint?: React.ReactNode; error?: React.ReactNode; full?: boolean; children: React.ReactNode }> = ({ label, htmlFor, hint, error, full, children }) => (
    <div className={cn('set-field', full && 'is-full')}>
        <label htmlFor={htmlFor}>{label}</label>
        {children}
        {error ? <span className="set-err" role="alert">{error}</span> : hint ? <span className="mg-hint">{hint}</span> : null}
    </div>
);
