import { Bell, BellRing } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toneClasses } from '../../../lib/csiTone';
import { formatDateTime } from '../../../lib/format';
import type { CsiDashboard, CsiDashboardPending, CsiScopeParam } from '../../../types';
import { RateeAvatar } from '../../respond/RateeAvatar';
import { AdminSection, MUTED_TEXT } from '../AdminParts';
import { SiteBadge } from '../report/reportParts';
import { reminderKey, siteCodes } from './dashboardModel';
import { useDashboardReminders } from './useDashboardReminders';

export const LIST_ITEM = 'flex min-w-0 items-center gap-2.5 border-b border-[hsl(var(--idesk-border))] py-2.5 last:border-b-0';
const SENT_PILL = 'inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[12px] font-medium';

function PendingRow({ row, siteCode, sent, busy, onRemind }: {
    row: CsiDashboardPending; siteCode: string | null; sent: boolean; busy: boolean; onRemind: () => void;
}) {
    return (
        <li className={LIST_ITEM}>
            <RateeAvatar name={row.fullName} avatarUrl={null} size="sm" />
            <span className="min-w-0 flex-1">
                <b className="block truncate text-[13.5px] font-semibold">{row.fullName}</b>
                {row.department && <span className={cn(MUTED_TEXT, 'block truncate text-[12px]')}>{row.department}</span>}
            </span>
            <SiteBadge code={siteCode} />
            {sent ? (
                <span className={cn(SENT_PILL, toneClasses('sky').soft, toneClasses('sky').ink)}>Terkirim</span>
            ) : (
                <Button variant="soft" size="sm" onClick={onRemind} loading={busy} aria-label={`Ingatkan ${row.fullName}`}>
                    {!busy && <Bell aria-hidden="true" />}
                </Button>
            )}
        </li>
    );
}

/** "Belum mengisi — paling mendesak": earliest-ending period first (server order), one reminder per row or all at once. */
export function PendingPanel({ scope, data, className }: { scope: CsiScopeParam; data: CsiDashboard; className?: string }) {
    const reminders = useDashboardReminders(scope);
    const codes = siteCodes(data);
    const open = data.pending.filter((row) => !reminders.reminded.has(reminderKey(row.periodId, row.userId)));
    const remindAll = open.length > 0 && (
        <Button variant="soft" size="sm" onClick={() => reminders.remindAll(open)} loading={reminders.allBusy}>
            {!reminders.allBusy && <BellRing aria-hidden="true" />}Ingatkan semua
        </Button>
    );
    return (
        <AdminSection title="Belum mengisi — paling mendesak" actions={remindAll || undefined} className={className}>
            {data.pending.length === 0 ? <p className={MUTED_TEXT}>Semua penilai terdaftar sudah mengisi.</p> : (
                <ul aria-label="Penilai yang belum mengisi">
                    {data.pending.map((row) => {
                        const key = reminderKey(row.periodId, row.userId);
                        return (
                            <PendingRow key={key} row={row} siteCode={row.siteId ? codes.get(row.siteId) ?? null : null}
                                sent={reminders.reminded.has(key)} busy={reminders.busyKey === key} onRemind={() => reminders.remindOne(row)} />
                        );
                    })}
                </ul>
            )}
        </AdminSection>
    );
}

export function CommentsPanel({ data, className }: { data: CsiDashboard; className?: string }) {
    const codes = siteCodes(data);
    return (
        <AdminSection title="Komentar terbaru" className={className}>
            {data.comments.length === 0 ? <p className={MUTED_TEXT}>Belum ada komentar.</p> : (
                <ul aria-label="Komentar terbaru">
                    {data.comments.map((comment, index) => (
                        <li key={`${comment.createdAt}:${index}`} className={cn(LIST_ITEM, 'items-start')}>
                            <RateeAvatar name={comment.subjectName} avatarUrl={null} size="sm" />
                            <span className="min-w-0 flex-1">
                                <span className="block break-words text-[13.5px]">{`"${comment.text}"`}</span>
                                <span className={cn(MUTED_TEXT, 'block text-[12px]')}>{`untuk ${comment.subjectName} · ${formatDateTime(comment.createdAt)}`}</span>
                            </span>
                            <SiteBadge code={comment.siteId ? codes.get(comment.siteId) ?? null : null} />
                        </li>
                    ))}
                </ul>
            )}
        </AdminSection>
    );
}
