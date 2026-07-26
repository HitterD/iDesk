const pad = (value: number) => String(value).padStart(2, '0');

export function toDateKey(date: Date): string {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function shouldPlayClosing(
    now: Date,
    closingTime: string | null,
    lastPlayedDate: string | null,
): boolean {
    if (!closingTime) {
        return false;
    }
    const current = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    if (current !== closingTime) {
        return false;
    }
    return lastPlayedDate !== toDateKey(now);
}
