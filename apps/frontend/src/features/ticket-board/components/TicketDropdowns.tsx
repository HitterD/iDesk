import type { ElementType } from 'react';
import { Filter } from 'lucide-react';
import { STATUS_CONFIG, PRIORITY_CONFIG, NON_SELECTABLE_STATUSES } from '@/lib/constants/ticket.constants';
import { SearchablePicker } from '@/components/ui/searchable-picker';
import { TicketPill, type TicketPillTone } from '@/components/ui/ticket-pill';

interface CustomDropdownProps {
    value: string;
    onChange: (value: string) => void;
    options: { value: string; label: string }[];
    icon?: ElementType;
    placeholder?: string;
}

export const CustomDropdown = ({ value, onChange, options, icon: Icon = Filter,
    placeholder = 'Filter' }: CustomDropdownProps) => (
    <SearchablePicker value={value === '' ? 'ALL' : value} options={options}
        onValueChange={next => onChange(next === 'ALL' ? '' : next)} label={placeholder}
        placeholder={placeholder} searchPlaceholder={`Cari ${placeholder.toLowerCase()}`}
        triggerIcon={<Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />}
        triggerClassName="min-h-9 min-w-[130px] shrink-0" />
);

interface PriorityDropdownProps {
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
}

const PRIORITY_TONES: Record<string, TicketPillTone> = {
    LOW: 'neutral', MEDIUM: 'amber', HIGH: 'amber', CRITICAL: 'red',
    HARDWARE_INSTALLATION: 'amber', ORACLE_REQUEST: 'blue',
};
const STATUS_TONES: Record<string, TicketPillTone> = {
    TODO: 'neutral', IN_PROGRESS: 'navy', WAITING_VENDOR: 'amber', RESOLVED: 'green',
    CLOSED: 'neutral', CANCELLED: 'red',
};

export const PriorityDropdown = ({ value, onChange, disabled }: PriorityDropdownProps) => {
    const config = PRIORITY_CONFIG[value] || PRIORITY_CONFIG.MEDIUM;
    const tone = PRIORITY_TONES[value] || 'amber';
    const Icon = config.icon;
    const icon = Icon ? <Icon aria-hidden="true" className="h-3 w-3 shrink-0" />
        : <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current shrink-0" />;
    if (disabled || config.isSystemLocked) {
        return <TicketPill tone={tone} title={config.label}>{icon}{config.shortLabel || config.label}</TicketPill>;
    }
    return <SearchablePicker value={value} onValueChange={onChange} label={`Prioritas: ${config.label}`}
        displayValue={config.shortLabel || config.label} triggerIcon={icon}
        triggerClassName={`ticket-tone-${tone}`}
        options={Object.entries(PRIORITY_CONFIG).filter(([, cfg]) => !cfg.isSystemLocked)
            .map(([key, cfg]) => ({ value: key, label: cfg.label }))} />;
};

interface StatusDropdownProps {
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
}

export const StatusDropdown = ({ value, onChange, disabled }: StatusDropdownProps) => {
    const config = STATUS_CONFIG[value] || STATUS_CONFIG.TODO;
    const tone = STATUS_TONES[value] || 'neutral';
    const Icon = config.icon;
    const icon = <Icon aria-hidden="true" className="h-3 w-3 shrink-0" />;
    if (disabled) return <TicketPill tone={tone}>{icon}{config.label}</TicketPill>;
    return <SearchablePicker value={value} onValueChange={onChange} label={`Status: ${config.label}`}
        displayValue={config.label} triggerIcon={icon} triggerClassName={`ticket-tone-${tone}`}
        options={Object.entries(STATUS_CONFIG).filter(([key]) => !NON_SELECTABLE_STATUSES.includes(key))
            .map(([key, cfg]) => ({ value: key, label: cfg.label }))} />;
};
