import type { ElementType } from 'react';
import { Filter } from 'lucide-react';
import { STATUS_CONFIG, PRIORITY_CONFIG, NON_SELECTABLE_STATUSES } from '@/lib/constants/ticket.constants';
import { SearchablePicker } from '@/components/ui/searchable-picker';
import { TicketPill, PRIORITY_TONES, STATUS_TONES, type TicketPillTone } from '@/components/ui/ticket-pill';

interface CustomDropdownProps {
    value: string;
    onChange: (value: string) => void;
    options: { value: string; label: string }[];
    icon?: ElementType;
    placeholder?: string;
}

/** Short filter lists stay keyboard-navigable without a search field. */
const SEARCH_OPTION_THRESHOLD = 8;

export const CustomDropdown = ({ value, onChange, options, icon: Icon = Filter,
    placeholder = 'Filter' }: CustomDropdownProps) => {
    const pickerValue = value === '' ? 'ALL' : value;
    const selectedLabel = options.find(option => option.value === pickerValue)?.label;
    return <SearchablePicker value={pickerValue} options={options}
        onValueChange={next => onChange(next === 'ALL' ? '' : next)}
        label={selectedLabel ? `${placeholder}: ${selectedLabel}` : placeholder}
        placeholder={placeholder}
        searchPlaceholder={options.length > SEARCH_OPTION_THRESHOLD ? 'Cari…' : undefined}
        triggerIcon={<Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />}
        triggerClassName="min-h-9 min-w-[130px] shrink-0" />;
};

interface PriorityDropdownProps {
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
}


/** Option-row adornment: config icon (or dot) in the tone's ink colour. */
const optionIcon = (Icon: ElementType | null, tone: TicketPillTone = 'neutral') => {
    const style = { color: `hsl(var(--ticket-${tone}-ink))` };
    return Icon ? <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" style={style} />
        : <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-current" style={style} />;
};

export const PriorityDropdown = ({ value, onChange, disabled }: PriorityDropdownProps) => {
    const config = PRIORITY_CONFIG[value] || PRIORITY_CONFIG.MEDIUM;
    const tone = PRIORITY_TONES[value] || PRIORITY_TONES.MEDIUM;
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
            .map(([key, cfg]) => ({ value: key, label: cfg.label, icon: optionIcon(cfg.icon, PRIORITY_TONES[key]) }))} />;
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
            .map(([key, cfg]) => ({ value: key, label: cfg.label, icon: optionIcon(cfg.icon, STATUS_TONES[key]) }))} />;
};
