import { ConflictException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { wibEndOfDate } from '../../../shared/core/utils/wib-date.util';
import { CsiPeriodPublishStatus } from '../csi.constants';
import { CsiPeriod } from '../entities/csi-period.entity';
import { CsiResponse } from '../entities/csi-response.entity';

export const LOCKED_MESSAGE = 'Periode sudah memiliki jawaban';

/**
 * Locks the period row (serialising with respondent submissions, which take the same lock)
 * and rejects with 409 once any response exists. Must run inside the caller's transaction.
 */
export async function lockUnlockedPeriod(manager: EntityManager, periodId: string) {
    await lockPeriodRow(manager, periodId);
    const responseCount = await manager.getRepository(CsiResponse).count({ where: { periodId } });
    if (responseCount > 0) throw new ConflictException(LOCKED_MESSAGE);
}

/**
 * Locks the period row and allows additive rater updates after answers exist, while still
 * blocking edits once the survey has ended or been cancelled. Must run inside the caller's transaction.
 */
export async function lockPeriodForRaterAdditions(
    manager: EntityManager,
    periodId: string,
    now: Date = new Date(),
): Promise<{ period: CsiPeriod | null; responseCount: number }> {
    const period = await lockPeriodRow(manager, periodId);
    const responseCount = await manager.getRepository(CsiResponse).count({ where: { periodId } });
    if (responseCount > 0) {
        const closed = !period
            || period.publishStatus === CsiPeriodPublishStatus.CANCELLED
            || now.getTime() > wibEndOfDate(period.endDate).getTime();
        if (closed) throw new ConflictException(LOCKED_MESSAGE);
    }
    return { period, responseCount };
}

/**
 * Row lock on the period. Admin assignment edits take FOR UPDATE (`pessimistic_write`);
 * respondent submits take FOR SHARE (`pessimistic_read`) so they don't serialise among themselves.
 */
export function lockPeriodRow(
    manager: EntityManager, periodId: string, mode: 'pessimistic_write' | 'pessimistic_read' = 'pessimistic_write',
) {
    return manager.getRepository(CsiPeriod).createQueryBuilder('p')
        .setLock(mode).where('p.id = :id', { id: periodId }).getOne();
}
