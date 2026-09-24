import type { RequestStatus } from '../types';

export type InstallStatus = 'PROPOSED' | 'PROPOSED_AWAITING_USER' | 'CONFIRMED' | 'IN_PROGRESS' | 'DONE' | 'RESCHEDULED' | 'RESCHEDULE_REQUESTED' | 'CANCELLED';

export const STATUS_META: Record<RequestStatus, { label: string; tone: string; hex: string }> = {
    DRAFT:        { label: 'Draft',        tone: 'bg-slate-100 text-slate-700 ring-slate-200',   hex: '#94a3b8' },
    SUBMITTED:    { label: 'Submitted',    tone: 'bg-sky-100 text-sky-800 ring-sky-200',         hex: '#0284c7' },
    UNDER_REVIEW: { label: 'Under Review', tone: 'bg-amber-100 text-amber-900 ring-amber-200',   hex: '#b45309' },
    APPROVED:     { label: 'Approved',     tone: 'bg-emerald-100 text-emerald-800 ring-emerald-200', hex: '#047857' },
    PROCUREMENT:  { label: 'SPP Issued',   tone: 'bg-blue-100 text-blue-800 ring-blue-200',      hex: '#2563eb' },
    AWAITING_DELIVERY: { label: 'Awaiting Delivery', tone: 'bg-sky-100 text-sky-800 ring-sky-200', hex: '#0ea5e9' },
    INSTALLATION: { label: 'Installation', tone: 'bg-primary/10 text-primary ring-primary/20',   hex: '#0284c7' },
    AWAITING_USER_CONFIRMATION: { label: 'Awaiting User Confirmation', tone: 'bg-cyan-100 text-cyan-800 ring-cyan-200', hex: '#0891b2' },
    COMPLETED:    { label: 'Completed',    tone: 'bg-emerald-600 text-white ring-emerald-700',   hex: '#16a34a' },
    REJECTED:     { label: 'Rejected',     tone: 'bg-rose-100 text-rose-800 ring-rose-200',         hex: '#be123c' },
    CANCELLED:    { label: 'Cancelled',    tone: 'bg-zinc-200 text-zinc-700 ring-zinc-300',         hex: '#52525b' },
};

export const INSTALL_STATUS_META: Record<InstallStatus, { label: string; tone: string; hex: string }> = {
    PROPOSED:               { label: 'Proposed',          tone: 'bg-sky-100 text-sky-800 ring-sky-200',         hex: '#0284c7' },
    PROPOSED_AWAITING_USER: { label: 'Awaiting User',     tone: 'bg-sky-100 text-sky-800 ring-sky-200',         hex: '#0284c7' },
    CONFIRMED:              { label: 'Confirmed',         tone: 'bg-primary/10 text-primary ring-primary/20',   hex: '#0284c7' },
    IN_PROGRESS:            { label: 'In Progress',       tone: 'bg-amber-100 text-amber-900 ring-amber-200',   hex: '#b45309' },
    DONE:                   { label: 'Done',              tone: 'bg-emerald-600 text-white ring-emerald-700',   hex: '#16a34a' },
    RESCHEDULED:            { label: 'Rescheduled',       tone: 'bg-orange-100 text-orange-800 ring-orange-200', hex: '#ea580c' },
    RESCHEDULE_REQUESTED:   { label: 'Reschedule Req.',   tone: 'bg-rose-100 text-rose-800 ring-rose-200',      hex: '#e11d48' },
    CANCELLED:              { label: 'Cancelled',         tone: 'bg-zinc-200 text-zinc-700 ring-zinc-300',         hex: '#52525b' },
};

export const INSTALL_STATUS_CHIP: Record<InstallStatus, {
  bg: string; border: string; dot: string; text: string; badge: string;
}> = {
  PROPOSED:               { bg: 'bg-sky-50',    border: 'border-sky-200',    dot: 'bg-sky-500',    text: 'text-sky-900',    badge: 'PRP'  },
  PROPOSED_AWAITING_USER: { bg: 'bg-sky-50',    border: 'border-sky-200',    dot: 'bg-sky-500',    text: 'text-sky-900',    badge: 'PAU'  },
  CONFIRMED:              { bg: 'bg-blue-50',   border: 'border-blue-200',   dot: 'bg-blue-500',   text: 'text-blue-900',   badge: 'CFM'  },
  IN_PROGRESS:            { bg: 'bg-amber-50',  border: 'border-amber-200',  dot: 'bg-amber-500',  text: 'text-amber-900',  badge: 'IP'   },
  DONE:                   { bg: 'bg-emerald-50', border: 'border-emerald-200', dot: 'bg-emerald-500', text: 'text-emerald-900', badge: 'DONE' },
  RESCHEDULED:            { bg: 'bg-red-50',    border: 'border-red-200',    dot: 'bg-red-500',    text: 'text-red-900',    badge: 'RSC'  },
  RESCHEDULE_REQUESTED:   { bg: 'bg-red-50',    border: 'border-red-200',    dot: 'bg-red-500',    text: 'text-red-900',    badge: 'RRQ'  },
  CANCELLED:              { bg: 'bg-slate-50',  border: 'border-slate-200',  dot: 'bg-slate-400',  text: 'text-slate-600',  badge: 'CXL'  },
};

export function getStatusMeta(status: string) {
    if (status in STATUS_META) return STATUS_META[status as RequestStatus];
    if (status in INSTALL_STATUS_META) return INSTALL_STATUS_META[status as InstallStatus];
    return { label: status, tone: 'bg-slate-100 text-slate-600 ring-slate-200', hex: '#94a3b8' };
}

export const isTerminal = (s: RequestStatus) => s === 'COMPLETED' || s === 'REJECTED' || s === 'CANCELLED';

