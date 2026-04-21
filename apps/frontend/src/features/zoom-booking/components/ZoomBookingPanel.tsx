import * as React from 'react';
import { X } from 'lucide-react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import type { PanelMode } from '../hooks/useBookingPanel';

interface ZoomBookingPanelProps {
    isOpen: boolean;
    mode: PanelMode;
    onClose: () => void;
    children: React.ReactNode;
    title?: string;
}

const MODE_TITLES: Record<NonNullable<PanelMode>, string> = {
    booking: 'Book Meeting',
    detail: 'Detail Meeting',
    reschedule: 'Reschedule Meeting',
};

export function ZoomBookingPanel({
    isOpen,
    mode,
    onClose,
    children,
    title,
}: ZoomBookingPanelProps) {
    const isMobile = useMediaQuery('(max-width: 767px)');
    const panelTitle = title ?? (mode ? MODE_TITLES[mode] : '');

    // Mobile: bottom Sheet rendered in portal
    if (isMobile) {
        return (
            <Sheet open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
                <SheetContent side="bottom" className="px-0 pb-0 pt-0 max-h-[90vh] overflow-hidden flex flex-col">
                    {/* Handle bar */}
                    <div className="flex justify-center pt-3 pb-2 shrink-0">
                        <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
                    </div>
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 pb-4 shrink-0 border-b border-slate-200 dark:border-slate-700">
                        <h2 className="font-semibold text-base text-[hsl(var(--foreground))]">{panelTitle}</h2>
                        <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                    {/* Content */}
                    <div className="overflow-y-auto flex-1 custom-scrollbar">
                        {children}
                    </div>
                </SheetContent>
            </Sheet>
        );
    }

    // Desktop: fills the shell's side panel slot (width controlled by shell transition)
    if (!isOpen) return null;

    return (
        <div className="flex flex-col h-full w-full bg-white dark:bg-slate-900">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700 shrink-0">
                <h2 className="font-semibold text-base text-[hsl(var(--foreground))]">{panelTitle}</h2>
                <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
                    <X className="h-4 w-4" />
                </Button>
            </div>
            {/* Content */}
            <div className="overflow-y-auto flex-1 custom-scrollbar">
                {children}
            </div>
        </div>
    );
}
