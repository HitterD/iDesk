import { useState } from 'react';
import { Check, CircleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCsiDepartments, useCsiDimensions, useCsiRaters, useCsiSubjects } from '../../hooks/useCsi';
import { toneClasses } from '../../lib/csiTone';
import type { CsiScopeParam } from '../../types';
import { ADMIN_PANEL } from './AdminParts';
import { DepartmentsTab } from './DepartmentsTab';
import { DimensionsTab } from './DimensionsTab';
import { RatersTab } from './RatersTab';
import { SubjectsTab } from './subjects/SubjectsTab';
import { PicsTab } from './hc/PicsTab';
import { ReportOwnersTab } from './hc/ReportOwnersTab';
import { CSI_SERVICE_NAMES } from '../../lib/services';
import { TemplatesTab } from './hc/templates/TemplatesTab';
import { templateRaterCounts } from './hc/templates/templateRaterCounts';
import { useCsiPics, useCsiReportOwners, useCsiTemplates } from '../../hooks/useCsiHc';

export type SettingsSection = 'subjects' | 'pics' | 'templates' | 'report-owners' | 'questions' | 'raters' | 'departments';

interface SectionStatus { key: SettingsSection; label: string; hint: string; done: boolean; description: string }

/** Setup status shown in the rail (and counted on the Pengaturan tab): what is still missing, in plain words. */
export function useSettingsStatus(scope: CsiScopeParam): SectionStatus[] {
    const { data: groups = [] } = useCsiSubjects(scope);
    const { data: questions = [] } = useCsiDimensions(scope);
    const { data: raters = [] } = useCsiRaters(scope);
    const { data: departments = [] } = useCsiDepartments(scope);
    const { data: pics = [] } = useCsiPics(scope);
    const { data: owners = [] } = useCsiReportOwners(scope);
    const { data: templateList } = useCsiTemplates(scope, scope === 'hc');
    const templateCount = templateList?.templates.length ?? 0;
    const templateRaters = templateRaterCounts(templateList?.templates ?? []);
    const people = groups.flatMap((group) => [...(group.team ? [group.team] : []), ...group.people]);
    const noPhoto = people.filter((subject) => !subject.photoUrl).length;
    const raterSites = new Set(raters.map((rater) => rater.user.site?.code).filter(Boolean));
    const sitesWithoutRaters = groups.filter((group) => group.people.length > 0 && !raterSites.has(group.siteCode)).map((group) => group.siteCode);
    const hcPics: SectionStatus[] = scope === 'hc' ? [{
        key: 'pics', label: 'PIC HC', done: pics.length > 0,
        hint: pics.length ? `${pics.length} PIC` : 'belum ada',
        description: 'Staf HCC, HCD dan HCS per layanan dan bagian, diimpor dari Data Hirarki Approver.',
    }, {
        key: 'templates', label: 'Template penugasan', done: templateCount > 0,
        hint: `${templateCount} lokasi${templateRaters.issues ? ` · ${templateRaters.issues} perlu dicek` : ''}`,
        description: 'Siapa menilai siapa per lokasi (mis. Semarang), lengkap dengan fungsi pelayanan PIC.',
    }] : [];
    // Both scopes: HC per layanan (HCC / HCD / HCS), ICT per handling team.
    const reportOwners: SectionStatus = {
        key: 'report-owners', label: 'Penanggung jawab report', done: owners.length > 0 && owners.every((row) => row.users.length > 0),
        hint: `${owners.filter((row) => row.users.length > 0).length}/${owners.length || Object.keys(CSI_SERVICE_NAMES[scope]).length} ${scope === 'hc' ? 'layanan' : 'tim'}`,
        description: scope === 'hc'
            ? 'Siapa yang boleh membuka report CSI per layanan (HCC / HCD / HCS) untuk semua lokasi.'
            : 'Siapa yang boleh membuka report CSI per tim (Operational Support, Oracle, Web, Mobile, Manager) untuk semua lokasi.',
    };
    return [
        ...hcPics,
        reportOwners,
        {
            key: 'subjects', label: 'Orang & foto', done: people.length > 0 && noPhoto === 0,
            hint: !people.length ? 'belum ada' : noPhoto ? `${noPhoto} tanpa foto` : `${people.length} subjek`,
            description: 'Siapa saja yang bisa dinilai: tim per site dan anggotanya, lengkap dengan foto dan tagline.',
        },
        {
            key: 'questions', label: 'Pertanyaan', done: questions.length > 0,
            hint: questions.length ? `${questions.length} aktif` : 'belum ada',
            description: 'Bank pertanyaan yang bisa dipasang ke tim dan orang di setiap survei.',
        },
        {
            key: 'raters', label: 'Penilai',
            done: scope === 'hc' ? templateCount > 0 && templateRaters.issues === 0 : raters.length > 0 && !sitesWithoutRaters.length,
            hint: scope === 'hc'
                ? !templateCount ? 'belum ada template' : templateRaters.issues ? `${templateRaters.issues} perlu dicek` : `${templateRaters.total} orang`
                : !raters.length ? 'belum ada' : sitesWithoutRaters.length ? `${sitesWithoutRaters.join(', ')} kosong` : `${raters.length} orang`,
            description: scope === 'hc' ? 'Penilai ditentukan di Template penugasan tiap lokasi.' : 'Orang yang boleh mengisi survei dengan mode "Hanya penilai terdaftar".',
        },
        {
            key: 'departments', label: 'Departemen', done: departments.length > 0,
            hint: departments.length ? `${departments.length} aktif` : 'belum ada',
            description: 'Pilihan departemen responden (sekali dipilih, terkunci untuk akun itu).',
        },
    ];
}

function Body({ scope, section, onSection, templateFocus, onFix }: {
    scope: CsiScopeParam; section: SettingsSection; onSection: (section: SettingsSection) => void;
    templateFocus?: string; onFix: (locationCode: string) => void;
}) {
    switch (section) {
        case 'questions': return <DimensionsTab scope={scope} />;
        case 'raters': return <RatersTab scope={scope} onFix={onFix} />;
        case 'departments': return <DepartmentsTab scope={scope} />;
        case 'pics': return <PicsTab scope={scope} />;
        case 'report-owners': return <ReportOwnersTab scope={scope} />;
        case 'templates': return <TemplatesTab scope={scope} initialLocation={templateFocus} initialView={templateFocus ? 'rater' : undefined} />;
        default: return <SubjectsTab scope={scope} onOpenTemplates={scope === 'hc' ? () => onSection('templates') : undefined} />;
    }
}

/**
 * "Pengaturan": everything set up once and reused by every survey, as numbered sections with their status
 * (replaces the separate "Subjek & foto" and "Master data" tabs).
 */
export function SettingsPanel({ scope, initial }: { scope: CsiScopeParam; initial?: SettingsSection }) {
    const [section, setSection] = useState<SettingsSection>(initial ?? (scope === 'hc' ? 'pics' : 'subjects'));
    const [templateFocus, setTemplateFocus] = useState<string>();
    const openTemplate = (locationCode: string) => { setTemplateFocus(locationCode); setSection('templates'); };
    const status = useSettingsStatus(scope);
    const current = status.find((row) => row.key === section)!;
    return (
        <div className="grid items-start gap-4 lg:grid-cols-[230px_minmax(0,1fr)]">
            <nav aria-label="Bagian pengaturan" className={cn(ADMIN_PANEL, 'grid gap-1 p-2 lg:sticky lg:top-4')}>
                {status.map((row, index) => {
                    const tone = toneClasses(row.done ? 'green' : 'amber');
                    return (
                        <button key={row.key} type="button" onClick={() => setSection(row.key)} aria-current={row.key === section ? 'step' : undefined}
                            className={cn('flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                row.key === section ? 'bg-[hsl(var(--idesk-sapphire)/.1)] text-[hsl(var(--idesk-sapphire))]' : 'hover:bg-[hsl(var(--muted)/.6)]')}>
                            <span aria-hidden="true" className={cn('grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11.5px]', tone.soft, tone.ink)}>
                                {row.done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : index + 1}
                            </span>
                            <span className="min-w-0 flex-1">{row.label}</span>
                            <span className={cn('shrink-0 text-[11.5px] font-medium', row.done ? 'text-[hsl(var(--idesk-text-secondary))]' : tone.ink)}>{row.hint}</span>
                        </button>
                    );
                })}
            </nav>
            <div className="grid min-w-0 gap-4">
                <header className="flex items-start gap-2">
                    {!current.done && <CircleAlert className={cn('mt-0.5 h-4 w-4 shrink-0', toneClasses('amber').ink)} aria-hidden="true" />}
                    <div>
                        <h2 className="text-[16px] font-semibold">{current.label}</h2>
                        <p className="text-[13px] text-[hsl(var(--idesk-text-secondary))]">{current.description}</p>
                    </div>
                </header>
                <Body scope={scope} section={section} onSection={setSection} templateFocus={templateFocus} onFix={openTemplate} />
            </div>
        </div>
    );
}
