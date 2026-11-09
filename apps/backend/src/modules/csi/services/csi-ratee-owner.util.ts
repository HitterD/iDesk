/**
 * The account a rated person is: for an HC PIC ratee the account linked to the PIC now (the period snapshot keeps
 * whatever was linked when the survey was built, which is null when the account came later); else the snapshot.
 */
export function ratedAccountOf(ratee: { picId?: string | null; userId: string | null }, linkedByPic: ReadonlyMap<string, string | null>): string | null {
    const linked = ratee.picId ? linkedByPic.get(ratee.picId) : undefined;
    return linked ?? ratee.userId ?? null;
}
