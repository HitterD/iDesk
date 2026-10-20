const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
export const MS_PER_MINUTE = 60_000;

export const formatSlaDuration = (ms: number): string => {
    const totalMinutes = Math.max(0, Math.floor(ms / MS_PER_MINUTE));
    const days = Math.floor(totalMinutes / (HOURS_PER_DAY * MINUTES_PER_HOUR));
    const hours = Math.floor((totalMinutes % (HOURS_PER_DAY * MINUTES_PER_HOUR)) / MINUTES_PER_HOUR);
    const minutes = totalMinutes % MINUTES_PER_HOUR;
    if (days > 0) return `${days}h ${hours}j`;
    if (hours > 0) return `${hours}j ${minutes}m`;
    return `${minutes}m`;
};
