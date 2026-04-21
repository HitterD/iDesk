import { Video, Check, Users, BarChart3, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ZoomAccount } from '../types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format, startOfWeek, addWeeks, subWeeks, addDays, isToday, isSameDay } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { formatZoomAccountName } from '../utils';

interface AccountSidebarProps {
    accounts: ZoomAccount[];
    selectedAccountId: string | undefined;
    onSelectAccount: (accountId: string) => void;
    className?: string;
    bookingCounts?: Record<string, number>;
    // P4: Mini calendar props
    currentWeek?: Date;
    onWeekChange?: (week: Date) => void;
    onGoToToday?: () => void;
}

export function AccountSidebar({
    accounts,
    selectedAccountId,
    onSelectAccount,
    className,
    bookingCounts = {},
    currentWeek,
    onWeekChange,
    onGoToToday,
}: AccountSidebarProps) {
    const totalBookings = Object.values(bookingCounts).reduce((a, b) => a + b, 0);

    return (
        <div className={cn("flex flex-col h-full", className)}>

            {/* P4: Mini Calendar Widget */}
            {currentWeek && onWeekChange && (
                <div className="p-4 border-b border-[hsl(var(--border))]">
                    <div className="flex items-center justify-between mb-3 text-sm">
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                            {format(currentWeek, 'MMMM yyyy', { locale: idLocale })}
                        </span>
                        <div className="flex gap-1">
                            <button
                                onClick={() => onWeekChange(subWeeks(currentWeek, 1))}
                                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-500 transition-colors"
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </button>
                            <button
                                onClick={() => onWeekChange(addWeeks(currentWeek, 1))}
                                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-500 transition-colors"
                            >
                                <ChevronRight className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                    
                    {/* Week Days */}
                    <div className="grid grid-cols-5 gap-1 text-center">
                        {[0, 1, 2, 3, 4].map((dayOffset) => {
                            const day = addDays(currentWeek, dayOffset);
                            const dayIsToday = isToday(day);
                            return (
                                <div
                                    key={dayOffset}
                                    className={cn(
                                        'py-2 px-1 rounded-xl flex flex-col items-center justify-center transition-colors',
                                        dayIsToday
                                            ? 'bg-primary text-primary-foreground shadow-sm'
                                            : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                                    )}
                                >
                                    <span className={cn("text-[10px] font-semibold mb-0.5", dayIsToday ? "text-primary-foreground/90" : "text-slate-500")}>
                                        {format(day, 'EEE', { locale: idLocale })}
                                    </span>
                                    <span className="text-sm font-bold">
                                        {format(day, 'd')}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Account List */}
            <div className="flex-1 overflow-y-auto p-3">
                <div className="flex items-center justify-between px-2 mb-3">
                    <div className="flex items-center gap-2 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        <span>Zoom Accounts</span>
                    </div>
                    <Badge variant="outline" className="bg-slate-50 dark:bg-slate-800 text-[10px] font-mono font-medium rounded-full py-0">
                        {accounts.length}
                    </Badge>
                </div>
                
                <TooltipProvider delayDuration={300}>
                    <div className="space-y-1.5">
                        {accounts.map((account) => {
                            const isSelected = selectedAccountId === account.id;
                            const count = bookingCounts[account.id] || 0;

                            return (
                                <Tooltip key={account.id}>
                                    <TooltipTrigger asChild>
                                        <button
                                            onClick={() => onSelectAccount(account.id)}
                                            className={cn(
                                                "w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-colors duration-150 border",
                                                isSelected 
                                                    ? `bg-slate-50 dark:bg-slate-800/50`
                                                    : "border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:border-[hsl(var(--border))] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                            )}
                                            style={isSelected ? {
                                                borderColor: 'var(--border)',
                                                borderLeftColor: account.colorHex,
                                                borderLeftWidth: '3px'
                                            } : undefined}
                                        >
                                            <div
                                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                                style={{ backgroundColor: account.colorHex }}
                                            />

                                            {/* Account info */}
                                            <div className="flex-1 min-w-0">
                                                <div className={cn(
                                                    "font-bold text-sm truncate transition-colors",
                                                    isSelected ? "text-slate-900 dark:text-white" : "text-slate-700 dark:text-slate-300"
                                                )}>
                                                    {formatZoomAccountName(account.name)}
                                                </div>
                                            </div>

                                            {/* Selected indicator or count */}
                                            {count > 0 && (
                                                <Badge variant="secondary" className="bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 text-[10px] font-mono shrink-0 rounded-md">
                                                    {count}
                                                </Badge>
                                            )}
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="right" className="max-w-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg">
                                        <div className="p-1">
                                            <p className="font-bold text-sm text-slate-900 dark:text-white">{formatZoomAccountName(account.name)}</p>
                                        </div>
                                    </TooltipContent>
                                </Tooltip>
                            );
                        })}
                    </div>
                </TooltipProvider>
            </div>

            {/* Status indicator */}
            <div className="p-3 border-t border-[hsl(var(--border))] bg-slate-50 dark:bg-slate-900/40">
                <div className="flex items-center gap-2 text-[11px] font-medium text-slate-500">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.5)]" />
                    <span>{accounts.filter(a => a.isActive).length} accounts active</span>
                </div>
            </div>
        </div>
    );
}
