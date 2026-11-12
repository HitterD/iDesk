import { EntityManager } from 'typeorm';
import { CsiRateeKind } from '../csi.constants';
import { CsiPeriodRatee } from '../entities/csi-period-ratee.entity';
import { CsiPeriod } from '../entities/csi-period.entity';
import { CsiResponse } from '../entities/csi-response.entity';

/**
 * After ratees are written (template apply / sync, PICs or a team picked by hand): turns on "Penilaian per orang" when
 * the survey has a PERSON ratee and "Penilaian tim" when it has a TEAM ratee, so nobody picked is silently hidden from
 * the raters. Only switches on, never off. A survey with answers keeps its sections (they are frozen then).
 * Must run inside the writer's transaction, after the ratee rows are saved.
 */
export async function enableSectionsWithRatees(manager: EntityManager, periodId: string): Promise<void> {
    const period = await manager.getRepository(CsiPeriod).findOne({ where: { id: periodId } });
    if (!period || (period.teamEnabled && period.individualEnabled)) return;
    if (await manager.getRepository(CsiResponse).count({ where: { periodId } }) > 0) return;
    const ratees = manager.getRepository(CsiPeriodRatee);
    const hasKind = async (kind: CsiRateeKind) => (await ratees.count({ where: { periodId, kind } })) > 0;
    const patch: Partial<Pick<CsiPeriod, 'teamEnabled' | 'individualEnabled'>> = {};
    if (!period.individualEnabled && await hasKind(CsiRateeKind.PERSON)) patch.individualEnabled = true;
    if (!period.teamEnabled && await hasKind(CsiRateeKind.TEAM)) patch.teamEnabled = true;
    if (Object.keys(patch).length) await manager.getRepository(CsiPeriod).update({ id: periodId }, patch);
}
