import React, { useState } from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { HelpCircle, Info, AlertCircle, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';

type TooltipVariant = 'help' | 'info' | 'warning' | 'tip';

interface HelpTooltipProps {
    content: string | React.ReactNode;
    variant?: TooltipVariant;
    side?: 'top' | 'right' | 'bottom' | 'left';
    align?: 'start' | 'center' | 'end';
    className?: string;
    iconSize?: number;
    children?: React.ReactNode;
}

const variantConfig: Record<TooltipVariant, { icon: React.ElementType; color: string; bgColor: string }> = {
    help: { icon: HelpCircle, color: 'text-slate-400', bgColor: 'bg-slate-800' },
    info: { icon: Info, color: 'text-blue-400', bgColor: 'bg-blue-900' },
    warning: { icon: AlertCircle, color: 'text-amber-400', bgColor: 'bg-amber-900' },
    tip: { icon: Lightbulb, color: 'text-green-400', bgColor: 'bg-green-900' },
};

/**
 * HelpTooltip component for providing contextual help throughout the app
 * 
 * Usage:
 * <HelpTooltip content="This field is required" />
 * <HelpTooltip variant="tip" content="Pro tip: Use keyboard shortcuts for faster navigation" />
 */
export const HelpTooltip: React.FC<HelpTooltipProps> = ({
    content,
    variant = 'help',
    side = 'top',
    align = 'center',
    className,
    iconSize = 16,
    children,
}) => {
    const config = variantConfig[variant];
    const Icon = config.icon;

    return (
        <Tooltip.Provider delayDuration={200}>
            <Tooltip.Root>
                <Tooltip.Trigger asChild>
                    {children || (
                        <button
                            type="button"
                            className={cn(
                                'inline-flex items-center justify-center rounded-full hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-primary/50',
                                config.color,
                                className
                            )}
                            aria-label="Help"
                        >
                            <Icon size={iconSize} />
                        </button>
                    )}
                </Tooltip.Trigger>
                <Tooltip.Portal>
                    <Tooltip.Content
                        side={side}
                        align={align}
                        sideOffset={5}
                        className={cn(
                            'z-50 max-w-xs px-3 py-2 text-sm rounded-lg shadow-lg',
                            'animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
                            config.bgColor,
                            'text-white'
                        )}
                    >
                        {content}
                        <Tooltip.Arrow className={cn(config.bgColor.replace('bg-', 'fill-'))} />
                    </Tooltip.Content>
                </Tooltip.Portal>
            </Tooltip.Root>
        </Tooltip.Provider>
    );
};

/**
 * FieldHelp component for form field help text
 */
interface FieldHelpProps {
    label: string;
    help: string;
    required?: boolean;
    children: React.ReactNode;
}

export const FieldHelp: React.FC<FieldHelpProps> = ({ label, help, required, children }) => {
    return (
        <div className="space-y-1">
            <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    {label}
                    {required && <span className="text-red-500 ml-1">*</span>}
                </label>
                <HelpTooltip content={help} iconSize={14} />
            </div>
            {children}
        </div>
    );
};

export default HelpTooltip;
