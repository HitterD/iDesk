export type BoardSoundEvent = 'newTicket' | 'inProgress';

export interface BoardSnapshot {
    open: string[];
    inProgress: string[];
}

export function detectBoardSounds(
    prev: BoardSnapshot | null,
    next: BoardSnapshot,
): BoardSoundEvent[] {
    if (!prev) {
        return [];
    }

    const seen = new Set([...prev.open, ...prev.inProgress]);
    const previouslyOpen = new Set(prev.open);

    const events: BoardSoundEvent[] = [];
    if (next.open.some((id) => !seen.has(id))) {
        events.push('newTicket');
    }
    if (next.inProgress.some((id) => previouslyOpen.has(id))) {
        events.push('inProgress');
    }
    return events;
}
