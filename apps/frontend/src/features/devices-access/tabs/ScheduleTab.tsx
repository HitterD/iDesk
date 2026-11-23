import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useScheduleWeek } from '../api';
import { groupWeek, mondayOf, techLoadClass } from '../rules';

const DAY_NAMES = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
const WEEK_DAYS = 7;
const DAY_MS = 86_400_000;
const WAITING = ['PROPOSED', 'PROPOSED_AWAITING_USER', 'RESCHEDULE_REQUESTED'];
const BAR_PERCENT_PER_INSTALL = 25;
const time = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const addDays = (isoDay: string, days: number): string => new Date(Date.parse(`${isoDay}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
const first = (name: string): string => name.split(' ')[0];

/** "Jadwal Pemasangan": the week of installs by day, filtered by technician, with each technician's load. */
export function ScheduleTab({ today }: { today: string }) {
    const [weekStart, setWeekStart] = useState(() => mondayOf(today));
    const [tech, setTech] = useState('');
    const { data, isLoading, isError } = useScheduleWeek(weekStart);
    const shown = (data?.events ?? []).filter((event) => !tech || event.technicianId === tech);
    const days = groupWeek(weekStart, shown);
    const waiting = (data?.events ?? []).filter((event) => WAITING.includes(event.status)).length;

    return (
        <div className="da-sched">
            <div className="da-sched__head">
                <button type="button" className="req-btn req-btn--ghost" aria-label="Minggu sebelumnya" onClick={() => setWeekStart(addDays(weekStart, -WEEK_DAYS))}><ChevronLeft aria-hidden="true" /></button>
                <b>{weekStart} – {addDays(weekStart, WEEK_DAYS - 1)}</b>
                <button type="button" className="req-btn req-btn--ghost" aria-label="Minggu berikutnya" onClick={() => setWeekStart(addDays(weekStart, WEEK_DAYS))}><ChevronRight aria-hidden="true" /></button>
                <span className="da-sched__chips">
                    <button type="button" className={tech === '' ? 'is-on' : ''} onClick={() => setTech('')}>Semua teknisi</button>
                    {(data?.load ?? []).map((t) => (
                        <button key={t.technicianId} type="button" className={tech === t.technicianId ? 'is-on' : ''} onClick={() => setTech(t.technicianId)}>{first(t.technicianName)}</button>
                    ))}
                </span>
            </div>
            {isLoading && <p aria-busy="true">Memuat…</p>}
            {isError && <p role="alert" className="req-dialog__error">Gagal memuat jadwal.</p>}
            {data && <p className="req-note">{shown.length} pemasangan minggu ini · {waiting} menunggu pemohon memilih</p>}
            <div className="da-week">
                {days.map((day, index) => (
                    <div key={day.date} className="da-day" data-testid="week-day">
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
            <section aria-label="Beban teknisi minggu ini" className="req-card">
                <h3>Beban teknisi minggu ini</h3>
                {(data?.load ?? []).map((t) => (
                    <div key={t.technicianId} className="da-bar">
                        <span>{first(t.technicianName)}</span>
                        <i className={techLoadClass(t.count)} style={{ width: `${Math.min(100, t.count * BAR_PERCENT_PER_INSTALL)}%` }} />
                        <b>{t.count}</b>
                    </div>
                ))}
            </section>
        </div>
    );
}
