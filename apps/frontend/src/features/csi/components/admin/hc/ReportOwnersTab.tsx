import { useCsiReportOwners, useSetCsiReportOwners } from '../../../hooks/useCsiHc';
import type { CsiScopeParam } from '../../../types';
import type { CsiServiceReportOwners } from '../../../hcTypes';
import { AdminSection, MUTED_TEXT, UserMultiPicker } from '../AdminParts';

const SERVICE_NAMES: Record<string, string> = { HCC: 'HC Compensation & Benefit', HCD: 'HC Development', HCS: 'HC Services' };

function ServiceOwners({ scope, row, onSave, pending }: {
    scope: CsiScopeParam; row: CsiServiceReportOwners; onSave: (userIds: string[]) => void; pending: boolean;
}) {
    const selected = row.users.map((user) => ({ id: user.id, fullName: user.fullName, jobTitle: null }));
    return (
        <section aria-label={`${row.serviceCode} · ${SERVICE_NAMES[row.serviceCode] ?? ''}`} className="grid gap-2 rounded-2xl bg-[hsl(var(--muted)/.45)] p-4">
            <h3 className="text-[14px] font-bold">{`${row.serviceCode} · ${SERVICE_NAMES[row.serviceCode] ?? ''}`}</h3>
            <p className={MUTED_TEXT}>{row.users.length ? `${row.users.length} penanggung jawab` : 'Belum ada penanggung jawab.'}</p>
            <UserMultiPicker scope={scope} label={`Pilih penanggung jawab ${row.serviceCode}`} selected={selected} disabled={pending}
                onChange={(users) => onSave(users.map((user) => user.id))} />
        </section>
    );
}

/**
 * Pengaturan → Penanggung jawab report: accounts that may open the report of one HC service (all locations) from the
 * user menu. They see who rated which PIC except for ratings about themselves; the combined report stays admin-only.
 */
export function ReportOwnersTab({ scope }: { scope: CsiScopeParam }) {
    const { data: rows = [], isLoading } = useCsiReportOwners(scope);
    const save = useSetCsiReportOwners(scope);
    return (
        <AdminSection title="Penanggung jawab report per layanan"
            description="Mereka membuka report layanannya (semua lokasi) lewat menu Survei → Report layanan. Penilaian tentang diri sendiri tetap anonim.">
            {isLoading && <div className="h-40 animate-pulse rounded-2xl bg-[hsl(var(--muted))]" aria-busy="true" />}
            <div className="grid gap-3 lg:grid-cols-3">
                {rows.map((row) => (
                    <ServiceOwners key={row.serviceCode} scope={scope} row={row} pending={save.isPending}
                        onSave={(userIds) => save.mutate({ serviceCode: row.serviceCode, userIds })} />
                ))}
            </div>
        </AdminSection>
    );
}
