import { useState } from 'react';
import { Info, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { ErrorState } from '@/components/ui/ErrorState';
import { cn } from '@/lib/utils';
import { useAddCsiRaters, useCsiRaters, useRemoveCsiRater } from '../../hooks/useCsi';
import { CSI_MODE_LABELS, type DraftUser } from '../../lib/csiAdmin';
import type { CsiRater, CsiScopeParam } from '../../types';
import { ADMIN_PANEL, AdminSection, EmptyNote, MUTED_TEXT, UserMultiPicker } from './AdminParts';

export function RatersTab({ scope }: { scope: CsiScopeParam }) {
    const { data: raters, isLoading, isError, refetch } = useCsiRaters(scope);
    const add = useAddCsiRaters(scope);
    const remove = useRemoveCsiRater(scope);
    const [picked, setPicked] = useState<DraftUser[]>([]);
    const [removing, setRemoving] = useState<CsiRater | null>(null);
    const registered = new Set((raters ?? []).map((rater) => rater.userId));

    return (
        <div className="grid gap-4">
            <p role="note" className={cn(MUTED_TEXT, 'flex items-start gap-2 rounded-2xl bg-[hsl(var(--idesk-sapphire)/.07)] px-4 py-3')}>
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--idesk-sapphire))]" aria-hidden="true" />
                {`Daftar penilai dipakai oleh periode dengan mode "${CSI_MODE_LABELS.LISTED}". Pilih penilai per periode di pengaturan periode.`}
            </p>
            <AdminSection title="Tambah penilai">
                <div className="flex flex-wrap items-start gap-3">
                    <div className="min-w-[240px] flex-1">
                        <UserMultiPicker scope={scope} label="Pilih penilai" selected={picked} onChange={setPicked} excludeIds={registered} />
                    </div>
                    <Button variant="primary" loading={add.isPending} disabled={!picked.length}
                        onClick={() => add.mutate({ userIds: picked.map((user) => user.id) }, { onSuccess: () => setPicked([]) })}>
                        Tambahkan
                    </Button>
                </div>
            </AdminSection>
            <section aria-label="Daftar penilai" className={cn(ADMIN_PANEL, 'overflow-hidden')}>
                {isLoading && <div className="h-32 animate-pulse bg-[hsl(var(--muted)/.5)] motion-reduce:animate-none" aria-busy="true" />}
                {isError && <div className="p-5"><ErrorState compact onRetry={() => refetch()} /></div>}
                {raters && !raters.length && <div className="p-5"><EmptyNote>Belum ada penilai terdaftar.</EmptyNote></div>}
                {raters && raters.length > 0 && (
                    <ul className="divide-y divide-[hsl(var(--idesk-border)/.55)]">
                        {raters.map((rater) => (
                            <li key={rater.id} className="flex items-center gap-3 px-5 py-3.5">
                                <span className="min-w-0 flex-1">
                                    <span className="block text-[14px] font-medium">{rater.user.fullName}</span>
                                    <span className={cn(MUTED_TEXT, 'block text-[12.5px]')}>
                                        {[rater.user.jobTitle, rater.user.site?.code, rater.user.email].filter(Boolean).join(' · ')}
                                    </span>
                                </span>
                                <Button variant="subtle" size="icon" aria-label={`Hapus ${rater.user.fullName}`} onClick={() => setRemoving(rater)}>
                                    <Trash2 aria-hidden="true" />
                                </Button>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
            <ConfirmationDialog isOpen={!!removing} appearance="ticket" variant="destructive" title="Hapus penilai?"
                description={`${removing?.user.fullName ?? ''} dihapus dari daftar penilai. Periode yang sudah memasangnya tidak berubah.`}
                confirmText="Hapus" cancelText="Batal" isLoading={remove.isPending} onCancel={() => setRemoving(null)}
                onConfirm={() => removing && remove.mutate(removing.id, { onSuccess: () => setRemoving(null) })} />
        </div>
    );
}
