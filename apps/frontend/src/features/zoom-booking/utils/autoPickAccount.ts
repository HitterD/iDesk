export interface AccountLoad {
    id: string;
    name: string;
    colorHex: string;
    meetingsAtTime: number;
}

export function autoPickAccount(
    accounts: AccountLoad[],
    _time: string,
): AccountLoad | null {
    if (accounts.length === 0) return null;
    const sorted = [...accounts].sort((a, b) => {
        if (a.meetingsAtTime !== b.meetingsAtTime) {
            return a.meetingsAtTime - b.meetingsAtTime;
        }
        return a.id.localeCompare(b.id);
    });
    return sorted[0];
}
