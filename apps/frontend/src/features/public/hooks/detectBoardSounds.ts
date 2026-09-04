export type BoardSoundEvent = 'newTicket' | 'inProgress';
export type DivisionSoundKey = 'OPS_SUPPORT' | 'ORACLE_DEV' | 'WEB_DEV' | 'MOBILE_DEV';

export interface TicketSnapshotItem {
    id: string;
    division?: DivisionSoundKey;
}

export type SnapshotEntry = string | TicketSnapshotItem;

export interface BoardSnapshot {
    open: SnapshotEntry[];
    inProgress: SnapshotEntry[];
}

export interface DetectedSoundResult {
    event: BoardSoundEvent;
    division?: DivisionSoundKey;
}

function getItemId(entry: SnapshotEntry): string {
    return typeof entry === 'string' ? entry : entry.id;
}

function getItemDivision(entry: SnapshotEntry): DivisionSoundKey | undefined {
    return typeof entry === 'string' ? undefined : entry.division;
}

export function detectBoardSounds(
    prev: BoardSnapshot | null,
    next: BoardSnapshot,
): BoardSoundEvent[] {
    if (!prev) {
        return [];
    }

    const seen = new Set([...prev.open.map(getItemId), ...prev.inProgress.map(getItemId)]);
    const previouslyOpen = new Set(prev.open.map(getItemId));

    const events: BoardSoundEvent[] = [];
    if (next.open.some((entry) => !seen.has(getItemId(entry)))) {
        events.push('newTicket');
    }
    if (next.inProgress.some((entry) => previouslyOpen.has(getItemId(entry)))) {
        events.push('inProgress');
    }
    return events;
}

export function detectBoardSoundDetails(
    prev: BoardSnapshot | null,
    next: BoardSnapshot,
): DetectedSoundResult[] {
    if (!prev) {
        return [];
    }

    const seen = new Set([...prev.open.map(getItemId), ...prev.inProgress.map(getItemId)]);
    const previouslyOpen = new Set(prev.open.map(getItemId));

    const results: DetectedSoundResult[] = [];

    // Find all new open tickets and record their division
    for (const entry of next.open) {
        const id = getItemId(entry);
        if (!seen.has(id)) {
            results.push({
                event: 'newTicket',
                division: getItemDivision(entry) || 'OPS_SUPPORT',
            });
        }
    }

    // Check if any ticket moved from open to in progress
    if (next.inProgress.some((entry) => previouslyOpen.has(getItemId(entry)))) {
        results.push({ event: 'inProgress' });
    }

    return results;
}
