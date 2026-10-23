import React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PopoverPortalContext } from '@/components/ui/PopoverPortalContext';

export interface ActionSelectOption {
    value: string;
    label: string;
    /** Secondary line under the label, e.g. what a team handles. */
    description?: string;
}

interface ActionSelectProps {
    id: string;
    options: readonly ActionSelectOption[];
    /** Empty string shows the placeholder. */
    value: string;
    onValueChange: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
    'aria-describedby'?: string;
}

/**
 * macOS-style pop-up button for ticket action dialogs: a filled field with the accent chevron badge and a
 * translucent menu that marks the current choice with a check. Portals into the owning dialog's layer.
 */
export const ActionSelect: React.FC<ActionSelectProps> = ({ id, options, value, onValueChange, placeholder, disabled, ...aria }) => (
    <SelectPrimitive.Root value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectPrimitive.Trigger id={id} className="action-select-trigger" aria-describedby={aria['aria-describedby']}>
            <span className="action-select-value"><SelectPrimitive.Value placeholder={placeholder} /></span>
            <span className="action-select-badge" aria-hidden="true"><ChevronsUpDown /></span>
        </SelectPrimitive.Trigger>
        <SelectPrimitive.Portal container={React.useContext(PopoverPortalContext)}>
            <SelectPrimitive.Content position="popper" sideOffset={6} collisionPadding={12} className="action-select-menu">
                <SelectPrimitive.Viewport className="action-select-viewport">
                    {options.map((option) => (
                        <SelectPrimitive.Item key={option.value} value={option.value} className="action-select-item">
                            <span className="action-select-check" aria-hidden="true">
                                <SelectPrimitive.ItemIndicator><Check /></SelectPrimitive.ItemIndicator>
                            </span>
                            <span className="min-w-0">
                                <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                                {option.description && <small>{option.description}</small>}
                            </span>
                        </SelectPrimitive.Item>
                    ))}
                </SelectPrimitive.Viewport>
            </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
);

interface ActionChipsProps<T extends string> {
    /** Id of the visible label that names the group. */
    labelledBy: string;
    options: readonly { value: T; label: string }[];
    /** null when the value came from somewhere else (e.g. a custom date): no chip is pressed. */
    value: T | null;
    onSelect: (value: T) => void;
    disabled?: boolean;
}

/** Quick picks as capsules (Reminders-style): every choice visible, one tap, the active one filled. */
export function ActionChips<T extends string>({ labelledBy, options, value, onSelect, disabled }: ActionChipsProps<T>) {
    return (
        <div className="action-chips" role="group" aria-labelledby={labelledBy}>
            {options.map((option) => (
                <button key={option.value} type="button" className={cn('action-chip', value === option.value && 'is-on')}
                    aria-pressed={value === option.value} disabled={disabled} onClick={() => onSelect(option.value)}>
                    {option.label}
                </button>
            ))}
        </div>
    );
}
