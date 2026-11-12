import { useState } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ErrorState } from '@/components/ui/ErrorState';
import { cn } from '@/lib/utils';
import { useDeleteCustomTeam, useTeamDeleteImpact } from '../../../hooks/useCsiHc';
import { errorMessage } from '../../../lib/csiForm';
import { toneClasses } from '../../../lib/csiTone';
import type { CsiScopeParam, CsiTeamDeleteImpact } from '../../../types';
import { MUTED_TEXT } from '../AdminParts';

const DELETE_FAILED = 'Gagal menghapus tim. Silakan coba lagi.';
const BLOCK_REASON: Record<CsiTeamDeleteImpact['blocked'][number]['reason'], string> = {
    running: 'sedang berjalan',
    answered: 'sudah ada jawaban',
};

function SurveyList({ label, items }: { label: string; items: Array<{ periodId: string; title: string; note?: string }> }) {
    return (
        <ul aria-label={label} className="grid max-h-40 gap-1 overflow-y-auto">
            {items.map((item) => (
                <li key={item.periodId} className="flex items-baseline gap-2 rounded-lg bg-[hsl(var(--muted)/.5)] px-2.5 py-1.5 text-[13px]">
                    <span className="min-w-0 flex-1 truncate" title={item.title}>{item.title}</span>
                    {item.note && <span className={cn(MUTED_TEXT, 'shrink-0 text-[12px]')}>{item.note}</span>}
                </li>
            ))}
        </ul>
    );
}

function ImpactBody({ impact }: { impact: CsiTeamDeleteImpact }) {
    if (impact.blocked.length) {
        return (
            <div className="grid gap-2">
                <p className={cn('text-[13px] font-medium', toneClasses('red').ink)}>
                    Tim tidak bisa dihapus karena dipakai di survei yang sedang berjalan atau sudah ada jawaban:
                </p>
                <SurveyList label="Survei yang menahan penghapusan" items={impact.blocked.map((survey) => ({ ...survey, note: BLOCK_REASON[survey.reason] }))} />
            </div>
        );
    }
    const drafts = impact.draftSurveys;
    return (
        <div className="grid gap-2 text-[13px]">
            <p>Baris tim ini di Template penugasan beserta penilainya ikut terhapus.</p>
            {drafts.length > 0 && (
                <>
                    <p>{`Tim ini juga dikeluarkan dari ${drafts.length} survei draft:`}</p>
                    <SurveyList label="Survei draft yang terdampak" items={drafts} />
                </>
            )}
            {impact.finishedSurveys > 0 && (
                <p className={MUTED_TEXT}>{`Hasil ${impact.finishedSurveys} survei yang sudah selesai atau dibatalkan tetap tersimpan; tim dinonaktifkan, bukan dihapus.`}</p>
            )}
        </div>
    );
}

/**
 * Confirmation for deleting a SITE or CUSTOM team. Asks the backend for the impact first: blocking surveys disable the
 * delete; draft surveys the team leaves are listed. Closes and calls `onDeleted` once the delete succeeds.
 */
export function TeamDeleteDialog({ scope, team, onClose, onDeleted }: {
    scope: CsiScopeParam; team: { teamId: string; name: string } | null; onClose: () => void; onDeleted: () => void;
}) {
    const impact = useTeamDeleteImpact(scope, team?.teamId ?? null);
    const remove = useDeleteCustomTeam(scope);
    const [error, setError] = useState<string | null>(null);
    const close = () => { if (remove.isPending) return; setError(null); onClose(); };
    const confirm = async () => {
        if (!team) return;
        setError(null);
        try {
            await remove.mutateAsync(team.teamId);
            onDeleted();
        } catch (failure) {
            setError(errorMessage(failure) ?? DELETE_FAILED);
        }
    };
    const blocked = !!impact.data?.blocked.length;
    return (
        <Dialog open={!!team} onOpenChange={(open) => { if (!open) close(); }}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <AlertTriangle className={cn('h-5 w-5', toneClasses('red').ink)} aria-hidden="true" />{`Hapus ${team?.name ?? 'tim'}?`}
                    </DialogTitle>
                    <DialogDescription>Periksa survei yang memakai tim ini sebelum menghapus.</DialogDescription>
                </DialogHeader>
                {impact.isLoading && <p role="status" className={MUTED_TEXT}>Memeriksa survei yang memakai tim ini…</p>}
                {impact.isError && <ErrorState compact message="Gagal memeriksa survei yang memakai tim ini." onRetry={() => impact.refetch()} />}
                {impact.data && <ImpactBody impact={impact.data} />}
                {error && <p role="alert" className={cn('text-[12.5px] font-medium', toneClasses('red').ink)}>{error}</p>}
                <DialogFooter className="gap-2">
                    <Button variant="subtle" onClick={close} disabled={remove.isPending}>Batal</Button>
                    <Button variant="danger" loading={remove.isPending} disabled={!impact.data || blocked} onClick={() => void confirm()}>
                        <Trash2 aria-hidden="true" />Hapus tim
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
