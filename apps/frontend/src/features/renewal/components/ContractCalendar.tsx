import React, { useMemo } from 'react';
import { Calendar } from 'lucide-react';
import { RenewalContract, ContractStatus } from '../types/renewal.types';
import { cn } from '@/lib/utils';

interface ContractCalendarProps {
    contracts: RenewalContract[];
    onContractClick?: (contract: RenewalContract) => void;
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

export const ContractCalendar: React.FC<ContractCalendarProps> = ({
    contracts,
    onContractClick,
}) => {
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
                return 'bg-red-500';
            case ContractStatus.EXPIRING_SOON:
                return 'bg-orange-500';
            case ContractStatus.ACTIVE:
                return 'bg-green-500';
            default:
                return 'bg-slate-400';
        }
    };

    return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-primary" />
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white">
                        Contract Expiry Calendar
                    </h3>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => navigateMonth(-1)}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                    >
                        ←
                    </button>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300 min-w-[140px] text-center">
                        {monthNames[viewMonth]} {viewYear}
                    </span>
                    <button
                        onClick={() => navigateMonth(1)}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                    >
                        →
                    </button>
                    <button
                        onClick={() => {
                            setViewYear(today.getFullYear());
                            setViewMonth(today.getMonth());
                        }}
                        className="ml-2 px-3 py-1 text-xs font-medium bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors"
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
                                "min-h-[80px] p-1 rounded-lg border transition-colors",
                                day.isCurrentMonth
                                    ? "bg-slate-50 dark:bg-slate-900/30 border-slate-200 dark:border-slate-700"
                                    : "bg-slate-100/50 dark:bg-slate-900/10 border-transparent",
                                day.isToday && "ring-2 ring-primary ring-offset-2 dark:ring-offset-slate-800",
                                day.contracts.length > 0 && "hover:shadow-md cursor-pointer"
                            )}
                        >
                            <div className={cn(
                                "text-xs font-medium mb-1",
                                day.isCurrentMonth
                                    ? "text-slate-700 dark:text-slate-300"
                                    : "text-slate-400 dark:text-slate-600",
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
            <div className="flex items-center justify-center gap-6 px-6 py-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <span className="text-xs text-slate-500 dark:text-slate-400">Expired</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-orange-500" />
                    <span className="text-xs text-slate-500 dark:text-slate-400">Expiring Soon</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    <span className="text-xs text-slate-500 dark:text-slate-400">Active</span>
                </div>
            </div>
        </div>
    );
};
