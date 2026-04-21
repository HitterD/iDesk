import React, { useMemo } from 'react';
import { Calendar } from 'lucide-react';
import { RenewalContract, ContractStatus } from '../types/renewal.types';
import { cn } from '@/lib/utils';

interface ContractCalendarProps {
    contracts: RenewalContract[];
    onContractClick?: (contract: RenewalContract) => void;
    isLoading?: boolean;
}

interface DayData {
    date: Date;
    contracts: RenewalContract[];
    isCurrentMonth: boolean;
    isToday: boolean;
}

const getDaysInMonth = (year: number, month: number): number => {
    return new Date(year, month + 1, 0).getDate();
};

const getMonthStart = (year: number, month: number): number => {
    return new Date(year, month, 1).getDay();
};

// Skeleton loader component for calendar
const CalendarSkeleton: React.FC = () => (
    <div className="bg-white dark:bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] overflow-hidden shadow-sm animate-pulse">
        {/* Header skeleton */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[hsl(var(--border))]">
            <div className="flex items-center gap-3">
                <div className="w-5 h-5 bg-slate-200 dark:bg-slate-700 rounded" />
                <div className="w-40 h-5 bg-slate-200 dark:bg-slate-700 rounded" />
            </div>
            <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-slate-200 dark:bg-slate-700 rounded-lg" />
                <div className="w-28 h-5 bg-slate-200 dark:bg-slate-700 rounded" />
                <div className="w-8 h-8 bg-slate-200 dark:bg-slate-700 rounded-lg" />
                <div className="w-14 h-6 bg-slate-200 dark:bg-slate-700 rounded-lg ml-2" />
            </div>
        </div>
        {/* Calendar grid skeleton */}
        <div className="p-4">
            {/* Day headers */}
            <div className="grid grid-cols-7 gap-1 mb-2">
                {[...Array(7)].map((_, i) => (
                    <div key={i} className="h-4 bg-slate-200 dark:bg-slate-700 rounded mx-2" />
                ))}
            </div>
            {/* Days grid */}
            <div className="grid grid-cols-7 gap-1">
                {[...Array(42)].map((_, i) => (
                    <div key={i} className="min-h-[80px] p-1 rounded-lg bg-slate-100 dark:bg-[hsl(var(--background))] border border-[hsl(var(--border))]">
                        <div className="w-4 h-3 bg-slate-200 dark:bg-slate-600 rounded mb-1" />
                        {i % 7 === 2 && <div className="w-full h-4 bg-slate-200 dark:bg-slate-600 rounded mt-1" />}
                        {i % 5 === 0 && <div className="w-3/4 h-4 bg-slate-200 dark:bg-slate-600 rounded mt-1" />}
                    </div>
                ))}
            </div>
        </div>
        {/* Legend skeleton */}
        <div className="flex items-center justify-center gap-6 px-6 py-3 border-t border-[hsl(var(--border))] bg-slate-50/50 dark:bg-[hsl(var(--background))]">
            {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-slate-300 dark:bg-slate-600" />
                    <div className="w-12 h-3 bg-slate-200 dark:bg-slate-700 rounded" />
                </div>
            ))}
        </div>
    </div>
);

export const ContractCalendar: React.FC<ContractCalendarProps> = ({
    contracts,
    onContractClick,
    isLoading = false,
}) => {
    // Show skeleton while loading
    if (isLoading) {
        return <CalendarSkeleton />;
    }

    const today = new Date();
    const [viewYear, setViewYear] = React.useState(today.getFullYear());
    const [viewMonth, setViewMonth] = React.useState(today.getMonth());

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // Group contracts by end date
    const contractsByDate = useMemo(() => {
        const map = new Map<string, RenewalContract[]>();
        contracts.forEach(contract => {
            if (contract.endDate) {
                const dateKey = new Date(contract.endDate).toISOString().split('T')[0];
                const existing = map.get(dateKey) || [];
                existing.push(contract);
                map.set(dateKey, existing);
            }
        });
        return map;
    }, [contracts]);

    // Generate calendar grid
    const calendarDays = useMemo(() => {
        const days: DayData[] = [];
        const daysInMonth = getDaysInMonth(viewYear, viewMonth);
        const monthStart = getMonthStart(viewYear, viewMonth);

        // Previous month padding
        const prevMonthDays = getDaysInMonth(viewYear, viewMonth - 1);
        for (let i = monthStart - 1; i >= 0; i--) {
            const date = new Date(viewYear, viewMonth - 1, prevMonthDays - i);
            const dateKey = date.toISOString().split('T')[0];
            days.push({
                date,
                contracts: contractsByDate.get(dateKey) || [],
                isCurrentMonth: false,
                isToday: false,
            });
        }

        // Current month
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(viewYear, viewMonth, day);
            const dateKey = date.toISOString().split('T')[0];
            const isToday = date.toDateString() === today.toDateString();
            days.push({
                date,
                contracts: contractsByDate.get(dateKey) || [],
                isCurrentMonth: true,
                isToday,
            });
        }

        // Next month padding
        const remainingDays = 42 - days.length; // 6 rows * 7 days
        for (let i = 1; i <= remainingDays; i++) {
            const date = new Date(viewYear, viewMonth + 1, i);
            const dateKey = date.toISOString().split('T')[0];
            days.push({
                date,
                contracts: contractsByDate.get(dateKey) || [],
                isCurrentMonth: false,
                isToday: false,
            });
        }

        return days;
    }, [viewYear, viewMonth, contractsByDate]);

    const navigateMonth = (delta: number) => {
        const newDate = new Date(viewYear, viewMonth + delta);
        setViewYear(newDate.getFullYear());
        setViewMonth(newDate.getMonth());
    };

    const getStatusColor = (status: ContractStatus) => {
        switch (status) {
            case ContractStatus.EXPIRED:
                return 'bg-[hsl(var(--error-500))]';
            case ContractStatus.EXPIRING_SOON:
                return 'bg-[hsl(var(--warning-500))]';
            case ContractStatus.ACTIVE:
                return 'bg-[hsl(var(--success-500))]';
            default:
                return 'bg-slate-500';
        }
    };

    return (
        <div className="bg-white dark:bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] overflow-hidden shadow-sm">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[hsl(var(--border))]">
                <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-primary" />
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                        Contract Expiry Calendar
                    </h3>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => navigateMonth(-1)}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-[hsl(var(--background))] text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-lg transition-colors"
                    >
                        ←
                    </button>
                    <span className="text-sm font-bold text-slate-900 dark:text-white min-w-[140px] text-center">
                        {monthNames[viewMonth]} {viewYear}
                    </span>
                    <button
                        onClick={() => navigateMonth(1)}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-[hsl(var(--background))] text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-lg transition-colors"
                    >
                        →
                    </button>
                    <button
                        onClick={() => {
                            setViewYear(today.getFullYear());
                            setViewMonth(today.getMonth());
                        }}
                        className="ml-2 px-3 py-1.5 text-xs font-bold bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors shadow-sm"
                    >
                        Today
                    </button>
                </div>
            </div>

            {/* Calendar Grid */}
            <div className="p-4">
                {/* Day headers */}
                <div className="grid grid-cols-7 gap-1 mb-2">
                    {dayNames.map(day => (
                        <div key={day} className="text-center text-xs font-medium text-slate-500 dark:text-slate-400 py-2">
                            {day}
                        </div>
                    ))}
                </div>

                {/* Days grid */}
                <div className="grid grid-cols-7 gap-1">
                    {calendarDays.map((day, index) => (
                        <div
                            key={index}
                            className={cn(
                                "min-h-[80px] p-1.5 rounded-lg border transition-[opacity,transform,colors] duration-200 ease-out",
                                day.isCurrentMonth
                                    ? "bg-slate-50/50 dark:bg-[hsl(var(--background))] border-[hsl(var(--border))]"
                                    : "bg-transparent border-transparent opacity-50",
                                day.isToday && "ring-2 ring-primary ring-offset-2 dark:ring-offset-[hsl(var(--card))]",
                                day.contracts.length > 0 && "hover:shadow-md hover:border-primary/30 cursor-pointer"
                            )}
                        >
                            <div className={cn(
                                "text-xs mb-1.5 px-1",
                                day.isCurrentMonth
                                    ? "font-bold text-slate-700 dark:text-slate-300"
                                    : "font-medium text-slate-400 dark:text-slate-600",
                                day.isToday && "text-primary font-bold"
                            )}>
                                {day.date.getDate()}
                            </div>

                            {/* Contract dots/badges */}
                            <div className="space-y-0.5">
                                {day.contracts.slice(0, 3).map((contract, idx) => (
                                    <div
                                        key={contract.id}
                                        onClick={() => onContractClick?.(contract)}
                                        className={cn(
                                            "text-[10px] px-1 py-0.5 rounded truncate text-white font-medium cursor-pointer hover:opacity-80",
                                            getStatusColor(contract.status)
                                        )}
                                        title={`${contract.poNumber || 'No PO'} - ${contract.vendorName || 'Unknown'}`}
                                    >
                                        {contract.vendorName?.substring(0, 10) || contract.poNumber?.substring(0, 10) || 'Contract'}
                                    </div>
                                ))}
                                {day.contracts.length > 3 && (
                                    <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                                        +{day.contracts.length - 3} more
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center gap-6 px-6 py-4 border-t border-[hsl(var(--border))] bg-slate-50/80 dark:bg-[hsl(var(--background))]">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[hsl(var(--error-500))]" />
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Expired</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[hsl(var(--warning-500))]" />
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Expiring Soon</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[hsl(var(--success-500))]" />
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Active</span>
                </div>
            </div>
        </div>
    );
};
