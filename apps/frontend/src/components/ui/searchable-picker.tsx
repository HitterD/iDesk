import { useState, type ReactNode } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from './command';

export interface SearchablePickerOption {
    value: string;
    label: string;
    description?: string;
    disabled?: boolean;
}

export interface SearchablePickerProps {
    value: string;
    options: SearchablePickerOption[];
    onValueChange: (value: string) => void;
    label: string;
    placeholder?: string;
    /** Omit to render a keyboard-operable list without a search field. */
    searchPlaceholder?: string;
    disabled?: boolean;
    triggerClassName?: string;
    /** Presentation-only adornments; labels and identity remain plain text/value. */
    triggerIcon?: ReactNode;
    displayValue?: string;
}

function PickerOptions({ value, options, onValueChange }: Pick<SearchablePickerProps, 'value' | 'options' | 'onValueChange'>) {
    return <CommandList className="picker-list" aria-label="Pilihan">
        <CommandEmpty>Tidak ditemukan. Coba kata lain.</CommandEmpty>
        {options.map(option => <CommandItem key={option.value} value={option.value}
            keywords={[option.label, option.description ?? '']} disabled={option.disabled}
            data-checked={option.value === value} aria-checked={option.value === value} className="picker-option"
            onSelect={() => { if (!option.disabled) onValueChange(option.value); }}>
            <span className="min-w-0 flex-1 break-words">
                <span>{option.label}</span>
                {option.description && <span className="picker-description block">{option.description}</span>}
            </span>
            {option.value === value && <Check aria-hidden="true" data-testid="selected-check" className="h-4 w-4 shrink-0" />}
        </CommandItem>)}
    </CommandList>;
}

export function SearchablePicker({ value, options, onValueChange, label, placeholder = 'Pilih nilai',
    searchPlaceholder, disabled, triggerClassName, triggerIcon, displayValue }: SearchablePickerProps) {
    const [open, setOpen] = useState(false);
    const selected = options.find(option => option.value === value);
    const select = (next: string) => { onValueChange(next); setOpen(false); };
    return <Popover open={open && !disabled} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
            <button type="button" aria-label={label} disabled={disabled}
                className={cn('ticket-pill ticket-tone-neutral picker-trigger', triggerClassName)}
                onKeyDown={event => {
                    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                        event.preventDefault(); setOpen(true);
                    }
                }}>
                {triggerIcon}
                <span className="min-w-0 truncate">{displayValue ?? selected?.label ?? placeholder}</span>
                <ChevronDown aria-hidden="true" className="h-3 w-3 shrink-0 opacity-60" />
            </button>
        </PopoverTrigger>
        <PopoverContent align="start" collisionPadding={12} sideOffset={8} className="picker-panel p-1.5"
            aria-label={label}>
            <Command label={searchPlaceholder || label} defaultValue={value} loop tabIndex={searchPlaceholder ? undefined : 0}
                className="picker-command" autoFocus={!searchPlaceholder}>
                {searchPlaceholder && <CommandInput aria-label={searchPlaceholder} placeholder={searchPlaceholder} />}
                <PickerOptions value={value} options={options} onValueChange={select} />
            </Command>
        </PopoverContent>
    </Popover>;
}
