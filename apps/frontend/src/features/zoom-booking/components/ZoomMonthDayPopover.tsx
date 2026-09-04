import { useState, useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { X, Clock, Plus, Calendar, ExternalLink, Search, Filter, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

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
                map.set(accName, {
                    name: accName,
                    colorHex: ev.accountColorHex || '#3b82f6',
                    count: 1,
                });
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
                className="fixed inset-0 z-50 bg-black/40 dark:bg-black/60 backdrop-blur-xs animate-in fade-in-0 duration-150"
                onClick={(e) => {
                    e.stopPropagation();
                    onClose();
                }}
            />

            {/* Modal card */}
            <div
                className={cn(
                    "fixed z-50 w-[94vw] sm:w-[540px] max-w-xl rounded-2xl shadow-2xl border",
                    "bg-card/98 backdrop-blur-md border-border select-none",
                    "animate-in fade-in-0 zoom-in-95 duration-150 flex flex-col max-h-[85vh]",
                    "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 overflow-hidden"
                )}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-border/80 bg-muted/40 shrink-0">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 shadow-2xs border border-blue-500/20">
                            <Calendar className="w-4.5 h-4.5" />
                        </div>
                        <div className="min-w-0">
                            <div className="text-sm font-bold text-foreground capitalize truncate flex items-center gap-2">
                                <span>{format(parsedDate, 'EEEE, d MMMM yyyy', { locale: idLocale })}</span>
                            </div>
                            <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                                <span className="inline-flex items-center font-semibold text-blue-600 dark:text-blue-400">
                                    {events.length} Jadwal Meeting
                                </span>
                                <span>&bull;</span>
                                <span>{accountsSummary.length} Akun Zoom aktif</span>
                            </div>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer shrink-0"
                        aria-label="Tutup"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Sub-bar: Search & Account Filter Tabs */}
                {events.length > 0 && (
                    <div className="px-4 py-2.5 border-b border-border/60 bg-muted/20 space-y-2 shrink-0">
                        {/* Search input when many meetings */}
                        {events.length > 4 && (
                            <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                                <Input
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Cari judul meeting atau akun..."
                                    className="h-8 text-xs pl-8 pr-8 rounded-lg bg-background"
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
                                        "px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0 transition-all cursor-pointer",
                                        selectedAccount === 'all'
                                            ? "bg-foreground text-background shadow-xs"
                                            : "bg-background border border-border/70 text-muted-foreground hover:text-foreground hover:bg-muted/50"
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
                                            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0 transition-all cursor-pointer border",
                                            selectedAccount === acc.name
                                                ? "bg-background shadow-xs text-foreground font-bold"
                                                : "bg-background/60 border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted/40"
                                        )}
                                        style={
                                            selectedAccount === acc.name
                                                ? { borderColor: acc.colorHex, boxShadow: `0 0 0 1px ${acc.colorHex}` }
                                                : undefined
                                        }
                                    >
                                        <span
                                            className="w-2 h-2 rounded-full shrink-0"
                                            style={{ backgroundColor: acc.colorHex }}
                                        />
                                        <span>{acc.name}</span>
                                        <span className="text-[10px] opacity-70 font-mono">({acc.count})</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Events list */}
                <div className="p-4 space-y-2.5 overflow-y-auto custom-scrollbar flex-1 min-h-0">
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
                            <div
                                key={event.bookingId || `event-${eventIdx}`}
                                onClick={() => {
                                    onClose();
                                    if (event.bookingId) onEventClick(event.bookingId);
                                }}
                                className={cn(
                                    "w-full text-left p-3.5 rounded-xl text-xs font-medium cursor-pointer",
                                    "border border-border/80 bg-background hover:bg-muted/60 hover:border-blue-500/50 transition-all shadow-2xs group flex flex-col gap-2"
                                )}
                                style={{ borderLeftWidth: '4px', borderLeftColor: event.accountColorHex || '#3b82f6' }}
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <span
                                        className="px-2.5 py-0.5 rounded-md text-[10.5px] font-bold text-white shadow-2xs shrink-0 flex items-center gap-1.5"
                                        style={{ backgroundColor: event.accountColorHex || '#3b82f6' }}
                                    >
                                        <Video className="w-3 h-3" />
                                        <span>{event.accountName || 'Zoom'}</span>
                                    </span>
                                    {event.startTime && (
                                        <span className="text-xs font-mono font-bold text-foreground flex items-center gap-1.5 bg-muted/60 px-2 py-0.5 rounded-md">
                                            <Clock className="w-3 h-3 text-muted-foreground" />
                                            <span>{event.startTime}</span>
                                            {event.endTime && <span className="text-muted-foreground">&ndash; {event.endTime}</span>}
                                        </span>
                                    )}
                                </div>
                                <div className="text-xs font-bold text-foreground line-clamp-2 leading-relaxed group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                    {event.title}
                                </div>
                                {event.joinUrl && (
                                    <div className="flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 font-medium pt-0.5">
                                        <ExternalLink className="w-3 h-3" />
                                        <span>Link Zoom tersedia (klik untuk buka detail)</span>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>

                {/* Footer Quick Action */}
                {onNewBooking && (
                    <div className="p-3.5 border-t border-border/80 bg-muted/20 shrink-0 flex items-center justify-between gap-2">
                        <Button
                            size="sm"
                            variant="default"
                            onClick={() => {
                                onClose();
                                onNewBooking();
                            }}
                            className="w-full h-9 text-xs font-bold gap-2 rounded-xl bg-primary text-primary-foreground shadow-sm cursor-pointer hover:opacity-90"
                        >
                            <Plus className="w-4 h-4" />
                            <span>+ Book Meeting Baru di Tanggal Ini</span>
                        </Button>
                    </div>
                )}
            </div>
        </>
    );
}
