import { useRef, useState } from 'react';
import { Download, FileSpreadsheet, Play } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { CsiHcApi } from '../../../../api/csiHc.api';
import { useCsiTemplateMutation, useCsiTemplates } from '../../../../hooks/useCsiHc';
import type { CsiTemplate } from '../../../../hcTypes';
import type { CsiScopeParam } from '../../../../types';
import { AdminSection, EmptyNote, MUTED_TEXT } from '../../AdminParts';
import { TemplateApplyDialog } from './TemplateApplyDialog';
import { TemplatePicCard } from './TemplatePicCard';

import { CSI_TEMPLATE_LOCATIONS } from '../hcFormat';

const locationName = (code: string) => CSI_TEMPLATE_LOCATIONS.find((location) => location.code === code)?.name ?? code;
const SERVICE_ORDER = ['HCD', 'HCC', 'HCS'];
const SERVICE_NAMES: Record<string, string> = { HCD: 'HC Development', HCC: 'HC Compensation & Benefit', HCS: 'HC Services' };

function ImportButton({ scope, location }: { scope: CsiScopeParam; location: string }) {
    const input = useRef<HTMLInputElement>(null);
    const importer = useCsiTemplateMutation(scope, async (file: File) => {
        const dry = await CsiHcApi.importTemplate(scope, location, file, { commit: false });
        if (dry.unresolved.length) {
            toast.error(`${dry.unresolved.length} nama PIC/tim belum dikenali. Perbaiki nama di Excel sebelum mengimpor.`);
            return;
        }
        const problems = dry.problems.length ? `\n${dry.problems.length} baris bermasalah (dilewati).` : '';
        if (!window.confirm(`${dry.pics.added.length} PIC/tim baru, ${dry.pics.changed.length} diperbarui, ${dry.raters.added} penilai baru.${problems}\nGabungkan ke template?`)) return;
        await CsiHcApi.importTemplate(scope, location, file, { commit: true });
        toast.success('Template diperbarui dari Excel.');
    });
    return (
        <>
            <input ref={input} type="file" accept=".xlsx" className="hidden" onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) importer.mutate(file);
                event.target.value = '';
            }} />
            <Button variant="soft" disabled={importer.isPending} onClick={() => input.current?.click()}>
                <FileSpreadsheet aria-hidden="true" />{importer.isPending ? 'Mengimpor…' : 'Impor Excel'}
            </Button>
        </>
    );
}

function TemplateEditor({ scope, template }: { scope: CsiScopeParam; template: CsiTemplate }) {
    const [applying, setApplying] = useState(false);
    const update = useCsiTemplateMutation(scope, ({ id, serviceFunction }: { id: string; serviceFunction: string | null }) => CsiHcApi.updateTemplatePic(scope, id, { serviceFunction }));
    const addRater = useCsiTemplateMutation(scope, ({ id, name }: { id: string; name: string }) => CsiHcApi.addTemplateRater(scope, id, { name }));
    const removeRater = useCsiTemplateMutation(scope, (raterId: string) => CsiHcApi.removeTemplateRater(scope, raterId));
    const removePic = useCsiTemplateMutation(scope, (picId: string) => CsiHcApi.removeTemplatePic(scope, picId));
    const pending = update.isPending || addRater.isPending || removeRater.isPending || removePic.isPending;
    const { summary } = template;
    return (
        <div className="grid gap-4">
            <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-[hsl(var(--muted)/.45)] p-4">
                <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-bold">{template.name}</p>
                    <p className={MUTED_TEXT}>
                        {`${summary.pics} PIC · ${summary.raters} pasangan penilai · ${summary.ratersOk} cocok, ${summary.ratersNoAccount} belum punya akun, ${summary.ratersAmbiguous} nama ganda · ${summary.picsWithoutRaters} PIC belum ada penilai`}
                    </p>
                </div>
                <ImportButton scope={scope} location={template.locationCode} />
                <Button variant="primary" onClick={() => setApplying(true)}><Play aria-hidden="true" />Gunakan template</Button>
            </div>
            {SERVICE_ORDER.map((code) => {
                const pics = template.pics.filter((pic) => pic.serviceCode === code);
                if (!pics.length) return null;
                return (
                    <section key={code} className="grid gap-2">
                        <h3 className="text-[14px] font-bold">{`${code} · ${SERVICE_NAMES[code]} (${pics.length})`}</h3>
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                            {pics.map((pic) => (
                                <TemplatePicCard key={pic.id} pic={pic} pending={pending}
                                    onServiceFunction={(serviceFunction) => update.mutate({ id: pic.id, serviceFunction })}
                                    onAddRater={(name) => addRater.mutate({ id: pic.id, name })}
                                    onRemoveRater={(raterId) => removeRater.mutate(raterId)}
                                    onRemovePic={() => window.confirm(`Hapus ${pic.picName} beserta penilainya dari template?`) && removePic.mutate(pic.id)} />
                            ))}
                        </div>
                    </section>
                );
            })}
            {applying && <TemplateApplyDialog scope={scope} template={template} open={applying} onOpenChange={setApplying} />}
        </div>
    );
}

/**
 * Pengaturan → Template penugasan: per-location lists of HC PICs, their service function and who rates them.
 * Edited here, then used to create a survey or synced (add-only) into one.
 */
export function TemplatesTab({ scope }: { scope: CsiScopeParam }) {
    const { data, isLoading } = useCsiTemplates(scope);
    const load = useCsiTemplateMutation(scope, (location: string) => CsiHcApi.loadBundledTemplate(scope, location));
    const [selected, setSelected] = useState<string | null>(null);
    const templates = data?.templates ?? [];
    const current = templates.find((row) => row.id === selected) ?? templates[0];
    return (
        <AdminSection title="Template penugasan per lokasi"
            description="Daftar PIC HC, fungsi pelayanan dan siapa yang menilai, per lokasi. Bisa diedit, ditambah, diimpor dari Excel, lalu dipakai untuk membuat survei.">
            <div className="grid gap-4">
                {isLoading && <div className="h-40 animate-pulse rounded-2xl bg-[hsl(var(--muted))]" aria-busy="true" />}
                <div className="flex flex-wrap items-center gap-2">
                    {templates.map((row) => (
                        <Button key={row.id} variant={row.id === current?.id ? 'primary' : 'soft'} onClick={() => setSelected(row.id)}>{locationName(row.locationCode)}</Button>
                    ))}
                    {(data?.bundledAvailable ?? []).map((code) => (
                        <Button key={code} variant="soft" disabled={load.isPending} onClick={() => load.mutate(code)}>
                            <Download aria-hidden="true" />{`Muat template ${locationName(code)}`}
                        </Button>
                    ))}
                </div>
                {!isLoading && !templates.length && <EmptyNote>Belum ada template. Muat template bawaan atau impor Excel.</EmptyNote>}
                {current && <TemplateEditor key={current.id} scope={scope} template={current} />}
            </div>
        </AdminSection>
    );
}
