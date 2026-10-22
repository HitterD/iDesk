/** Shared System Health formatting + status vocabulary (moved out of SystemHealthPage, logic unchanged). */

const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'];
const KILO = 1024;
const SECONDS_PER_DAY = 86400;
const SECONDS_PER_HOUR = 3600;
const SECONDS_PER_MINUTE = 60;

/** Bytes to a human label with NaN / undefined protection. */
export const formatBytes = (bytes?: number): string => {
    if (bytes === undefined || bytes === null || isNaN(bytes) || bytes <= 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(KILO));
    return parseFloat((bytes / Math.pow(KILO, i)).toFixed(2)) + ' ' + (BYTE_UNITS[i] || 'B');
};

/** Uptime with padded seconds (`1d 2h 3m 08s`). */
export const formatUptime = (seconds: number = 0): string => {
    const secNum = Math.max(0, Math.floor(seconds));
    const days = Math.floor(secNum / SECONDS_PER_DAY);
    const hours = Math.floor((secNum % SECONDS_PER_DAY) / SECONDS_PER_HOUR);
    const minutes = Math.floor((secNum % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
    const secs = Math.floor(secNum % SECONDS_PER_MINUTE).toString().padStart(2, '0');
    if (days > 0) return `${days}d ${hours}h ${minutes}m ${secs}s`;
    if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
    return `${minutes}m ${secs}s`;
};

/** Relative time in Indonesian (`baru saja`, `5 dtk lalu`, `3 mnt lalu`). */
export const formatRelativeTime = (timestamp?: string): string => {
    if (!timestamp) return '-';
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return '-';
    const diffSecs = Math.floor(Math.max(0, Date.now() - date.getTime()) / 1000);
    if (diffSecs < 5) return 'baru saja';
    if (diffSecs < SECONDS_PER_MINUTE) return `${diffSecs} dtk lalu`;
    if (diffSecs < SECONDS_PER_HOUR) return `${Math.floor(diffSecs / SECONDS_PER_MINUTE)} mnt lalu`;
    if (diffSecs < SECONDS_PER_DAY) return `${Math.floor(diffSecs / SECONDS_PER_HOUR)} jam lalu`;
    return `${Math.floor(diffSecs / SECONDS_PER_DAY)} hari lalu`;
};

export type HealthStatusKey = 'operational' | 'degraded' | 'down' | 'connected' | 'disconnected' | 'disabled' | 'error';

/** Mockup bubble hues (`OK` / `DEG` / down / off) as CSS colour + ink. */
export const STATUS_TONE: Readonly<Record<HealthStatusKey, { label: string; color: string; ink: string }>> = {
    operational: { label: 'Operational', color: 'var(--dash-green)', ink: 'var(--dash-ink-green)' },
    connected: { label: 'Connected', color: 'var(--dash-green)', ink: 'var(--dash-ink-green)' },
    degraded: { label: 'Degraded', color: 'var(--dash-orange)', ink: 'var(--dash-ink-orange)' },
    down: { label: 'Down', color: 'var(--dash-red)', ink: 'var(--dash-ink-red)' },
    disconnected: { label: 'Disconnected', color: 'var(--dash-red)', ink: 'var(--dash-ink-red)' },
    error: { label: 'Error', color: 'var(--dash-red)', ink: 'var(--dash-ink-red)' },
    disabled: { label: 'Disabled', color: 'var(--dash-gray)', ink: 'hsl(var(--idesk-text-secondary))' },
};

export const statusTone = (status: string | undefined) => STATUS_TONE[(status as HealthStatusKey) ?? 'down'] ?? STATUS_TONE.down;

/** Meter hue: the card's own colour until it crosses warn / critical. */
export const meterColor = (value: number, base: string, warnAt: number, critAt: number): string =>
    value > critAt ? 'var(--dash-red)' : value > warnAt ? 'var(--dash-orange)' : base;
