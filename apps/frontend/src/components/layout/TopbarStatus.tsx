import React, { useEffect, useState } from 'react';
import { useAuth } from '@/stores/useAuth';
import { firstName, wibGreeting } from '@/features/dashboard/agent/agentDashboard.format';

const MINUTE_MS = 60_000;
const WIB_DAY = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', weekday: 'long', day: 'numeric', month: 'short' });
const WIB_TIME = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

/** Re-renders on each wall-clock minute (aligned, so the shown time never lags by up to a minute). */
function useMinuteClock(): Date {
    const [now, setNow] = useState(() => new Date());
    useEffect(() => {
        let interval: number | undefined;
        const align = window.setTimeout(() => {
            setNow(new Date());
            interval = window.setInterval(() => setNow(new Date()), MINUTE_MS);
        }, MINUTE_MS - (Date.now() % MINUTE_MS));
        return () => { window.clearTimeout(align); window.clearInterval(interval); };
    }, []);
    return now;
}

/** Left of the topbar: who and when. WIB, because every SLA in the app is read in WIB. */
export const TopbarGreeting: React.FC = () => {
    const { user } = useAuth();
    const name = user?.fullName;
    const now = useMinuteClock();
    return (
        <div className="topbar-greeting" aria-live="off">
            <b>{wibGreeting(now)}{name ? `, ${firstName(name)}` : ''}</b>
            <span><time dateTime={now.toISOString()}>{WIB_DAY.format(now)} · {WIB_TIME.format(now)} WIB</time></span>
        </div>
    );
};
