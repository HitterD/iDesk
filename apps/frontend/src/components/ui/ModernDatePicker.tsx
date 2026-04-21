import React, { useState } from 'react';
import { Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ModernCalendar } from './ModernCalendar';

interface ModernDatePickerProps {
    value?: Date;
    onChange?: (date: Date) => void;
    placeholder?: string;
    minDate?: Date;
    maxDate?: Date;
    showPresets?: boolean;
    className?: string;
    triggerClassName?: string;
    disabled?: boolean;
}

export const ModernDatePicker: React.FC<ModernDatePickerProps> = ({
    value,
    onChange,
    placeholder = 'Select date',
    minDate,
    maxDate,
    showPresets = false,
    className,
    triggerClassName,
    disabled = false,
}) => {
    const [open, setOpen] = useState(false);

    const handleSelect = (date: Date) => {
        onChange?.(date);
        setOpen(false);
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    disabled={disabled}
                    className={cn(
                        'flex items-center gap-2 px-3 py-2.5 w-full',
                        'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700',
                        'rounded-xl text-left text-sm transition-colors duration-150',
                        'hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20',
                        disabled && 'opacity-50 cursor-not-allowed',
                        triggerClassName
                    )}
                >
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <span className={cn(
                        'flex-1',
                        value ? 'text-slate-800 dark:text-white' : 'text-slate-400'
                    )}>
                        {value ? format(value, 'MMM d, yyyy') : placeholder}
                    </span>
                </button>
            </PopoverTrigger>
            <PopoverContent
                className={cn('w-auto p-0 border-0 shadow-2xl', className)}
                align="start"
                sideOffset={8}
            >
                <ModernCalendar
                    selected={value}
                    onSelect={handleSelect}
                    minDate={minDate}
                    maxDate={maxDate}
                    showPresets={showPresets}
                />
            </PopoverContent>
        </Popover>
    );
};

export default ModernDatePicker;
