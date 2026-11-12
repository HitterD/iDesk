import { EntityManager } from 'typeorm';
import { CsiRateeKind } from '../csi.constants';
import { CsiPeriod } from '../entities/csi-period.entity';
import { CsiResponse } from '../entities/csi-response.entity';

/**
 * After ratees are ADDED (template apply / sync, PICs or a site team picked by hand): turns on "Penilaian per orang"
 * when PERSON ratees were added and "Penilaian tim" when TEAM ratees were added, so nobody just picked is silently
 * hidden from the raters. Only the kinds the caller wrote count: a section the admin switched off stays off when the
 * other kind is saved or a sync adds nothing of its kind. Only switches on, never off; a survey with answers keeps its
 * sections (they are frozen then). Must run inside the writer's transaction.
 */
export async function enableSectionsWithRatees(manager: EntityManager, periodId: string, addedKinds: readonly CsiRateeKind[]): Promise<void> {
    if (!addedKinds.length) return;
    const period = await manager.getRepository(CsiPeriod).findOne({ where: { id: periodId } });
    if (!period) return;
    const patch: Partial<Pick<CsiPeriod, 'teamEnabled' | 'individualEnabled'>> = {
        ...(!period.individualEnabled && addedKinds.includes(CsiRateeKind.PERSON) ? { individualEnabled: true } : {}),
        ...(!period.teamEnabled && addedKinds.includes(CsiRateeKind.TEAM) ? { teamEnabled: true } : {}),
    };
    if (!Object.keys(patch).length) return;
    if (await manager.getRepository(CsiResponse).count({ where: { periodId } }) > 0) return;
    await manager.getRepository(CsiPeriod).update({ id: periodId }, patch);
}

export type CsiReadinessWarningKey = 'teamHidden' | 'peopleHidden';
export type CsiReadinessWarning = { key: CsiReadinessWarningKey; label: string };

/** Ratees of a disabled section stay in the period but never reach the raters: say how many (non-blocking). */
export function hiddenRateeWarnings(input: {
    ratees: unknown[]; teamEnabled: boolean; individualEnabled: boolean; teamRateeCount?: number; hcSubjectCount?: number;
}): CsiReadinessWarning[] {
    const teams = input.teamRateeCount ?? 0;
    const people = input.ratees.length;
    const noun = input.hcSubjectCount === undefined ? 'orang' : 'PIC';
    return [
        ...(!input.teamEnabled && teams > 0 ? [{ key: 'teamHidden' as const, label: `${teams} tim tidak akan tampil karena Penilaian tim dimatikan` }] : []),
        ...(!input.individualEnabled && people > 0 ? [{ key: 'peopleHidden' as const, label: `${people} ${noun} tidak akan tampil karena Penilaian per orang dimatikan` }] : []),
    ];
}
