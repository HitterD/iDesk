import { useState } from 'react';
import { AlertTriangle, FileSpreadsheet, Images, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/ErrorState';
import { TicketPill } from '@/components/ui/ticket-pill';
import { cn } from '@/lib/utils';
import { useAddCsiSubjectMembers, useCreateCsiTeam, useCsiSubjects } from '../../../hooks/useCsi';
import type { DraftUser } from '../../../lib/csiAdmin';
import { CSI_SCOPE_OF } from '../../../lib/csiAdmin';
import { siteTone, toneClasses } from '../../../lib/csiTone';
import type { CsiScopeParam, CsiSubjectGroup, CsiSubjectView } from '../../../types';
import { ADMIN_PANEL, MUTED_TEXT, UserMultiPicker } from '../AdminParts';
import { locationHint } from '../hc/hcFormat';
import { BulkPhotoDialog } from './BulkPhotoDialog';
import { CustomTeamSheet, type CustomTeamTarget } from './CustomTeamSheet';
import { SubjectCard } from './SubjectCard';
import { SubjectEditSheet, type SubjectEditTarget } from './SubjectEditSheet';

/** HC subjects come from any department, so its empty line does not name the ICT team. */
const EMPTY_PEOPLE: Readonly<Record<CsiScopeParam, string>> = {
    ict: 'Belum ada anggota ICT di site ini.',
    hc: 'Belum ada orang di site ini. Impor template lokasi ini di Template penugasan.',
};
const MEMBERS_HINT: Readonly<Record<CsiScopeParam, string>> = {
    ict: 'Anggota ICT diambil otomatis dari role ICT. Tambahkan orang lain bila perlu dinilai juga.',
    hc: 'Pilih anggota tim HC yang akan dinilai. Mereka dikelompokkan per site sesuai profil masing-masing.',
};

/** Adds people (any department) as subjects of the scope; HC has no staff roles, so this is how its team is built. */
function AddMembers({ scope }: { scope: CsiScopeParam }) {
    const add = useAddCsiSubjectMembers(scope);
    const [picked, setPicked] = useState<DraftUser[]>([]);
    return (
        <section aria-label="Tambah anggota" className={cn(ADMIN_PANEL, 'grid gap-3 p-4 sm:p-5')}>
            <div>
                <h2 className="text-[14px] font-semibold">Tambah anggota yang dinilai</h2>
                <p className={cn(MUTED_TEXT, 'text-[12.5px]')}>{MEMBERS_HINT[scope]}</p>
            </div>
            <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-[240px] flex-1">
                    <UserMultiPicker scope={scope} label="Pilih anggota" selected={picked} onChange={setPicked} />
                </div>
                <Button variant="primary" loading={add.isPending} disabled={!picked.length}
                    onClick={() => add.mutate({ userIds: picked.map((user) => user.id) }, { onSuccess: () => setPicked([]) })}>
                    <Plus aria-hidden="true" />Tambah anggota
                </Button>
            </div>
        </section>
    );
}

/** SITE team first, then HC custom teams (none for ICT), then people. */
const subjectsOf = (group: CsiSubjectGroup): CsiSubjectView[] => [...(group.team ? [group.team] : []), ...group.teams, ...group.people];

/**
 * HC header: people come from the location templates, so the main actions point there (import), at custom teams and
 * at bulk photos; the old member search stays reachable behind "tambah manual" as a fallback.
 */
function HcHeader({ onOpenTemplates, onNewTeam, onBulkPhotos }: { onOpenTemplates?: () => void; onNewTeam: () => void; onBulkPhotos: () => void }) {
    const [manual, setManual] = useState(false);
    return (
        <>
            <section aria-label="Orang yang dinilai" className={cn(ADMIN_PANEL, 'grid gap-3 p-4 sm:p-5')}>
                <div>
                    <h2 className="text-[14px] font-semibold">Orang yang dinilai</h2>
                    <p className={cn(MUTED_TEXT, 'text-[12.5px]')}>Diambil dari Template penugasan tiap lokasi. Tambah foto dan tagline di sini.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button variant="primary" onClick={onOpenTemplates} disabled={!onOpenTemplates}><FileSpreadsheet aria-hidden="true" />Impor Excel</Button>
                    <Button variant="soft" onClick={onNewTeam}><Plus aria-hidden="true" />Tim custom</Button>
                    <Button variant="soft" onClick={onBulkPhotos}><Images aria-hidden="true" />Unggah foto massal</Button>
                    {!manual && (
                        <button type="button" onClick={() => setManual(true)} className="ml-auto text-[12.5px] underline underline-offset-2 text-[hsl(var(--idesk-text-secondary))] hover:text-[hsl(var(--idesk-text))]">
                            tambah manual
                        </button>
                    )}
                </div>
            </section>
            {manual && <AddMembers scope="hc" />}
        </>
    );
}

function SiteHeader({ group, title, onAddTeam, adding }: { group: CsiSubjectGroup; title: string; onAddTeam: () => void; adding: boolean }) {
    const tone = toneClasses(siteTone(group.siteCode));
    const subjects = subjectsOf(group);
    const missing = subjects.filter((subject) => !subject.tagline).length;
    const teams = (group.team ? 1 : 0) + group.teams.length;
    return (
        <header className={cn('mb-3 flex flex-wrap items-center gap-3 rounded-[14px] px-3 py-2.5', tone.soft)}>
            <span aria-hidden="true" className={cn('grid h-[38px] w-[38px] flex-none place-items-center rounded-[10px] text-[11.5px] font-extrabold text-white', tone.fill)}>
                {group.siteCode}
            </span>
            <div className="min-w-0 flex-1">
                <h2 className="text-[13px] font-semibold">{title}</h2>
                <p className={cn(MUTED_TEXT, 'text-[12px]')}>{`${subjects.length} subjek · ${teams} tim · ${group.people.length} individu`}</p>
            </div>
            {missing > 0 && (
                <TicketPill tone="amber" className="inline-flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />{`${missing} belum ada tagline`}
                </TicketPill>
            )}
            {!group.team && (
                <Button variant="soft" size="sm" onClick={onAddTeam} loading={adding}><Plus aria-hidden="true" />Tambah tim</Button>
            )}
        </header>
    );
}

/** "HC Sukodono (SJA 3)": HC groups carry the SJA plant name of their site; ICT keeps the plain site name. */
function siteTitle(scope: CsiScopeParam, group: CsiSubjectGroup): string {
    const hint = scope === 'hc' ? locationHint(group.siteCode) : null;
    return `${CSI_SCOPE_OF[scope]} ${group.siteName}${hint ? ` (${hint})` : ''}`;
}

function SiteSection({ scope, group, onEdit, onEditTeam }: {
    scope: CsiScopeParam; group: CsiSubjectGroup; onEdit: (target: SubjectEditTarget) => void; onEditTeam: (target: CustomTeamTarget) => void;
}) {
    const createTeam = useCreateCsiTeam(scope);
    const title = siteTitle(scope, group);
    const subjects = subjectsOf(group);
    return (
        <section aria-label={title}>
            <SiteHeader group={group} title={title} adding={createTeam.isPending} onAddTeam={() => createTeam.mutate({ siteId: group.siteId })} />
            <div className="grid grid-cols-[repeat(auto-fill,minmax(min(230px,100%),1fr))] gap-3">
                {subjects.map((subject) => (
                    <SubjectCard key={subject.key} subject={subject} siteCode={group.siteCode}
                        onEdit={() => (subject.teamKind === 'CUSTOM' ? onEditTeam({ mode: 'edit', team: subject, siteId: group.siteId }) : onEdit({ subject, group }))} />
                ))}
            </div>
            {!group.people.length && !group.teams.length && <p className={cn(MUTED_TEXT, subjects.length && 'mt-3')}>{EMPTY_PEOPLE[scope]}</p>}
        </section>
    );
}

/** Admin tab "Subjek & foto": master photo, tagline and job title per subject, grouped per site. */
export function SubjectsTab({ scope, onOpenTemplates }: { scope: CsiScopeParam; onOpenTemplates?: () => void }) {
    const { data: groups, isLoading, isError, refetch } = useCsiSubjects(scope);
    const [target, setTarget] = useState<SubjectEditTarget | null>(null);
    const [teamTarget, setTeamTarget] = useState<CustomTeamTarget | null>(null);
    const [bulkOpen, setBulkOpen] = useState(false);
    const isHc = scope === 'hc';
    if (isLoading) return <div className={cn(ADMIN_PANEL, 'h-40 animate-pulse motion-reduce:animate-none')} aria-busy="true" aria-label="Memuat subjek" />;
    if (isError) return <ErrorState compact message="Gagal memuat subjek." onRetry={() => refetch()} />;
    if (!groups?.length) return <p className={cn(ADMIN_PANEL, MUTED_TEXT, 'px-6 py-10 text-center')}>Belum ada site untuk subjek CSI.</p>;
    return (
        <div className="space-y-6">
            {isHc
                ? <HcHeader onOpenTemplates={onOpenTemplates} onNewTeam={() => setTeamTarget({ mode: 'create' })} onBulkPhotos={() => setBulkOpen(true)} />
                : <AddMembers scope={scope} />}
            {groups.map((group) => <SiteSection key={group.siteId} scope={scope} group={group} onEdit={setTarget} onEditTeam={setTeamTarget} />)}
            <SubjectEditSheet scope={scope} scopeLabel={CSI_SCOPE_OF[scope]} target={target} onClose={() => setTarget(null)} />
            {isHc && (
                <>
                    <CustomTeamSheet scope={scope} groups={groups} target={teamTarget} onClose={() => setTeamTarget(null)}
                        onEditPhoto={(team) => {
                            const group = groups.find((item) => item.siteId === team.siteId);
                            setTeamTarget(null);
                            if (group) setTarget({ subject: team, group });
                        }} />
                    <BulkPhotoDialog scope={scope} groups={groups} open={bulkOpen} onOpenChange={setBulkOpen} />
                </>
            )}
        </div>
    );
}
