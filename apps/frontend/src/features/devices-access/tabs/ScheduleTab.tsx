import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, ChevronLeft, ChevronRight, Hourglass, Inbox, RefreshCw, User, Users } from 'lucide-react';
import { useAuth } from '@/stores/useAuth';
import { useScheduleWeek } from '../api';
import { Kpi } from '../Kpi';
import { groupWeek, mondayOf, techLoadClass } from '../rules';

const DAY_NAMES = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
const SUNDAY_INDEX = 6;
const WEEK_DAYS = 7;
const DAY_MS = 86_400_000;
const WAITING = ['PROPOSED', 'PROPOSED_AWAITING_USER', 'RESCHEDULE_REQUESTED'];
const BAR_PERCENT_PER_INSTALL = 25;
const time = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const range = new Intl.DateTimeFormat('id-ID', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' });
const dayOnly = new Intl.DateTimeFormat('id-ID', { timeZone: 'UTC', day: 'numeric' });
const addDays = (isoDay: string, days: number): string => new Date(Date.parse(`${isoDay}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
const asDate = (isoDay: string): Date => new Date(`${isoDay}T00:00:00Z`);
const first = (name: string): string => name.split(' ')[0];
const wibDay = (iso: string): string => new Date(Date.parse(iso) + 7 * 3_600_000).toISOString().slice(0, 10);

/** "Jadwal Pemasangan" (mockup ticket-unify `centerSched`): KPIs, the week by day, and IT's queue, own day and load on the side. */
export function ScheduleTab({ today }: { today: string }) {
    const { user } = useAuth();
    const [weekStart, setWeekStart] = useState(() => mondayOf(today));
    const [tech, setTech] = useState('');
    const { data, isLoading, isError } = useScheduleWeek(weekStart);
    const currentWeek = mondayOf(today);
    const { data: todayWeek } = useScheduleWeek(currentWeek, weekStart !== currentWeek);
    const events = data?.events ?? [];
    const shown = events.filter((event) => !tech || event.technicianId === tech);
    const days = groupWeek(weekStart, shown);
    const waiting = events.filter((event) => WAITING.includes(event.status)).length;
    const queue = data?.unscheduled ?? [];
    const mine = (weekStart === currentWeek ? events : todayWeek?.events ?? []).filter((event) => event.technicianId === user?.id && event.start && wibDay(event.start) === today);
    const weekEnd = addDays(weekStart, WEEK_DAYS - 1);

    return (
        <div className="da-sched">
            <div className="da-kpis">
                <Kpi icon={CalendarDays} tone="navy" label="Minggu ini" value={events.length} />
                <Kpi icon={Inbox} tone="amber" label="Belum dijadwalkan" value={queue.length} />
                <Kpi icon={Hourglass} tone="sky" label="Menunggu pemohon pilih" value={waiting} />
                <Kpi icon={RefreshCw} tone="red" label="Jadwal ulang" value={data?.rescheduleRequested ?? 0} />
            </div>
            {isError && <p role="alert" className="req-dialog__error">Gagal memuat jadwal.</p>}
            <div className="da-cgrid">
                <section className="da-card da-cpad" aria-label="Kalender pemasangan">
                    <div className="da-chead">
                        <div className="da-chead__nav">
                            <button type="button" className="da-iconbtn" aria-label="Minggu sebelumnya" onClick={() => setWeekStart(addDays(weekStart, -WEEK_DAYS))}><ChevronLeft aria-hidden="true" /></button>
                            <b>{dayOnly.format(asDate(weekStart))} – {range.format(asDate(weekEnd))}</b>
                            <button type="button" className="da-iconbtn" aria-label="Minggu berikutnya" onClick={() => setWeekStart(addDays(weekStart, WEEK_DAYS))}><ChevronRight aria-hidden="true" /></button>
                        </div>
                        <span className="da-chips">
                            <button type="button" className={tech === '' ? 'is-on' : ''} onClick={() => setTech('')}>Semua teknisi</button>
                            {(data?.load ?? []).map((t) => (
                                <button key={t.technicianId} type="button" className={tech === t.technicianId ? 'is-on' : ''} onClick={() => setTech(t.technicianId)}>{first(t.technicianName)}</button>
                            ))}
                        </span>
                    </div>
                    {isLoading && <p aria-busy="true" className="da-muted">Memuat…</p>}
                    <div className="da-week">
                        {days.map((day, index) => (
                            <div key={day.date} className={`da-day${index === SUNDAY_INDEX ? ' is-off' : ''}`} data-testid="week-day">
                                <div className="da-day__h"><b>{DAY_NAMES[index]}</b><span>{Number(day.date.slice(8))}</span></div>
                                {day.events.map((event) => (
                                    <Link key={event.scheduleId} to={`/tickets/${event.ticketId}`} className="da-ev" data-state={WAITING.includes(event.status) ? 'wait' : 'ok'}>
                                        <b>{event.start ? time.format(new Date(event.start)) : '-'}</b>
                                        <span>{event.title}</span>
                                        <small>{first(event.technicianName)} · {WAITING.includes(event.status) ? 'Menunggu pilih' : 'Terjadwal'}</small>
                                    </Link>
                                ))}
                            </div>
                        ))}
                    </div>
                </section>
                <div className="da-cside">
                    <section className="da-card da-cpad" aria-label="Perlu dijadwalkan">
                        <b className="da-cs-h"><Inbox aria-hidden="true" />Perlu dijadwalkan</b>
                        {queue.length === 0 && <p className="da-muted">Tidak ada antrean.</p>}
                        {queue.map((item) => (
                            <Link key={item.ticketId} to={`/tickets/${item.ticketId}`} className="da-qrow">
                                <span className="da-mono">#{item.ticketNumber}</span>
                                <b>{item.title}</b>
                                <span className="da-muted">{item.requesterName || 'Pemohon'} · barang siap</span>
                            </Link>
                        ))}
                    </section>
                    <section className="da-card da-cpad" aria-label="Jadwal saya hari ini">
                        <b className="da-cs-h"><User aria-hidden="true" />Jadwal saya hari ini</b>
                        {mine.length === 0 && <p className="da-muted">Tidak ada pemasangan hari ini.</p>}
                        {mine.map((event) => (
                            <Link key={event.scheduleId} to={`/tickets/${event.ticketId}`} className="da-qrow">
                                <span className="da-mono">{event.start ? time.format(new Date(event.start)) : '-'}</span><b>{event.title}</b>
                            </Link>
                        ))}
                    </section>
                    <section className="da-card da-cpad" aria-label="Beban teknisi minggu ini">
                        <b className="da-cs-h"><Users aria-hidden="true" />Beban teknisi minggu ini</b>
                        {(data?.load ?? []).length === 0 && <p className="da-muted">Belum ada pemasangan minggu ini.</p>}
                        {(data?.load ?? []).map((t) => (
                            <div key={t.technicianId} className="da-bar">
                                <span>{first(t.technicianName)}</span>
                                <i className={techLoadClass(t.count)} style={{ ['--w' as string]: `${Math.min(100, t.count * BAR_PERCENT_PER_INSTALL)}%` }} />
                                <b>{t.count}</b>
                            </div>
                        ))}
                    </section>
                </div>
            </div>
        </div>
    );
}
