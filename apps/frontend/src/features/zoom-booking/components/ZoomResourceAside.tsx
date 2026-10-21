import { format, parseISO, isToday, isTomorrow } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { Check, Keyboard, Settings } from 'lucide-react';
import { DashEmpty, DashPanel, cssVars } from '@/features/dashboard/components/DashboardParts';
import { cn } from '@/lib/utils';
import type { ZoomAccount, ZoomBooking } from '../types';
import { formatZoomAccountName } from '../utils';

const DEFAULT_COLOR = '#8E8E93';
const MAX_UPCOMING = 5;

const dayLabel = (dateStr: string) => {
    const date = parseISO(dateStr.split('T')[0]);
    if (isToday(date)) return 'Hari ini';
    if (isTomorrow(date)) return 'Besok';
    return format(date, 'EEE, d MMM', { locale: idLocale });
};

/** Mockup zoom.html aside: "Upcoming Meetings" (own upcoming bookings, NEXT on the first). */
export function ZoomUpcomingPanel({ bookings, accounts, onOpen }: { bookings: ZoomBooking[]; accounts: ZoomAccount[]; onOpen: (id: string) => void }) {
    const colorOf = (b: ZoomBooking) => accounts.find((a) => a.id === b.zoomAccountId)?.colorHex ?? b.zoomAccount?.colorHex ?? DEFAULT_COLOR;
    const nameOf = (b: ZoomBooking) => formatZoomAccountName(b.zoomAccount?.name ?? accounts.find((a) => a.id === b.zoomAccountId)?.name ?? 'Zoom');
    return (
        <DashPanel title="Upcoming Meetings">
            {bookings.length === 0 ? <DashEmpty>Belum ada meeting mendatang.</DashEmpty> : (
                <div className="dash-list">
                    {bookings.slice(0, MAX_UPCOMING).map((b, i) => (
                        <button key={b.id} type="button" className="dash-li" onClick={() => onOpen(b.id)}>
                            <span className="dash-pdot" style={cssVars({ '--c': colorOf(b) })} />
                            <div className="grow1">
                                <b>{b.title}</b>
                                <small>{dayLabel(b.bookingDate)} · {b.startTime.slice(0, 5).replace(':', '.')} · {nameOf(b)}</small>
                            </div>
                            {i === 0 && <span className="zm-next">NEXT</span>}
                        </button>
                    ))}
                </div>
            )}
        </DashPanel>
    );
}

interface AccountsPanelProps {
    accounts: ZoomAccount[];
    meetingsPerAccount: Map<string, number>;
    visibleAccountIds: Set<string>;
    accountScope: string;
    onToggleAccount: (id: string) => void;
    onShowOnly: (id: string) => void;
    onShowAll: () => void;
    onOpenShortcuts: () => void;
    onOpenSettings?: () => void;
}

/** Mockup "Akun Zoom" panel; doubles as the production account legend/filter (toggle, Hanya ini, semua). */
export function ZoomAccountsPanel({ accounts, meetingsPerAccount, visibleAccountIds, accountScope, onToggleAccount, onShowOnly, onShowAll, onOpenShortcuts, onOpenSettings }: AccountsPanelProps) {
    const merged = accountScope === 'gabungan';
    const isVisible = (id: string) => (merged ? visibleAccountIds.has(id) : accountScope === id);
    const allVisible = merged && accounts.every((a) => visibleAccountIds.has(a.id));
    return (
        <DashPanel title={(
            <>
                Akun Zoom
                <span className="ml-auto inline-flex gap-1">
                    <button type="button" className="res-icon-btn" onClick={onOpenShortcuts} aria-label="Keyboard shortcuts" title="Keyboard Shortcuts (?)"><Keyboard aria-hidden="true" /></button>
                    {onOpenSettings && <button type="button" className="res-icon-btn" onClick={onOpenSettings} aria-label="Pengaturan Zoom" title="Pengaturan Zoom"><Settings aria-hidden="true" /></button>}
                </span>
            </>
        )} label="Akun Zoom">
            {accounts.length === 0 ? <DashEmpty>Belum ada akun</DashEmpty> : (
                <div>
                    {accounts.map((a) => {
                        const on = isVisible(a.id);
                        return (
                            <div key={a.id} className={cn('zm-acc', !on && 'is-off')} style={cssVars({ '--c': a.colorHex || DEFAULT_COLOR })}>
                                <button type="button" role="checkbox" aria-checked={on} onClick={() => onToggleAccount(a.id)} title={on ? `Sembunyikan ${a.name}` : `Tampilkan ${a.name}`}>
                                    <span className={cn('zm-acc-box', on && 'is-on')} aria-hidden="true">{on && <Check />}</span>
                                    <div className="min-w-0">
                                        <b>{formatZoomAccountName(a.name)}</b>
                                        <small>{meetingsPerAccount.get(a.id) ?? 0} booking di periode ini</small>
                                    </div>
                                </button>
                                <button type="button" className="zm-only" onClick={() => onShowOnly(a.id)} aria-label={`Hanya ${a.name}`}>Hanya ini</button>
                            </div>
                        );
                    })}
                    {!allVisible && (
                        <button type="button" className="idesk-text-link mt-2" onClick={onShowAll}>Tampilkan semua akun</button>
                    )}
                </div>
            )}
        </DashPanel>
    );
}
