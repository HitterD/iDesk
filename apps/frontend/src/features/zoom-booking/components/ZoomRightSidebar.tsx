import { CheckCircle2, Keyboard, User as UserIcon } from 'lucide-react';
import type { ZoomBooking } from '../types';
import type { AccountLoad } from '../utils/autoPickAccount';

export interface ZoomRightSidebarProps {
    accounts: AccountLoad[];
    upcomingBookings: ZoomBooking[];
    onSync: () => void;
    lastSyncAt: Date | null;
    userName: string;
}

export function ZoomRightSidebar({
    accounts,
    upcomingBookings,
    onSync,
    lastSyncAt,
    userName,
}: ZoomRightSidebarProps) {
    const top5 = [...accounts]
        .sort((a, b) => b.meetingsAtTime - a.meetingsAtTime)
        .slice(0, 5);

    return (
        <aside
            data-testid="zoom-right-sidebar"
            className="w-[280px] shrink-0 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-700 flex flex-col min-h-0"
        >
            {/* Account Load */}
            <section className="p-4 border-b border-slate-200 dark:border-slate-700">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                    Account Load
                </h3>
                {top5.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No accounts</p>
                ) : (
                    <ul className="space-y-2.5">
                        {top5.map((acc) => (
                            <li key={acc.id} className="flex items-center gap-2 text-xs">
                                <span
                                    className="w-2 h-2 rounded-full shrink-0"
                                    style={{ backgroundColor: acc.colorHex }}
                                    aria-hidden="true"
                                />
                                <span className="flex-1 truncate text-foreground font-medium">
                                    {acc.name}
                                </span>
                                <span className="text-muted-foreground font-bold tabular-nums">
                                    {acc.meetingsAtTime}
                                </span>
                                <span className="w-14 h-1.5 bg-muted rounded-full overflow-hidden">
                                    <span
                                        className="block h-full rounded-full"
                                        style={{
                                            width: `${Math.min(100, (acc.meetingsAtTime / 25) * 100)}%`,
                                            backgroundColor: acc.colorHex,
                                        }}
                                    />
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            {/* Upcoming */}
            <section className="p-4 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Upcoming
                    </h3>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                        {upcomingBookings.length}
                    </span>
                </div>
                {upcomingBookings.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No upcoming meetings</p>
                ) : (
                    <ul className="space-y-2">
                        {upcomingBookings.slice(0, 3).map((b) => (
                            <li
                                key={b.id}
                                className="px-3 py-2 rounded-lg text-xs bg-primary/5 dark:bg-primary/10"
                            >
                                <div className="font-semibold truncate text-foreground">
                                    {b.title}
                                </div>
                                <div className="text-xs text-muted-foreground mt-0.5">
                                    {b.bookingDate} · {b.startTime}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            {/* System (pinned to bottom) */}
            <section className="p-4 mt-auto">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                    System
                </h3>
                <button
                    type="button"
                    onClick={onSync}
                    className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 mb-2 hover:underline"
                >
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                    {lastSyncAt ? `Sync OK · ${formatRelative(lastSyncAt)}` : 'Never synced'}
                </button>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                    <UserIcon className="h-3.5 w-3.5" aria-hidden="true" />
                    Logged in as <strong className="text-foreground">{userName}</strong>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Keyboard className="h-3.5 w-3.5" aria-hidden="true" />
                    Press <kbd className="bg-muted border border-border px-1.5 py-0.5 rounded text-xs font-mono">?</kbd> for shortcuts
                </div>
            </section>
        </aside>
    );
}

function formatRelative(date: Date): string {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
}
