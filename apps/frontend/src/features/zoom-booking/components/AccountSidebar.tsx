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
            {/* P2: Glassmorphism Stats Section */}
            <div className="p-4 grid-separator-h">
                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
                    <BarChart3 className="h-3.5 w-3.5" />
                    <span>Quick Stats</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    {/* Accounts Card - Premium Glow */}
                    <div className="relative overflow-hidden bg-gradient-to-br from-blue-500/30 via-blue-600/20 to-blue-700/10 backdrop-blur-md rounded-2xl p-4 border border-blue-400/30 shadow-xl shadow-blue-500/20 hover:shadow-blue-500/40 hover:scale-[1.02] transition-all duration-300 group">
                        <div className="absolute -top-4 -right-4 w-20 h-20 bg-blue-400/30 rounded-full blur-2xl group-hover:bg-blue-400/50 transition-all" />
                        <div className="absolute inset-0 bg-gradient-to-t from-blue-500/5 to-transparent" />
                        <div className="relative">
                            <div className="text-3xl font-black text-blue-400 drop-shadow-lg">{accounts.length}</div>
                            <div className="text-[10px] font-semibold text-blue-300/80 uppercase tracking-widest">Accounts</div>
                        </div>
                    </div>
                    {/* Bookings Card - Premium Glow */}
                    <div className="relative overflow-hidden bg-gradient-to-br from-emerald-500/30 via-emerald-600/20 to-emerald-700/10 backdrop-blur-md rounded-2xl p-4 border border-emerald-400/30 shadow-xl shadow-emerald-500/20 hover:shadow-emerald-500/40 hover:scale-[1.02] transition-all duration-300 group">
                        <div className="absolute -top-4 -right-4 w-20 h-20 bg-emerald-400/30 rounded-full blur-2xl group-hover:bg-emerald-400/50 transition-all" />
                        <div className="absolute inset-0 bg-gradient-to-t from-emerald-500/5 to-transparent" />
                        <div className="relative">
                            <div className="text-3xl font-black text-emerald-400 drop-shadow-lg">{totalBookings}</div>
                            <div className="text-[10px] font-semibold text-emerald-300/80 uppercase tracking-widest">This Week</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* P4: Mini Calendar Widget */}
            {currentWeek && onWeekChange && (
                <div className="p-3 grid-separator-h">
                    <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>Quick Navigation</span>
                    </div>
                    <div className="bg-muted/30 rounded-lg p-2">
                        {/* Month/Year Header */}
                        <div className="flex items-center justify-between mb-2">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => onWeekChange(subWeeks(currentWeek, 1))}
                            >
                                <ChevronLeft className="h-3.5 w-3.5" />
                            </Button>
                            <span className="text-xs font-semibold">
                                {format(currentWeek, 'MMM yyyy', { locale: idLocale })}
                            </span>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => onWeekChange(addWeeks(currentWeek, 1))}
                            >
                                <ChevronRight className="h-3.5 w-3.5" />
                            </Button>
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
                                            'py-1.5 rounded-md text-[10px] font-medium transition-colors',
                                            dayIsToday
                                                ? 'bg-blue-500 text-white'
                                                : 'text-muted-foreground hover:bg-muted'
                                        )}
                                    >
                                        <div>{format(day, 'EEE', { locale: idLocale })}</div>
                                        <div className={cn('text-sm font-bold', dayIsToday && 'text-white')}>
                                            {format(day, 'd')}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        {/* Today Button */}
                        {onGoToToday && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="w-full mt-2 h-7 text-xs"
                                onClick={onGoToToday}
                            >
                                Go to Today
                            </Button>
                        )}
                    </div>
                </div>
            )}

            {/* Account List */}
            <div className="flex-1 overflow-y-auto p-2">
                <div className="flex items-center gap-2 px-2 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    <Video className="h-3.5 w-3.5" />
                    <span>Zoom Accounts</span>
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
                                                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-200",
                                                "hover:bg-muted/60 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                                                // P3: Account color accent on selection
                                                isSelected && "shadow-md"
                                            )}
                                            style={isSelected ? {
                                                background: `linear-gradient(135deg, ${account.colorHex}15, ${account.colorHex}08)`,
                                                borderLeft: `3px solid ${account.colorHex}`,
                                            } : undefined}
                                        >
                                            {/* Color indicator with glow */}
                                            <div
                                                className={cn(
                                                    "w-3.5 h-3.5 rounded-full shrink-0 transition-all duration-200",
                                                    isSelected && "ring-2 ring-offset-2 shadow-lg"
                                                )}
                                                style={{
                                                    backgroundColor: account.colorHex,
                                                    boxShadow: isSelected ? `0 0 12px ${account.colorHex}60` : undefined,
                                                    // Ring color via CSS variable workaround
                                                    ['--tw-ring-color' as any]: account.colorHex,
                                                }}
                                            />

                                            {/* Account info */}
                                            <div className="flex-1 min-w-0">
                                                <div className={cn(
                                                    "font-semibold text-sm truncate transition-colors",
                                                    isSelected ? "text-foreground" : "text-muted-foreground"
                                                )}>
                                                    {account.name}
                                                </div>
                                                <div className="text-[11px] text-muted-foreground truncate">
                                                    {account.email}
                                                </div>
                                            </div>

                                            {/* Selected indicator or count */}
                                            {isSelected ? (
                                                <Check className="h-4 w-4 shrink-0" style={{ color: account.colorHex }} />
                                            ) : count > 0 ? (
                                                <Badge variant="secondary" className="text-xs font-mono shrink-0">
                                                    {count}
                                                </Badge>
                                            ) : null}
                                        </button>
                                    </TooltipTrigger>
                                    {/* P1: Full email tooltip for truncated emails */}
                                    <TooltipContent side="right" className="max-w-xs">
                                        <div className="space-y-1">
                                            <p className="font-semibold">{account.name}</p>
                                            <p className="text-xs text-muted-foreground">{account.email}</p>
                                        </div>
                                    </TooltipContent>
                                </Tooltip>
                            );
                        })}
                    </div>
                </TooltipProvider>
            </div>

            {/* Status indicator */}
            <div className="p-4 grid-separator-h" style={{ borderTopWidth: 'var(--border-width-default)', borderBottomWidth: 0 }}>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>{accounts.filter(a => a.isActive).length} accounts active</span>
                </div>
            </div>
        </div>
    );
}
