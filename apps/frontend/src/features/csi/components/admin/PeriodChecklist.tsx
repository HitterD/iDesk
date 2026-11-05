import { useState } from 'react';
import { Ban, Pencil, RotateCcw, Send, Trash2, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { cn } from '@/lib/utils';
import {
    useCancelCsiPeriod, useDeleteCsiPeriod, usePublishCsiPeriod, usePurgeCsiPeriod, useRestoreCsiPeriod, useUnpublishCsiPeriod,
} from '../../hooks/useCsi';
import { CSI_HTTP_CONFLICT, errorMessage, errorStatus } from '../../lib/csiForm';
import { toneClasses } from '../../lib/csiTone';
import { formatDateTime } from '../../lib/format';
import type { WizardStepKey } from '../../lib/wizard';
import type { CsiPeriodDetail, CsiScopeParam } from '../../types';
import { ReadinessList } from '../wizard/ReadinessList';
import { WIZARD_COPY } from '../wizard/wizardCopy';
import { AdminSection, LockedNote, MUTED_TEXT } from './AdminParts';
import { ConfirmByTitleDialog } from './ConfirmByTitleDialog';

type ActionProps = { scope: CsiScopeParam; period: CsiPeriodDetail };
const missingCount = (period: CsiPeriodDetail) => period.readiness.checks.filter((check) => !check.ok).length;

/** A draft without answers can simply be deleted (one confirm). */
function DeleteDraft({ scope, period, onDeleted }: ActionProps & { onDeleted: () => void }) {
    const [open, setOpen] = useState(false);
    const remove = useDeleteCsiPeriod(scope);
    return (
        <>
            <Button variant="subtle" onClick={() => setOpen(true)}><Trash2 aria-hidden="true" />Hapus draft</Button>
            <ConfirmationDialog isOpen={open} appearance="ticket" variant="destructive" title="Hapus draft survei?"
                description={`"${period.title}" beserta penugasannya akan dihapus. Belum ada jawaban yang masuk.`} confirmText="Hapus" cancelText="Batal"
                isLoading={remove.isPending} onCancel={() => setOpen(false)}
                onConfirm={() => remove.mutate(period.id, { onSuccess: () => { setOpen(false); onDeleted(); } })} />
        </>
    );
}

/** Stops a running or answered survey (answers kept). Retype the title + reason. */
function CancelSurvey({ scope, period, responses }: ActionProps & { responses: number }) {
    const [open, setOpen] = useState(false);
    const cancel = useCancelCsiPeriod(scope, period.id);
    const raters = period.respondentMode === 'LISTED' ? `${period.raters.length} penilai` : 'semua user di site';
    return (
        <>
            <Button variant="soft" className={toneClasses('red').ink} onClick={() => { cancel.reset(); setOpen(true); }}>
                <Ban aria-hidden="true" />Batalkan survei
            </Button>
            <ConfirmByTitleDialog open={open} onOpenChange={setOpen} title="Batalkan survei ini?" expectedTitle={period.title}
                confirmText="Ya, batalkan survei" pending={cancel.isPending} error={cancel.error}
                impact={(
                    <ul className="list-disc space-y-1 pl-5">
                        <li>{`Survei langsung hilang dari daftar ${raters}; yang belum mengisi tidak bisa mengisi lagi.`}</li>
                        <li>{responses ? `${responses} jawaban yang sudah masuk tetap disimpan dan laporannya masih bisa dibuka.` : 'Belum ada jawaban yang masuk.'}</li>
                        <li>Tidak dihitung di Dashboard, dan tanggalnya bisa dipakai survei lain.</li>
                        <li>Bisa diaktifkan lagi selama tanggal selesai belum lewat.</li>
                    </ul>
                )}
                onConfirm={(payload) => cancel.mutate(payload, { onSuccess: () => { setOpen(false); toast.success('Survei dibatalkan'); } })} />
        </>
    );
}

/** Second step after cancelling: delete the survey and every answer for good. */
function PurgeSurvey({ scope, period, responses, onDeleted }: ActionProps & { responses: number; onDeleted: () => void }) {
    const [open, setOpen] = useState(false);
    const purge = usePurgeCsiPeriod(scope, period.id);
    return (
        <>
            <Button variant="danger" onClick={() => { purge.reset(); setOpen(true); }}><Trash2 aria-hidden="true" />Hapus permanen</Button>
            <ConfirmByTitleDialog open={open} onOpenChange={setOpen} title="Hapus permanen survei ini?" expectedTitle={period.title}
                confirmText="Hapus permanen" pending={purge.isPending} error={purge.error}
                impact={<p>{`Survei dan ${responses} jawabannya dihapus dari database dan tidak bisa dikembalikan. Unduh Excel/PDF dulu bila masih perlu.`}</p>}
                onConfirm={(payload) => purge.mutate(payload, { onSuccess: () => { setOpen(false); toast.success('Survei dihapus permanen'); onDeleted(); } })} />
        </>
    );
}

function PublishButton({ scope, period }: ActionProps) {
    const publish = usePublishCsiPeriod(scope, period.id);
    const missing = missingCount(period);
    const clash = errorStatus(publish.error) === CSI_HTTP_CONFLICT ? errorMessage(publish.error) : null;
    return (
        <span className="grid justify-items-end gap-1">
            <Button variant="primary" loading={publish.isPending} disabled={missing > 0}
                onClick={() => publish.mutate(undefined, { onSuccess: () => toast.success(WIZARD_COPY.published) })}>
                <Send aria-hidden="true" />{WIZARD_COPY.publish}
            </Button>
            {missing > 0 && <span className={cn(MUTED_TEXT, 'text-[12px]')}>{`Lengkapi ${missing} syarat bertanda ✗ di atas`}</span>}
            {clash && <span role="alert" className={cn('max-w-md text-right text-[12.5px] font-medium', toneClasses('red').ink)}>{clash}</span>}
        </span>
    );
}

/** Back to draft (only before the first answer): respondents lose access until it is published again. */
function UnpublishButton({ scope, period }: ActionProps) {
    const [open, setOpen] = useState(false);
    const unpublish = useUnpublishCsiPeriod(scope, period.id);
    return (
        <>
            <Button variant="soft" onClick={() => setOpen(true)}><Undo2 aria-hidden="true" />{WIZARD_COPY.unpublish}</Button>
            <ConfirmationDialog isOpen={open} appearance="ticket" variant="warning" title="Tarik survei ke draft?"
                description="Survei akan hilang dari daftar responden sampai diterbitkan lagi. Belum ada jawaban yang masuk."
                confirmText="Tarik ke draft" cancelText="Batal" isLoading={unpublish.isPending} onCancel={() => setOpen(false)}
                onConfirm={() => unpublish.mutate(undefined, { onSuccess: () => { setOpen(false); toast.success(WIZARD_COPY.unpublished); } })} />
        </>
    );
}

function RestoreButton({ scope, period }: ActionProps) {
    const restore = useRestoreCsiPeriod(scope, period.id);
    const ended = period.status === 'ENDED';
    return (
        <span className="grid justify-items-end gap-1">
            <Button variant="primary" loading={restore.isPending} disabled={ended}
                onClick={() => restore.mutate(undefined, { onSuccess: () => toast.success('Survei aktif lagi') })}>
                <RotateCcw aria-hidden="true" />Aktifkan lagi
            </Button>
            {ended && <span className={cn(MUTED_TEXT, 'text-[12px]')}>Tanggal selesai sudah lewat, survei tidak bisa diaktifkan lagi.</span>}
        </span>
    );
}

function CancelledNote({ period }: { period: CsiPeriodDetail }) {
    const tone = toneClasses('red');
    return (
        <p role="note" className={cn('mb-4 rounded-xl px-3.5 py-2.5 text-[13px]', tone.soft, tone.ink)}>
            <b>Survei ini dibatalkan</b>
            {period.cancelledAt ? ` pada ${formatDateTime(period.cancelledAt)}` : ''}
            {period.cancelReason ? `. Alasan: ${period.cancelReason}` : ''}. Jawaban yang sudah masuk tetap tersimpan.
        </p>
    );
}

interface PeriodChecklistProps {
    scope: CsiScopeParam;
    period: CsiPeriodDetail;
    /** Answers received so far (shown in the cancel/purge confirmations). */
    responseCount?: number;
    onEditStep: (step: WizardStepKey) => void;
    onDeleted: () => void;
}

/** Detail "Syarat terbit" card: readiness, edit shortcuts into the wizard and the survey's lifecycle actions. */
export function PeriodChecklist({ scope, period, responseCount = 0, onEditStep, onDeleted }: PeriodChecklistProps) {
    const status = period.publishStatus;
    const cancelled = status === 'CANCELLED';
    return (
        <AdminSection title={WIZARD_COPY.readinessTitle} description="Syarat agar survei bisa terbit. Ubah membuka langkah wizard terkait."
            actions={!cancelled && (
                <Button variant="soft" onClick={() => onEditStep('info')}>
                    <Pencil aria-hidden="true" />{WIZARD_COPY.editInfo}
                </Button>
            )}>
            {cancelled && <CancelledNote period={period} />}
            <ReadinessList readiness={period.readiness} onEdit={onEditStep} locked={period.locked || cancelled} published={status !== 'DRAFT'} />
            <div className="mt-5 flex flex-wrap items-start justify-end gap-2">
                {period.locked && !cancelled && <LockedNote />}
                <span className="flex-1" />
                {status === 'DRAFT' && !period.locked && <DeleteDraft scope={scope} period={period} onDeleted={onDeleted} />}
                {(status === 'PUBLISHED' || (status === 'DRAFT' && period.locked)) && <CancelSurvey scope={scope} period={period} responses={responseCount} />}
                {cancelled && <PurgeSurvey scope={scope} period={period} responses={responseCount} onDeleted={onDeleted} />}
                {status === 'PUBLISHED' && !period.locked && <UnpublishButton scope={scope} period={period} />}
                {status === 'DRAFT' && <PublishButton scope={scope} period={period} />}
                {cancelled && <RestoreButton scope={scope} period={period} />}
            </div>
        </AdminSection>
    );
}
