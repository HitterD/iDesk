import React, { useState, useEffect, useRef } from 'react';
import { Filter, ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { STATUS_CONFIG, PRIORITY_CONFIG } from '@/lib/constants/ticket.constants';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

// Custom filter dropdown with search capability
interface CustomDropdownProps {
    value: string;
    onChange: (value: string) => void;
    options: { value: string; label: string }[];
    icon?: React.ElementType;
    placeholder?: string;
}

export const CustomDropdown: React.FC<CustomDropdownProps> = ({
    value,
    onChange,
    options,
    icon: Icon = Filter,
    placeholder = 'Filter'
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedLabel = options.find(opt => opt.value === value)?.label || placeholder;

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-[hsl(var(--card))] border border-[hsl(var(--border))] hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300 font-medium rounded-xl shadow-sm transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out min-w-[150px] h-10 justify-between text-sm"
            >
                <div className="flex items-center gap-2 truncate">
                    <Icon className="w-3.5 h-3.5 opacity-70" />
                    <span>{selectedLabel}</span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 opacity-50" />
            </button>
            {isOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl shadow-lg overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200">
                    <div className="p-1">
                        {options.map((option) => (
                            <button
                                key={option.value}
                                onClick={() => {
                                    onChange(option.value);
                                    setIsOpen(false);
                                }}
                                className={cn(
                                    "w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors",
                                    value === option.value
                                        ? "bg-primary/10 text-primary font-medium dark:bg-primary/20"
                                        : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                                )}
                            >
                                <span>{option.label}</span>
                                {value === option.value && <Check className="w-3.5 h-3.5" />}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

// Priority dropdown with colored badges
interface PriorityDropdownProps {
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
}

export const PriorityDropdown: React.FC<PriorityDropdownProps> = ({ value, onChange, disabled }) => {
    const config = PRIORITY_CONFIG[value] || PRIORITY_CONFIG.MEDIUM;
    const Icon = config.icon;
    const isSystemLocked = config.isSystemLocked === true;

    if (disabled || isSystemLocked) {
        return (
            <span className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium whitespace-nowrap text-slate-700 dark:text-slate-300">
                {Icon && <Icon className={cn("w-3 h-3", config.iconClass)} />}
                <span className={cn("w-1.5 h-1.5 rounded-full", config.dot)} />
                {config.label}
            </span>
        );
    }

    return (
        <Select value={value} onValueChange={onChange}>
            <SelectTrigger className="h-7 w-auto min-w-0 border border-slate-200 bg-white dark:border-slate-700/60 dark:bg-slate-800/40 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 focus:ring-1 focus:ring-primary/50 shadow-sm text-xs font-medium px-2 gap-1.5 transition-all duration-200 ease-out [&>svg]:hidden text-slate-700 dark:text-slate-300">
                <SelectValue>
                    <span className="inline-flex items-center gap-1.5">
                        {Icon && <Icon className={cn("w-3 h-3", config.iconClass)} />}
                        <span className={cn("w-1.5 h-1.5 rounded-full", config.dot)} />
                        {config.label}
                    </span>
                </SelectValue>
            </SelectTrigger>
            <SelectContent>
                {Object.entries(PRIORITY_CONFIG)
                    .filter(([, cfg]) => !cfg.isSystemLocked)
                    .map(([key, cfg]) => {
                        const PIcon = cfg.icon;
                        return (
                            <SelectItem key={key} value={key} className="text-slate-700 dark:text-slate-300">
                                <span className="inline-flex items-center gap-1.5">
                                    {PIcon && <PIcon className={cn("w-3 h-3", cfg.iconClass)} />}
                                    <span className={cn("w-1.5 h-1.5 rounded-full", cfg.dot)} />
                                    {cfg.label}
                                </span>
                            </SelectItem>
                        );
                    })}
            </SelectContent>
        </Select>
    );
};

// Status dropdown with colored badges
interface StatusDropdownProps {
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
}

export const StatusDropdown: React.FC<StatusDropdownProps> = ({ value, onChange, disabled }) => {
    const config = STATUS_CONFIG[value] || STATUS_CONFIG.TODO;
    const Icon = config.icon;

    if (disabled) {
        return (
            <span className={cn("inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap", config.color)}>
                <Icon className="w-3 h-3" />
                {config.label}
            </span>
        );
    }

    return (
        <Select value={value} onValueChange={onChange}>
            <SelectTrigger className={cn("h-7 w-auto min-w-0 border border-slate-200 bg-white dark:border-slate-700/60 dark:bg-slate-800/40 shadow-sm hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 dark:hover:border-slate-600 focus:ring-1 focus:ring-primary/50 text-xs font-medium px-2 gap-1 transition-all duration-200 ease-out [&>svg]:hidden", config.color)}>
                <SelectValue>
                    <span className="inline-flex items-center gap-1">
                        <Icon className="w-3 h-3" />
                        {config.label}
                    </span>
                </SelectValue>
            </SelectTrigger>
            <SelectContent>
                {Object.entries(STATUS_CONFIG).filter(([key]) => key !== 'CANCELLED').map(([key, cfg]) => {
                    const SIcon = cfg.icon;
                    return (
                        <SelectItem key={key} value={key}>
                            <span className="inline-flex items-center gap-1.5">
                                <SIcon className="w-3 h-3" />
                                {cfg.label}
                            </span>
                        </SelectItem>
                    );
                })}
            </SelectContent>
        </Select>
    );
};
