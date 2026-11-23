import { Link } from 'react-router-dom';
import { KeyRound } from 'lucide-react';

export interface ActiveAccess {
    eformId: string;
    ticketId: string;
    kind: string;
    startDate: string | null;
    endDate: string | null;
    group: 'soon' | 'expired' | 'active' | 'permanent';
    daysLeft: number | null;
}

const KIND_LABEL: Record<string, string> = {
    VPN: 'VPN', WEBSITE: 'Website', NETWORK: 'Network', FLASHDISK: 'Flashdisk', EMAIL: 'Email', SYNOLOGY_NAS: 'Synology NAS',
};
/** Renewal is offered from this many days before the end. */
const RENEW_WINDOW_DAYS = 30;
const SOON_DAYS = 7;

const day = new Intl.DateTimeFormat('id-ID', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' });
const dayOf = (value: string): string => day.format(new Date(`${value}T00:00:00Z`));

type Tone = 'amber' | 'green' | 'neutral';
function remaining(access: ActiveAccess): { text: string; tone: Tone } {
    if (access.daysLeft === null) return { text: 'Permanen', tone: 'neutral' };
    if (access.daysLeft === 0) return { text: 'Berakhir hari ini', tone: 'amber' };
    return { text: `Sisa ${access.daysLeft} hari`, tone: access.daysLeft <= SOON_DAYS ? 'amber' : 'green' };
}

interface ActiveAccessCardProps {
    access: ActiveAccess;
    /** Starts a renewal from the ticket that gave this access. */
    onRenew: (ticketId: string) => void;
}

/** One active access on "Tiket Saya": what it is, when it ends, and a renewal button when it is near its end. */
export function ActiveAccessCard({ access, onRenew }: ActiveAccessCardProps) {
    const { text, tone } = remaining(access);
    const label = KIND_LABEL[access.kind] ?? access.kind;
    const canRenew = access.daysLeft !== null && access.daysLeft <= RENEW_WINDOW_DAYS;
    return (
        <article className="req-access">
            <span className="req-access__icon"><KeyRound aria-hidden="true" /></span>
            <div className="req-access__main">
                <Link to={`/tickets/${access.ticketId}`}><b>Akses {label}</b></Link>
                <small>{access.endDate ? `Berlaku sampai ${dayOf(access.endDate)}` : 'Tanpa batas waktu'}</small>
            </div>
            <span className="req-access__left" data-tone={tone}>{text}</span>
            {canRenew && <button type="button" className="req-btn req-btn--efb req-btn--primary" onClick={() => onRenew(access.ticketId)}>Perpanjang</button>}
        </article>
    );
}
