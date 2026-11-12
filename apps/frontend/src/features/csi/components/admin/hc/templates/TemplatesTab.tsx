import { useState } from 'react';
import { FileSpreadsheet, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { cn } from '@/lib/utils';
import { CsiHcApi } from '../../../../api/csiHc.api';
import { useCsiTemplateMutation, useCsiTemplates } from '../../../../hooks/useCsiHc';
import type { CsiTemplate } from '../../../../hcTypes';
import type { CsiScopeParam } from '../../../../types';
import { AdminSection, MUTED_TEXT } from '../../AdminParts';
import { CSI_TEMPLATE_LOCATIONS } from '../hcFormat';
import { HcSurveyWizard } from './HcSurveyWizard';
import { TemplateApplyDialog } from './TemplateApplyDialog';
import { BlankTemplateButton, TemplateEmptyState, type TemplateLocation } from './TemplateEmptyState';
import { TemplateImportDialog } from './TemplateImportDialog';
import { TemplateIssuesPanel } from './TemplateIssuesPanel';
import { TemplatePicCard } from './TemplatePicCard';
import type { AddRaterBody } from './RaterRow';
import { RaterTableView } from './RaterTableView';

type TemplateView = 'pic' | 'rater';
const VIEW_OPTIONS = [{ value: 'pic', label: 'Per PIC' }, { value: 'rater', label: 'Per penilai' }] as const;

const SERVICE_ORDER = ['HCD', 'HCC', 'HCS'];
const SERVICE_NAMES: Record<string, string> = { HCD: 'HC Development', HCC: 'HC Compensation & Benefit', HCS: 'HC Services' };

const summaryItems = (summary: CsiTemplate['summary']) => [
    `${summary.pics} PIC`, `${summary.raters} penilai`, `${summary.ratersConfirmed} terkonfirmasi`, `${summary.ratersOk} cocok otomatis`,
    `${summary.ratersAmbiguous} nama ganda`, `${summary.ratersNoAccount} belum punya akun`,
];

function TemplateEditor({ scope, template, location, onImport, view, onViewChange }: {
    scope: CsiScopeParam; template: CsiTemplate; location: TemplateLocation; onImport: () => void;
    view: TemplateView; onViewChange: (view: TemplateView) => void;
}) {
    const [applying, setApplying] = useState(false);
    const [creating, setCreating] = useState(false);
    const update = useCsiTemplateMutation(scope, ({ id, serviceFunction }: { id: string; serviceFunction: string | null }) => CsiHcApi.updateTemplatePic(scope, id, { serviceFunction }));
    const addRater = useCsiTemplateMutation(scope, ({ id, body }: { id: string; body: AddRaterBody }) => CsiHcApi.addTemplateRater(scope, id, body));
    const removeRater = useCsiTemplateMutation(scope, (raterId: string) => CsiHcApi.removeTemplateRater(scope, raterId));
    const removePic = useCsiTemplateMutation(scope, (picId: string) => CsiHcApi.removeTemplatePic(scope, picId));
    const pending = update.isPending || addRater.isPending || removeRater.isPending || removePic.isPending;
    const { summary } = template;
    return (
        // @container: the PIC card grid takes its column count from this width (settings sidebar already subtracted).
        <div className="@container grid min-w-0 gap-4">
            {/* Title + summary take the full width; the controls wrap on their own row so the summary never becomes a narrow column. */}
            <div className="grid gap-3 rounded-2xl bg-[hsl(var(--muted)/.45)] p-4">
                <div className="grid min-w-0 gap-1.5">
                    <p className="text-[15px] font-bold">{template.name}</p>
                    <ul aria-label="Ringkasan template" className={cn(MUTED_TEXT, 'flex flex-wrap gap-x-3 gap-y-1')}>
                        {summaryItems(summary).map((item) => <li key={item}>{item}</li>)}
                    </ul>
                </div>
                {/* View switch left, actions grouped right; on a 15" laptop the action group wraps as one unit. */}
                <div className="flex flex-wrap items-center gap-2">
                    <SegmentedControl options={VIEW_OPTIONS} value={view} onValueChange={onViewChange} aria-label="Tampilan template" />
                    <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
                        <BlankTemplateButton scope={scope} location={location} variant="subtle" />
                        <Button variant="soft" onClick={onImport}><FileSpreadsheet aria-hidden="true" />Impor Excel</Button>
                        <Button variant="primary" onClick={() => setApplying(true)}><Play aria-hidden="true" />Gunakan template</Button>
                    </div>
                </div>
            </div>
            <TemplateIssuesPanel scope={scope} template={template} />
            {view === 'rater' && <RaterTableView scope={scope} template={template} />}
            {view === 'pic' && SERVICE_ORDER.map((code) => {
                const pics = template.pics.filter((pic) => pic.serviceCode === code);
                if (!pics.length) return null;
                return (
                    <section key={code} className="grid gap-2">
                        <h3 className="text-[14px] font-bold">{`${code} · ${SERVICE_NAMES[code]} (${pics.length})`}</h3>
                        {/* 2 columns from 560px, 3 only from 1180px: a third column below that squeezes the rater rows. */}
                        <div className="grid grid-cols-1 gap-3 @min-[560px]:grid-cols-2 @min-[1180px]:grid-cols-3">
                            {pics.map((pic) => (
                                <TemplatePicCard key={pic.id} scope={scope} templateId={template.id} pic={pic} pending={pending}
                                    onServiceFunction={(serviceFunction) => update.mutate({ id: pic.id, serviceFunction })}
                                    onAddRater={(body) => addRater.mutate({ id: pic.id, body })}
                                    onRemoveRater={(raterId) => removeRater.mutate(raterId)}
                                    onRemovePic={() => window.confirm(`Hapus ${pic.picName} beserta penilainya dari template?`) && removePic.mutate(pic.id)} />
                            ))}
                        </div>
                    </section>
                );
            })}
            {applying && <TemplateApplyDialog scope={scope} template={template} open={applying} onOpenChange={setApplying}
                onNewSurvey={() => { setApplying(false); setCreating(true); }} />}
            {creating && <HcSurveyWizard scope={scope} open={creating} onOpenChange={setCreating} initialLocation={template.locationCode} />}
        </div>
    );
}

/** Always the five template locations, in a fixed order, whether or not a template exists yet. */
function LocationTabs({ templates, selected, onSelect }: {
    /** null while loading: no badge rather than a wrong "kosong". */
    templates: CsiTemplate[] | null; selected: string; onSelect: (code: string) => void;
}) {
    return (
        <div role="tablist" aria-label="Lokasi template" className="flex flex-wrap items-center gap-2">
            {CSI_TEMPLATE_LOCATIONS.map(({ code, name, hint }) => {
                const template = templates?.find((row) => row.locationCode === code);
                const active = code === selected;
                return (
                    <button key={code} type="button" role="tab" aria-selected={active} onClick={() => onSelect(code)}
                        className={cn('idesk-btn', active ? 'is-primary' : 'is-soft')}>
                        {name}
                        <span className={cn('text-[11.5px] font-normal', active ? 'opacity-80' : MUTED_TEXT)}>{hint}</span>
                        {templates && (
                            <span className={cn('rounded-full px-1.5 text-[11.5px] font-semibold', active ? 'bg-white/20' : 'bg-[hsl(var(--muted))]')}>
                                {template ? `${template.summary.pics} PIC` : 'kosong'}
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}

/** Without a requested location: the first one with a template, else one with a bundled template, else the first. */
function defaultLocation(templates: CsiTemplate[], bundled: string[]): string {
    const has = (check: (code: string) => boolean) => CSI_TEMPLATE_LOCATIONS.find(({ code }) => check(code))?.code;
    return has((code) => templates.some((row) => row.locationCode === code)) ?? has((code) => bundled.includes(code)) ?? CSI_TEMPLATE_LOCATIONS[0].code;
}

/**
 * Pengaturan → Template penugasan: per-location lists of HC PICs, their service function and who rates them.
 * Edited here or imported from Excel (dry-run preview first), then used to create a survey or synced (add-only) into one.
 */
export function TemplatesTab({ scope, initialLocation, initialView }: {
    scope: CsiScopeParam; initialLocation?: string; initialView?: TemplateView;
}) {
    const { data, isLoading } = useCsiTemplates(scope);
    const [picked, setSelected] = useState<string | null>(initialLocation ?? null);
    const [importing, setImporting] = useState(false);
    const [view, setView] = useState<TemplateView>(initialView ?? 'pic');
    const templates = data?.templates ?? [];
    const selected = picked ?? defaultLocation(templates, data?.bundledAvailable ?? []);
    const location = CSI_TEMPLATE_LOCATIONS.find((row) => row.code === selected) ?? CSI_TEMPLATE_LOCATIONS[0];
    const current = templates.find((row) => row.locationCode === location.code);
    const openImport = () => setImporting(true);
    return (
        <AdminSection title="Template penugasan per lokasi"
            description="Daftar PIC HC, fungsi pelayanan dan siapa yang menilai, per lokasi. Bisa diedit, ditambah, diimpor dari Excel, lalu dipakai untuk membuat survei.">
            <div className="grid gap-4">
                <LocationTabs templates={data ? templates : null} selected={location.code} onSelect={setSelected} />
                {isLoading && <div className="h-40 animate-pulse rounded-2xl bg-[hsl(var(--muted))]" aria-busy="true" />}
                {!isLoading && !current && (
                    <TemplateEmptyState scope={scope} location={location} onImport={openImport}
                        bundled={(data?.bundledAvailable ?? []).includes(location.code)} />
                )}
                {current && <TemplateEditor key={current.id} scope={scope} template={current} location={location} onImport={openImport} view={view} onViewChange={setView} />}
                {importing && <TemplateImportDialog key={location.code} scope={scope} location={location} open={importing} onOpenChange={setImporting} />}
            </div>
        </AdminSection>
    );
}
