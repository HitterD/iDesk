const DAY = 86400000;
export const daysSince = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / DAY);
export const agingTone = (days: number): 'none' | 'yellow' | 'red' =>
    days > 7 ? 'red' : days > 3 ? 'yellow' : 'none';
