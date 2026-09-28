import { useState, useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { X, Plus, Calendar, Search, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { softBackground } from '../utils/accountColors';

export interface PopoverDayEvent {
    bookingId?: string;
    status: string;
    title: string;
    startTime?: string;
    endTime?: string;
    joinUrl?: string;
    accountName?: string;
    accountColorHex?: string;
}

interface ZoomMonthDayPopoverProps {
    date: string;
    events: PopoverDayEvent[];
    onClose: () => void;
    onEventClick: (bookingId: string) => void;
    onNewBooking?: () => void;
}

export function ZoomMonthDayPopover({
    date,
    events,
    onClose,
    onEventClick,
    onNewBooking,
}: ZoomMonthDayPopoverProps) {
    const parsedDate = parseISO(date);
    const [selectedAccount, setSelectedAccount] = useState<string>('all');
    const [search, setSearch] = useState<string>('');

    // Group meetings by account for filter chips
    const accountsSummary = useMemo(() => {
        const map = new Map<string, { name: string; colorHex: string; count: number }>();
        for (const ev of events) {
            const accName = ev.accountName || 'Zoom';
            const existing = map.get(accName);
            if (existing) {
                existing.count++;
            } else {
                map.set(accName, { name: accName, colorHex: ev.accountColorHex || '#8E8E93', count: 1 });
            }
        }
        return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
    }, [events]);

    // Filter events by account and search query
    const filteredEvents = useMemo(() => {
        return events.filter((ev) => {
            const accName = ev.accountName || 'Zoom';
            const matchesAccount = selectedAccount === 'all' || accName === selectedAccount;
            const q = search.trim().toLowerCase();
            const matchesSearch = !q || ev.title.toLowerCase().includes(q) || accName.toLowerCase().includes(q);
            return matchesAccount && matchesSearch;
        });
    }, [events, selectedAccount, search]);

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-[100] bg-black/30 dark:bg-black/50 backdrop-blur-sm animate-in fade-in-0 duration-150"
                onClick={(e) => {
                    e.stopPropagation();
                    onClose();
                }}
            />

            {/* Modal card */}
            <div
                className={cn(
                    "fixed z-[100] w-[94vw] sm:w-[460px] rounded-3xl shadow-2xl ring-1 ring-black/5 dark:ring-white/10",
                    "bg-card select-none",
                    "animate-in fade-in-0 zoom-in-95 duration-150 flex flex-col max-h-[85vh]",
                    "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 overflow-hidden"
                )}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-start justify-between px-5 pt-5 pb-3 shrink-0">
                    <div className="min-w-0">
                        <div className="text-xs font-medium capitalize text-primary">
                            {format(parsedDate, 'EEEE', { locale: idLocale })}
                        </div>
                        <div className="text-xl font-semibold tracking-tight text-foreground">
                            {format(parsedDate, 'd MMMM yyyy', { locale: idLocale })}
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                            {events.length} meeting · {accountsSummary.length} akun Zoom
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer shrink-0"
                        aria-label="Tutup"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Sub-bar: Search & Account Filter Tabs */}
                {events.length > 0 && (
                    <div className="px-5 pb-3 space-y-2 shrink-0">
                        {/* Search input when many meetings */}
                        {events.length > 4 && (
                            <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                                <Input
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Cari judul meeting atau akun..."
                                    className="h-8 text-xs pl-8 pr-8 rounded-full border-0 bg-muted"
                                />
                                {search && (
                                    <button
                                        type="button"
                                        onClick={() => setSearch('')}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Account Filter Pills */}
                        {accountsSummary.length > 1 && (
                            <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar py-0.5">
                                <button
                                    type="button"
                                    onClick={() => setSelectedAccount('all')}
                                    className={cn(
                                        "px-3 py-1 rounded-full text-xs font-medium shrink-0 transition-colors cursor-pointer",
                                        selectedAccount === 'all'
                                            ? "bg-foreground text-background"
                                            : "bg-muted text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    Semua ({events.length})
                                </button>
                                {accountsSummary.map((acc) => (
                                    <button
                                        key={acc.name}
                                        type="button"
                                        onClick={() => setSelectedAccount(acc.name)}
                                        className={cn(
                                            "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium shrink-0 transition-colors cursor-pointer",
                                            selectedAccount === acc.name
                                                ? "bg-foreground text-background"
                                                : "bg-muted text-muted-foreground hover:text-foreground"
                                        )}
                                    >
                                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: acc.colorHex }} aria-hidden="true" />
                                        <span>{acc.name}</span>
                                        <span className="tabular-nums opacity-60">{acc.count}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Events list */}
                <div className="px-2 pb-2 overflow-y-auto custom-scrollbar flex-1 min-h-0">
                    {filteredEvents.length === 0 ? (
                        <div className="py-12 text-center text-xs text-muted-foreground">
                            <Calendar className="w-8 h-8 mx-auto opacity-30 text-primary mb-2" />
                            <p className="font-semibold text-foreground text-sm">Tidak ada meeting yang cocok</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                {search || selectedAccount !== 'all'
                                    ? 'Coba ganti filter akun atau bersihkan pencarian.'
                                    : 'Belum ada jadwal booking pada tanggal ini.'}
                            </p>
                        </div>
                    ) : (
                        filteredEvents.map((event, eventIdx) => (
                            <button
                                type="button"
                                key={event.bookingId || `event-${eventIdx}`}
                                onClick={() => {
                                    onClose();
                                    if (event.bookingId) onEventClick(event.bookingId);
                                }}
                                className="group mb-1 flex w-full items-stretch gap-3 rounded-xl border-l-4 px-3 py-2.5 text-left transition-[filter] hover:brightness-95 cursor-pointer"
                                style={{
                                    borderLeftColor: event.accountColorHex || '#8E8E93',
                                    backgroundColor: softBackground(event.accountColorHex || '#8E8E93'),
                                }}
                            >
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-medium text-foreground">{event.title}</span>
                                    <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                                        <Video className="h-3 w-3 shrink-0" style={{ color: event.accountColorHex }} />
                                        <span className="truncate font-medium" style={{ color: event.accountColorHex }}>{event.accountName || 'Zoom'}</span>
                                    </span>
                                </span>
                                {event.startTime && (
                                    <span className="shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                                        <span className="block font-medium text-foreground">{event.startTime.slice(0, 5)}</span>
                                        {event.endTime && <span className="block">{event.endTime.slice(0, 5)}</span>}
                                    </span>
                                )}
                            </button>
                        ))
                    )}
                </div>

                {/* Footer Quick Action */}
                {onNewBooking && (
                    <div className="p-4 border-t border-border/60 shrink-0">
                        <Button
                            size="sm"
                            variant="default"
                            onClick={() => {
                                onClose();
                                onNewBooking();
                            }}
                            className="w-full h-10 text-sm font-medium gap-1.5 rounded-full cursor-pointer"
                        >
                            <Plus className="w-4 h-4" />
                            <span>Book meeting di tanggal ini</span>
                        </Button>
                    </div>
                )}
            </div>
        </>
    );
}
