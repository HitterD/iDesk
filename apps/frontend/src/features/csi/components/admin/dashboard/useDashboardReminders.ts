import { useState } from 'react';
import { toast } from 'sonner';
import { useSendCsiDashboardReminders } from '../../../hooks/useCsi';
import type { CsiDashboardPending, CsiReminderResult, CsiScopeParam } from '../../../types';
import { groupByPeriod, reminderKey } from './dashboardModel';

const reminderToast = ({ sent, skipped }: CsiReminderResult) =>
    `Pengingat terkirim ke ${sent} orang${skipped > 0 ? `, ${skipped} dilewati` : ''}`;

/**
 * Reminders across active periods: explicit user ids (an empty list would also hit raters who answered),
 * one call per period. Failures are toasted by the shared axios interceptor; those rows stay remindable.
 */
export function useDashboardReminders(scope: CsiScopeParam) {
    const send = useSendCsiDashboardReminders(scope);
    const [reminded, setReminded] = useState<ReadonlySet<string>>(new Set());
    const [busyKey, setBusyKey] = useState<string | null>(null);
    const [allBusy, setAllBusy] = useState(false);
    const markSent = (keys: readonly string[]) => setReminded((current) => new Set([...current, ...keys]));

    const remindOne = async (row: CsiDashboardPending) => {
        const key = reminderKey(row.periodId, row.userId);
        setBusyKey(key);
        try {
            await send.mutateAsync({ periodId: row.periodId, userIds: [row.userId] });
            markSent([key]);
        } catch {
            // Already reported by the interceptor; keep the row remindable.
        } finally {
            setBusyKey(null);
        }
    };

    const remindAll = async (rows: readonly CsiDashboardPending[]) => {
        setAllBusy(true);
        const groups = [...groupByPeriod(rows)];
        const results = await Promise.allSettled(groups.map(([periodId, userIds]) => send.mutateAsync({ periodId, userIds })));
        const total: CsiReminderResult = { sent: 0, skipped: 0 };
        results.forEach((result, index) => {
            if (result.status !== 'fulfilled') return;
            const [periodId, userIds] = groups[index];
            markSent(userIds.map((userId) => reminderKey(periodId, userId)));
            total.sent += result.value.sent;
            total.skipped += result.value.skipped;
        });
        setAllBusy(false);
        if (results.some((result) => result.status === 'fulfilled')) toast.success(reminderToast(total));
    };

    return { reminded, busyKey, allBusy, remindOne, remindAll };
}
