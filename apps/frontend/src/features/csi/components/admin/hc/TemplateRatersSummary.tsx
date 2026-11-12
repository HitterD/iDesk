import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/ErrorState';
import { cn } from '@/lib/utils';
import { useCsiTemplates } from '../../../hooks/useCsiHc';
import { AdminSection, MUTED_TEXT } from '../AdminParts';
import { CSI_TEMPLATE_LOCATIONS } from './hcFormat';
import { templateRaterCounts } from './templates/templateRaterCounts';

function CountCells({ counts }: { counts: ReturnType<typeof templateRaterCounts> | null }) {
    return <>{(counts ? [counts.total, counts.confirmed, counts.ok, counts.ambiguous, counts.noAccount] : ['—', '—', '—', '—', '—'])
        .map((count, index) => <td key={index} className="px-3 py-3 text-right tabular-nums">{count}</td>)}</>;
}

/** HC raters are maintained only in assignment templates, not in a second editable registry. */
export function TemplateRatersSummary({ onFix }: { onFix?: (locationCode: string) => void }) {
    const { data, isLoading, isError, refetch } = useCsiTemplates('hc');
    const templates = data?.templates ?? [];
    return (
        <AdminSection title="Penilai dari Template penugasan"
            description="Penilai ditentukan di Template penugasan tiap lokasi. Perbaiki nama atau akun di sana.">
            {isLoading && <div aria-busy="true" className="h-32 animate-pulse rounded-xl bg-[hsl(var(--muted))]" />}
            {isError && <ErrorState compact onRetry={() => refetch()} />}
            {data && <div className="overflow-x-auto">
                <table className="w-full text-left text-[13px]">
                    <thead><tr>{['Lokasi', 'Penilai unik', 'Terkonfirmasi', 'Cocok otomatis', 'Nama ganda', 'Belum punya akun', 'Tindakan']
                        .map((label) => <th key={label} scope="col" className="px-3 py-2 font-semibold">{label}</th>)}</tr></thead>
                    <tbody>{CSI_TEMPLATE_LOCATIONS.map(({ code, name, hint }) => {
                        const matches = templates.filter((template) => template.locationCode === code);
                        const counts = matches.length ? templateRaterCounts(matches) : null;
                        const action = !counts ? 'Buat template' : counts.issues ? 'Perbaiki di template' : 'Lihat';
                        return <tr key={code} className="border-t border-[hsl(var(--idesk-border))]">
                            <td className="px-3 py-3 font-medium">{name}<span className={cn(MUTED_TEXT, 'block text-[12px] font-normal')}>{hint}</span></td><CountCells counts={counts} />
                            <td className="px-3 py-3"><Button variant="soft" disabled={!onFix} onClick={() => onFix?.(code)}>{action}</Button></td>
                        </tr>;
                    })}</tbody>
                    <tfoot><tr className="border-t border-[hsl(var(--idesk-border))] font-semibold">
                        <td className="px-3 py-3">Total</td><CountCells counts={templateRaterCounts(templates)} /><td />
                    </tr></tfoot>
                </table>
            </div>}
        </AdminSection>
    );
}
