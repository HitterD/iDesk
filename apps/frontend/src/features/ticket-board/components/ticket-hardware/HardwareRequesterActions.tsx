import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarCheck, CheckCircle2, MessageSquareWarning } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { scheduleAsk, type TicketHardwareRequest } from './hardwareFlow';
import { useRequesterSteps } from './useTicketHardware';

const DAY = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', weekday: 'long', day: 'numeric', month: 'long' });
const TIME = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

/** "Senin, 27 Oktober · 10.00–11.00 WIB" */
export const slotLabel = (start: string, end?: string | null) =>
    `${DAY.format(new Date(start))} · ${TIME.format(new Date(start))}${end ? `–${TIME.format(new Date(end))}` : ''} WIB`;

/**
 * What the requester answers about a running hardware request, inside the ticket: pick or confirm the installation
 * time, then say whether the device works. Anything else (asking for another time) stays on the request page.
 */
export const HardwareRequesterActions: React.FC<{ request: TicketHardwareRequest; ticketId: string; href: string }> = ({ request, ticketId, href }) => {
    const { pickSlot, confirmSchedule, confirmInstallation } = useRequesterSteps(ticketId);
    const [slot, setSlot] = useState<number | null>(null);
    const [reporting, setReporting] = useState(false);
    const [issue, setIssue] = useState('');
    const ask = scheduleAsk(request);
    const schedule = request.schedule;

    if (ask === 'pick' && schedule) {
        return (
            <section className="thw-ask" aria-label="Pilih jadwal pemasangan">
                <p className="thw-ask-q"><CalendarCheck aria-hidden="true" />Pilih jadwal pemasangan yang cocok</p>
                <div className="thw-slots" role="radiogroup" aria-label="Pilihan jadwal">
                    {schedule.slots.map((option, index) => (
                        <button key={option.start} type="button" role="radio" aria-checked={slot === index}
                            className={cn('thw-slot', slot === index && 'is-on')} onClick={() => setSlot(index)}>
                            {slotLabel(option.start, option.end)}
                        </button>
                    ))}
                </div>
                <div className="thw-ask-foot">
                    <Link to={href} className="thw-ask-link">Tidak ada yang cocok? Minta jadwal lain</Link>
                    <Button type="button" variant="primary" disabled={slot === null} loading={pickSlot.isPending}
                        onClick={() => slot !== null && pickSlot.mutate({ requestId: request.id, scheduleId: schedule.id, slotIndex: slot })}>
                        Pilih jadwal ini
                    </Button>
                </div>
            </section>
        );
    }

    if (ask === 'confirm' && schedule?.start) {
        return (
            <section className="thw-ask" aria-label="Konfirmasi jadwal pemasangan">
                <p className="thw-ask-q"><CalendarCheck aria-hidden="true" />Tim IT mengusulkan pemasangan <b>{slotLabel(schedule.start, schedule.end)}</b></p>
                <div className="thw-ask-foot">
                    <Link to={href} className="thw-ask-link">Minta jadwal lain</Link>
                    <Button type="button" variant="primary" loading={confirmSchedule.isPending} onClick={() => confirmSchedule.mutate(request.id)}>
                        Setujui jadwal
                    </Button>
                </div>
            </section>
        );
    }

    if (request.status === 'AWAITING_USER_CONFIRMATION') {
        const busy = confirmInstallation.isPending;
        return (
            <section className="thw-ask" aria-label="Konfirmasi hasil pemasangan">
                <p className="thw-ask-q"><CheckCircle2 aria-hidden="true" />Perangkat sudah terpasang. Apakah sudah berfungsi?</p>
                {reporting ? (<>
                    <textarea className="thw-ask-text" rows={2} value={issue} onChange={(e) => setIssue(e.target.value)} autoFocus
                        aria-label="Masalah yang ditemukan" placeholder="Ceritakan masalahnya, mis. monitor tidak menyala" />
                    <div className="thw-ask-foot">
                        <Button type="button" variant="soft" onClick={() => setReporting(false)} disabled={busy}>Batal</Button>
                        <Button type="button" variant="danger" disabled={!issue.trim()} loading={busy}
                            onClick={() => confirmInstallation.mutate({ requestId: request.id, ok: false, comments: issue.trim() })}>
                            Kirim laporan
                        </Button>
                    </div>
                </>) : (
                    <div className="thw-ask-foot">
                        <Button type="button" variant="soft" onClick={() => setReporting(true)} disabled={busy}>
                            <MessageSquareWarning aria-hidden="true" />Ada masalah
                        </Button>
                        <Button type="button" variant="primary" loading={busy}
                            onClick={() => confirmInstallation.mutate({ requestId: request.id, ok: true })}>
                            Ya, sudah berfungsi
                        </Button>
                    </div>
                )}
            </section>
        );
    }

    return null;
};
