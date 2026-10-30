import React, { useMemo } from 'react';
import { Video, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { ZoomBooking } from '../types';
import type { AccountLoad } from '../utils/autoPickAccount';

export interface ZoomRightSidebarProps {
    accounts: AccountLoad[];
    upcomingBookings: ZoomBooking[];
    onSync?: () => void;
    lastSyncAt?: Date | null;
    userName?: string;
    selectedAccountId?: string;
    onAccountClick?: (accountId: string) => void;
    onBookingClick?: (bookingId: string) => void;
}

export function ZoomRightSidebar({
    accounts,
    upcomingBookings,
    selectedAccountId,
    onAccountClick,
    onBookingClick,
}: ZoomRightSidebarProps) {

    const maxMeetings = Math.max(1, ...accounts.map(a => a.meetingsAtTime));
    const totalMeetings = accounts.reduce((sum, a) => sum + a.meetingsAtTime, 0);

    const mostFreeAccountId = useMemo(() => {
        if (accounts.length <= 1) return null;
        let min = Infinity;
        let minId = null;
        for (const a of accounts) {
            if (a.meetingsAtTime < min) {
                min = a.meetingsAtTime;
                minId = a.id;
            }
        }
        return minId;
    }, [accounts]);

    return (
        <aside
            data-testid="zoom-right-sidebar"
            className="hidden lg:flex w-[280px] shrink-0 bg-card border-l border-border flex-col min-h-0 select-none overflow-y-auto custom-scrollbar"
        >
            {/* 1. Account Load Section (Shows real meeting volume for the active calendar period) */}
            <section className="p-4 border-b border-border">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Account Load
                    </h3>
                    <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                        {accounts.length} Akun
                    </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-2 px-0.5">
                    <span>Periode Kalender Aktif</span>
                    <span className="font-mono font-bold text-foreground">{totalMeetings} meeting{totalMeetings > 1 ? 's' : ''}</span>
                </div>

                {accounts.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">No accounts</p>
                ) : (
                    <div className="space-y-1.5 max-h-[220px] overflow-y-auto custom-scrollbar pr-1">
                        {accounts.map((acc) => {
                            const isSelected = selectedAccountId === acc.id;
                            const isMostFree = acc.id === mostFreeAccountId;

                            return (
                                <button
                                    key={acc.id}
                                    type="button"
                                    onClick={() => onAccountClick && onAccountClick(acc.id)}
                                    className={cn(
                                        "w-full flex items-center gap-2 text-xs p-1.5 rounded-lg transition-colors text-left group cursor-pointer",
                                        isSelected
                                            ? "bg-primary/10 border border-primary/30 text-primary font-semibold shadow-2xs"
                                            : "hover:bg-muted/60 text-foreground"
                                    )}
                                    title={`Klik untuk filter kalender ke ${acc.name} (${acc.meetingsAtTime} meeting)`}
                                >
                                    <span
                                        className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs"
                                        style={{ backgroundColor: acc.colorHex }}
                                        aria-hidden="true"
                                    />
                                    <span className="flex-1 truncate text-xs font-medium flex items-center gap-1.5">
                                        <span>{acc.name}</span>
                                        {isMostFree && (
                                            <span
                                                className="text-[9px] font-semibold px-1 py-0.2 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shrink-0 leading-tight"
                                                title="Akun paling senggang saat ini"
                                            >
                                                Senggang
                                            </span>
                                        )}
                                    </span>
                                    <span className={cn(
                                        "text-xs font-mono tabular-nums mr-1",
                                        acc.meetingsAtTime > 0 ? "font-bold text-foreground" : "text-muted-foreground/60"
                                    )}>
                                        {acc.meetingsAtTime}
                                    </span>
                                    <span className="w-12 h-1.5 bg-muted rounded-full overflow-hidden shrink-0">
                                        <span
                                            className="block h-full rounded-full transition-all duration-300"
                                            style={{
                                                width: `${Math.min(100, (acc.meetingsAtTime / maxMeetings) * 100)}%`,
                                                backgroundColor: acc.colorHex,
                                            }}
                                        />
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                )}
            </section>

            {/* 2. Upcoming Meetings Section */}
            <section className="p-4 flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between mb-2.5 shrink-0">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Upcoming
                    </h3>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary tabular-nums">
                        {upcomingBookings.length}
                    </span>
                </div>

                {upcomingBookings.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">No upcoming meetings</p>
                ) : (
                    <ul className="space-y-2 overflow-y-auto custom-scrollbar pr-1 flex-1">
                        {upcomingBookings.slice(0, 10).map((b) => {
                            const joinUrl = b.meeting?.joinUrl || b.joinUrl;
                            return (
                                <li
                                    key={b.id}
                                    onClick={() => onBookingClick && onBookingClick(b.id)}
                                    className="p-2.5 rounded-xl border border-border/80 bg-background/60 hover:bg-muted/40 transition-colors text-xs space-y-1.5 shadow-2xs group cursor-pointer"
                                >
                                    <div className="font-bold truncate text-foreground leading-snug group-hover:text-primary transition-colors">
                                        {b.title}
                                    </div>
                                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                                        <span>{b.bookingDate}</span>
                                        <span className="font-mono font-semibold text-primary">{b.startTime} - {b.endTime}</span>
                                    </div>
                                    {joinUrl && (
                                        <div className="flex items-center gap-1.5 pt-0.5" onClick={(e) => e.stopPropagation()}>
                                            <button
                                                type="button"
                                                onClick={() => window.open(joinUrl, '_blank', 'noopener,noreferrer')}
                                                className="px-2 py-0.5 rounded-md bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 font-semibold text-[10.5px] flex items-center gap-1 transition-colors cursor-pointer"
                                                title="Buka meeting di Zoom"
                                            >
                                                <Video className="w-3 h-3" />
                                                <span>Join Zoom</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    navigator.clipboard.writeText(joinUrl);
                                                    toast.success('Link Zoom disalin ke clipboard');
                                                }}
                                                className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                                                title="Salin link Zoom"
                                                aria-label="Salin link Zoom"
                                            >
                                                <Copy className="w-3 h-3" />
                                            </button>
                                        </div>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                )}
            </section>
        </aside>
    );
}
