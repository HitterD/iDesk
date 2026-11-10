import { Download, FileDown, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { CsiHcApi } from '../../../../api/csiHc.api';
import { useBlankTemplateDownload, useCsiTemplateMutation } from '../../../../hooks/useCsiHc';
import { downloadBlob } from '../../../../lib/csiAdmin';
import type { CsiScopeParam } from '../../../../types';
import { MUTED_TEXT } from '../../AdminParts';

export interface TemplateLocation { code: string; name: string }

/** The download uses skipToast (blob body), so the failure toast is ours to show. */
const BLANK_DOWNLOAD_FAILED = 'Gagal mengunduh template kosong.';

/** Blank workbook for one location, saved as "CSI HC <Nama> - template.xlsx". */
export function BlankTemplateButton({ scope, location, variant = 'soft' }: {
    scope: CsiScopeParam; location: TemplateLocation; variant?: 'soft' | 'subtle';
}) {
    const download = useBlankTemplateDownload(scope);
    const run = () => download.mutate(location.code, {
        onSuccess: (blob) => downloadBlob(blob, `CSI HC ${location.name} - template.xlsx`),
        onError: () => toast.error(BLANK_DOWNLOAD_FAILED),
    });
    return (
        <Button variant={variant} disabled={download.isPending} onClick={run}>
            <FileDown aria-hidden="true" />{download.isPending ? 'Mengunduh…' : 'Unduh template kosong'}
        </Button>
    );
}

/**
 * A location without a template yet: start from Excel (blank workbook to fill in, then import) or, where the app
 * ships one, from the bundled template.
 */
export function TemplateEmptyState({ scope, location, bundled, onImport }: {
    scope: CsiScopeParam; location: TemplateLocation; bundled: boolean; onImport: () => void;
}) {
    const load = useCsiTemplateMutation(scope, (code: string) => CsiHcApi.loadBundledTemplate(scope, code));
    return (
        <div className="grid justify-items-center gap-3 rounded-2xl border border-dashed border-[hsl(var(--idesk-border))] px-4 py-10 text-center">
            <FileSpreadsheet className="h-8 w-8 text-[hsl(var(--idesk-text-secondary))]" aria-hidden="true" />
            <div>
                <p className="text-[15px] font-bold">{`Belum ada template ${location.name}`}</p>
                <p className={MUTED_TEXT}>Unduh template kosong, isi PIC dan penilainya, lalu impor kembali.</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
                <Button variant="primary" onClick={onImport}><FileSpreadsheet aria-hidden="true" />Impor Excel</Button>
                <BlankTemplateButton scope={scope} location={location} />
                {bundled && (
                    <Button variant="soft" disabled={load.isPending} onClick={() => load.mutate(location.code)}>
                        <Download aria-hidden="true" />Muat template bawaan
                    </Button>
                )}
            </div>
        </div>
    );
}
