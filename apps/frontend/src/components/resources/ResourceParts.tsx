import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TicketPillTone } from '@/components/ui/ticket-pill';
import '@/features/dashboard/dashboard.css';
import './resources.css';

/**
 * Round-2 resource-page vocabulary (mockup docs/mockups/pages.css): page head, filter field,
 * data table with per-table columns, empty state, pager. Hardware, E-Form, Zoom and KB share it.
 */

type CssVars = React.CSSProperties & Record<`--${string}`, string>;
export const resVars = (vars: Record<`--${string}`, string>): CssVars => vars as CssVars;

/** Mockup tile hues for the page head (`.head .ptile`). */
export type ResTileTone = 'orange' | 'mint' | 'blue' | 'navy' | 'green' | 'brown' | 'teal';

interface ResHeadProps {
    icon: React.ElementType;
    tone: ResTileTone;
    title: string;
    description: string;
    /** Right-side actions (mockup `.head-actions`). */
    actions?: React.ReactNode;
    /** Extra inline element after the title (e.g. Live pill). */
    titleAdornment?: React.ReactNode;
}

export const ResHead: React.FC<ResHeadProps> = ({ icon: Icon, tone, title, description, actions, titleAdornment }) => (
    <header className="dash-head">
        <span className="nav-tile dash-ptile" data-tone={tone}><Icon aria-hidden="true" /></span>
        <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
                <h1>{title}</h1>
                {titleAdornment}
            </div>
            <p>{description}</p>
        </div>
        {actions && <><span className="dash-spacer" /><div className="dash-head-actions">{actions}</div></>}
    </header>
);

interface ResSearchProps {
    id: string;
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    label: string;
    className?: string;
}

/** Mockup `.field`: search input with clear button. */
export const ResSearch: React.FC<ResSearchProps> = ({ id, value, onChange, placeholder, label, className }) => (
    <label className={cn('queue-field', className)} htmlFor={id}>
        <Search aria-hidden="true" />
        <input id={id} type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={label} />
        {value && (
            <button type="button" className="queue-field-clear" onClick={() => onChange('')} aria-label="Hapus pencarian">
                <X aria-hidden="true" />
            </button>
        )}
    </label>
);

interface ResTableProps {
    label: string;
    /** Desktop grid columns. */
    cols: string;
    /** Mobile (<=860px) grid columns. */
    colsMobile?: string;
    head?: React.ReactNode;
    tools?: React.ReactNode;
    /** Second toolbar row under `tools` (mockup: title row, then search/filter row). */
    subTools?: React.ReactNode;
    children: React.ReactNode;
    foot?: React.ReactNode;
    className?: string;
}

const DEFAULT_COLS_MOBILE = 'minmax(0,1fr) auto';

/** Mockup `.table.d`: rows share the header's grid columns; rows become cards on mobile. */
export const ResTable: React.FC<ResTableProps> = ({ label, cols, colsMobile = DEFAULT_COLS_MOBILE, head, tools, subTools, children, foot, className }) => (
    <section className={cn('res-table', className)} aria-label={label} style={resVars({ '--cols': cols, '--cols-m': colsMobile })}>
        {tools && <div className="res-tools">{tools}</div>}
        {subTools && <div className="res-tools">{subTools}</div>}
        {head && <div className="res-thead" role="presentation">{head}</div>}
        <div className="res-rows">{children}</div>
        {foot && <div className="res-foot">{foot}</div>}
    </section>
);

export const ResEmpty: React.FC<{ icon: React.ElementType; title: string; children?: React.ReactNode; cta?: React.ReactNode; className?: string }> = ({ icon: Icon, title, children, cta, className }) => (
    <div className={cn('res-empty', className)}>
        <div className="res-empty-ic"><Icon aria-hidden="true" /></div>
        <b>{title}</b>
        {children}
        {cta && <div className="res-empty-cta">{cta}</div>}
    </div>
);

/** Skeleton rows in the table grammar (mockup `.sk`). */
export const ResSkeletonRows: React.FC<{ rows: number }> = ({ rows }) => (
    <div aria-hidden="true">
        {Array.from({ length: rows }, (_, i) => (
            <div key={i} className="res-sk-row">
                <i className="dash-sk is-box" />
                <div className="grid flex-1 gap-1.5"><i className="dash-sk w-3/5" /><i className="dash-sk w-2/5" /></div>
            </div>
        ))}
    </div>
);

interface ResPagerProps {
    page: number;
    totalPages: number;
    disabled?: boolean;
    onChange: (page: number) => void;
}

export const ResPager: React.FC<ResPagerProps> = ({ page, totalPages, disabled, onChange }) => {
    if (totalPages <= 1) return null;
    const first = page <= 1 || disabled;
    const last = page >= totalPages || disabled;
    return (
        <div className="res-pager">
            <button type="button" className="res-icon-btn" onClick={() => onChange(1)} disabled={first} aria-label="Halaman pertama"><ChevronsLeft aria-hidden="true" /></button>
            <button type="button" className="res-icon-btn" onClick={() => onChange(page - 1)} disabled={first} aria-label="Halaman sebelumnya"><ChevronLeft aria-hidden="true" /></button>
            <span className="res-pager-n">{page} / {totalPages}</span>
            <button type="button" className="res-icon-btn" onClick={() => onChange(page + 1)} disabled={last} aria-label="Halaman berikutnya"><ChevronRight aria-hidden="true" /></button>
            <button type="button" className="res-icon-btn" onClick={() => onChange(totalPages)} disabled={last} aria-label="Halaman terakhir"><ChevronsRight aria-hidden="true" /></button>
        </div>
    );
};

interface ResStatProps {
    icon: React.ElementType;
    tone: TicketPillTone;
    label: string;
    value: React.ReactNode;
    /** Tinted attention card (mockup `.stat.attn`). */
    attention?: boolean;
    active?: boolean;
    zero?: boolean;
    isLoading?: boolean;
    /** Omit for a static summary card (no hover lift, no button role). */
    onClick?: () => void;
}

/** Mockup `.stat`: icon bubble, number top-right, name. Same grammar as the queue stat cards. */
export const ResStat: React.FC<ResStatProps> = ({ icon: Icon, tone, label, value, attention, active, zero, isLoading, onClick }) => {
    const className = cn('queue-stat', `ticket-tone-${tone}`, attention && 'is-attention', active && 'is-active', zero && 'is-zero', !onClick && 'res-stat-static');
    const body = (
        <>
            <span className="portal-stat-top">
                <span className="portal-stat-icon"><Icon aria-hidden="true" /></span>
                {isLoading ? <i className="dash-sk is-num" aria-hidden="true" /> : <span className="portal-stat-value">{value}</span>}
            </span>
            <span className="portal-stat-label">{label}</span>
        </>
    );
    if (!onClick) return <div className={className}>{body}</div>;
    return <button type="button" role="button" className={className} aria-pressed={Boolean(active)} onClick={onClick}>{body}</button>;
};

interface ResBubProps {
    /** Hue (CSS colour) for the dot, tint and border. */
    color: string;
    /** Text ink; defaults to secondary text like the mockup `.bub`. */
    ink?: string;
    /** Icon replaces the dot (mockup `bub(..., { icon })`). */
    icon?: React.ElementType;
    mono?: boolean;
    /** No dot (mockup site bubbles). */
    plain?: boolean;
    title?: string;
    className?: string;
    children: React.ReactNode;
}

/** Mockup `.bub`: soft bordered pill with a status dot (or icon). */
export const ResBub: React.FC<ResBubProps> = ({ color, ink, icon: Icon, mono, plain, title, className, children }) => (
    <span className={cn('dash-bub', mono && 'mono', plain && 'is-plain', className)} title={title} style={resVars(ink ? { '--c': color, '--ink': ink } : { '--c': color })}>
        {Icon ? <Icon aria-hidden="true" /> : <span className="res-dot" aria-hidden="true" />}
        <span className="min-w-0 truncate">{children}</span>
    </span>
);
