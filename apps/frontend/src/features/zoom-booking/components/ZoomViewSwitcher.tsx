import { LayoutGrid, CalendarDays, Calendar, ListTodo } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CalendarView } from '../hooks/useCalendarView';
import { motion } from 'framer-motion';

interface ZoomViewSwitcherProps {
    view: CalendarView;
    onViewChange: (view: CalendarView) => void;
    className?: string;
}

const VIEWS: { value: CalendarView; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { value: 'month', label: 'Month', icon: LayoutGrid },
    { value: 'week', label: 'Week', icon: CalendarDays },
    { value: 'day', label: 'Day', icon: Calendar },
];

export function ZoomViewSwitcher({ view, onViewChange, className }: ZoomViewSwitcherProps) {
    return (
        <div className={cn("flex items-center gap-1 bg-[hsl(var(--muted))] p-1 rounded-xl shadow-inner ring-1 ring-[hsl(var(--border))]", className)}>
            {VIEWS.map(({ value, label, icon: Icon }) => {
                const isActive = view === value;
                return (
                    <button
                        key={value}
                        onClick={() => onViewChange(value)}
                        className={cn(
                            "relative flex items-center justify-center h-8 px-3 text-xs font-medium gap-1.5 rounded-lg transition-colors duration-200 z-10 outline-none",
                            isActive
                                ? "text-[hsl(var(--primary))] shadow-sm"
                                : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                        )}
                    >
                        {isActive && (
                            <motion.div
                                layoutId="view-indicator"
                                className="absolute inset-0 bg-[hsl(var(--background))] rounded-lg shadow-sm border border-[hsl(var(--border))]"
                                transition={{ ease: [0.23, 1, 0.32, 1], duration: 0.2 }}
                                style={{ zIndex: -1 }}
                            />
                        )}
                        <Icon className="h-3.5 w-3.5 relative z-10" />
                        <span className="relative z-10">{label}</span>
                    </button>
                );
            })}
            <div className="w-px h-5 bg-[hsl(var(--border))] mx-1 transition-opacity duration-200" style={{ opacity: view === 'my-bookings' ? 0 : 1 }} />
            <button
                onClick={() => onViewChange('my-bookings')}
                className={cn(
                    "relative flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-semibold transition-all duration-200 z-10 outline-none",
                    view === 'my-bookings'
                        ? "text-[hsl(var(--primary-foreground))] shadow-sm"
                        : "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--secondary))]/80 hover:text-[hsl(var(--foreground))]"
                )}
            >
                {view === 'my-bookings' && (
                    <motion.div
                        layoutId="view-indicator"
                        className="absolute inset-0 bg-[hsl(var(--primary))] rounded-lg shadow-sm"
                        transition={{ ease: [0.23, 1, 0.32, 1], duration: 0.2 }}
                        style={{ zIndex: -1 }}
                    />
                )}
                <ListTodo className="h-3.5 w-3.5 relative z-10" />
                <span className="relative z-10">My Bookings</span>
            </button>
        </div>
    );
}