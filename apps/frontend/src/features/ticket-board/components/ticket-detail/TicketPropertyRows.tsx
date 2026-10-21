import React, { useMemo, useState } from 'react';
import { CheckCircle2, ChevronDown, Loader2, UserPlus } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { SearchablePicker } from '@/components/ui/searchable-picker';
import { TicketPill, PRIORITY_TONES, STATUS_TONES } from '@/components/ui/ticket-pill';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { STATUS_CONFIG, PRIORITY_CONFIG } from '@/lib/constants/ticket.constants';
import { AgentSelectList, type Agent } from '../AgentSelectList';
import { toDisplayName } from './messageThread';

/** Presentation-only inspector rows. Callers own API calls, optimistic state and takeover flows. */

const BASE_CATEGORIES = [
    { value: 'GENERAL', label: 'General' },
    { value: 'HARDWARE', label: 'Hardware' },
    { value: 'SOFTWARE', label: 'Software' },
    { value: 'NETWORK', label: 'Network' },
];
export const NO_DEVICE_VALUE = 'none';
const NO_DEVICE_LABEL = 'Tidak ada';
/** Short lists stay keyboard-navigable without a search field (TicketDropdowns parity). */
const SEARCH_OPTION_THRESHOLD = 8;

type AttributeOption = { id: string; value: string };

/** Mockup `.prop`: plain label left, value right. `icon` is accepted for callers but not drawn. */
export const PropertyRow: React.FC<{
    icon?: React.ElementType;
    label: string;
    saving?: boolean;
    saved?: boolean;
    children: React.ReactNode;
}> = ({ label, saving = false, saved = false, children }) => (
    <div className="ticket-prop">
        <span className="ticket-prop-label">
            {label}
            {saving && <Loader2 className="h-3 w-3 animate-spin text-primary" aria-label="Menyimpan" />}
            {!saving && saved && <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" aria-label="Tersimpan" />}
        </span>
        <span className="ticket-prop-value">{children}</span>
    </div>
);

/** Readonly status bubble (requester inspector, header): mockup `.bub` with a status dot. */
export const StatusPill: React.FC<{ status: string }> = ({ status }) => {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.TODO;
    return <TicketPill tone={STATUS_TONES[status] || 'neutral'}><span aria-hidden="true" className="td-pill-dot" />{cfg.label}</TicketPill>;
};

/** Readonly priority bubble; `short` uses the compact label (header). */
export const PriorityPill: React.FC<{ priority: string; short?: boolean }> = ({ priority, short = false }) => {
    const cfg = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.MEDIUM;
    const Icon = cfg.icon;
    return (
        <TicketPill tone={PRIORITY_TONES[priority] || PRIORITY_TONES.MEDIUM} title={cfg.label}>
            {Icon ? <Icon aria-hidden="true" className="h-3 w-3 shrink-0" /> : <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />}
            {short ? cfg.shortLabel || cfg.label : cfg.label}
        </TicketPill>
    );
};

const agentLabel = (agent?: { fullName: string } | null) => (agent ? toDisplayName(agent.fullName) : 'Belum ada');

export const AssigneeBubble: React.FC<{
    agent?: Agent | null;
    agents: Agent[];
    isAdmin: boolean;
    locked: boolean;
    disabled?: boolean;
    onSelect: (agentId: string) => void;
}> = ({ agent, agents, isAdmin, locked, disabled = false, onSelect }) => {
    const [open, setOpen] = useState(false);
    const content = agent
        ? <><UserAvatar user={agent} size="xs" className="h-5 w-5 text-[9px]" /><span className="min-w-0 truncate">{agentLabel(agent)}</span></>
        : <><UserPlus aria-hidden="true" className="h-3.5 w-3.5 shrink-0" /><span>Pilih teknisi</span></>;
    if (locked) {
        return <TicketPill tone="neutral" title={agent?.fullName}>{agent ? content : agentLabel(agent)}</TicketPill>;
    }
    return (
        <Popover open={open && !disabled} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button type="button" disabled={disabled} aria-label={`PIC: ${agent?.fullName ?? 'Belum ada'}`}
                    title={agent ? `${agent.fullName} · ${agent.email ?? ''}` : 'Pilih teknisi'}
                    className="ticket-pill ticket-tone-neutral picker-trigger max-w-full">
                    {content}
                    <ChevronDown aria-hidden="true" className="h-3 w-3 shrink-0 opacity-60" />
                </button>
            </PopoverTrigger>
            <PopoverContent align="end" collisionPadding={12} sideOffset={8} className="w-[300px] overflow-hidden rounded-2xl border-border bg-card p-0 shadow-2xl">
                <AgentSelectList agents={agents} selectedId={agent?.id} isAdmin={isAdmin}
                    onSelect={(id) => { setOpen(false); onSelect(id); }} />
            </PopoverContent>
        </Popover>
    );
};

export const CategoryBubble: React.FC<{
    value: string;
    categories: AttributeOption[];
    locked: boolean;
    disabled?: boolean;
    onChange: (value: string) => void;
}> = ({ value, categories, locked, disabled = false, onChange }) => {
    const options = useMemo(() => {
        const seen = new Set(BASE_CATEGORIES.map(o => o.value));
        const extra = categories.filter(c => !seen.has(c.value) && seen.add(c.value)).map(c => ({ value: c.value, label: c.value }));
        return [...BASE_CATEGORIES, ...extra];
    }, [categories]);
    const label = options.find(o => o.value === value)?.label ?? value.replace(/_/g, ' ');
    if (locked) return <TicketPill tone="neutral">{label}</TicketPill>;
    return <SearchablePicker value={value} options={options} onValueChange={onChange} disabled={disabled}
        label={`Kategori: ${label}`} displayValue={label}
        searchPlaceholder={options.length > SEARCH_OPTION_THRESHOLD ? 'Cari kategori…' : undefined} />;
};

export const DeviceBubble: React.FC<{
    value: string;
    devices: AttributeOption[];
    locked: boolean;
    disabled?: boolean;
    onChange: (value: string) => void;
}> = ({ value, devices, locked, disabled = false, onChange }) => {
    const options = useMemo(() => [
        { value: NO_DEVICE_VALUE, label: NO_DEVICE_LABEL },
        ...devices.map(d => ({ value: d.value, label: d.value })),
    ], [devices]);
    const label = value || NO_DEVICE_LABEL;
    if (locked) return <TicketPill tone="neutral">{label}</TicketPill>;
    return <SearchablePicker value={value || NO_DEVICE_VALUE} options={options} onValueChange={onChange} disabled={disabled}
        label={`Perangkat: ${label}`} displayValue={label}
        searchPlaceholder={options.length > SEARCH_OPTION_THRESHOLD ? 'Cari perangkat…' : undefined} />;
};
