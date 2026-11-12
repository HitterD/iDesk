import { useId, useState } from 'react';
import { Camera, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useDebounce } from '@/hooks/useDebounce';
import { cn } from '@/lib/utils';
import { useCsiUserSearch } from '../../../hooks/useCsi';
import { useCreateCustomTeam, useSetCustomTeamMembers, useUpdateCustomTeam } from '../../../hooks/useCsiHc';
import type { AccountSuggestion } from '../../../hcTypes';
import { errorMessage } from '../../../lib/csiForm';
import { toneClasses } from '../../../lib/csiTone';
import { CSI_SERVICE_NAMES } from '../../../lib/services';
import type { CsiScopeParam, CsiSubjectGroup, CsiSubjectView, CsiTeamMemberInput, CsiUserSearchResult } from '../../../types';
import { FIELD_LABEL, MUTED_TEXT } from '../AdminParts';
import { ACCOUNT_SEARCH_DEBOUNCE_MS, AccountCombobox } from '../hc/templates/AccountCombobox';
import { TeamDeleteDialog } from './TeamDeleteDialog';

const FIELD = 'h-9 w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--idesk-surface))] px-3 text-[13px] disabled:opacity-60';
const MIN_SEARCH = 2;
const SAVE_FAILED = 'Gagal menyimpan tim. Silakan coba lagi.';

/** Create: no team yet. Edit: an existing CUSTOM team of the given site (site is then fixed). */
export type CustomTeamTarget = { mode: 'create' } | { mode: 'edit'; team: CsiSubjectView; siteId: string };

interface DraftMember { userId: string | null; name: string }

/** The user search returns CsiUserSearchResult; the shared combobox renders AccountSuggestion rows. */
const toSuggestion = (user: CsiUserSearchResult): AccountSuggestion => ({
    id: user.id, fullName: user.fullName, email: user.email, employeeId: null,
    siteId: user.siteId, siteCode: user.site?.code ?? null, department: user.jobTitle, score: 0,
});
const toInput = (member: DraftMember): CsiTeamMemberInput => (member.userId ? { userId: member.userId } : { name: member.name });

/** Account search with a free-name fallback: Enter on typed text adds a person who has no iDesk account. */
function MemberAdder({ scope, onAdd }: { scope: CsiScopeParam; onAdd: (member: DraftMember) => void }) {
    const [name, setName] = useState('');
    const term = useDebounce(name.trim(), ACCOUNT_SEARCH_DEBOUNCE_MS);
    const { data: users = [] } = useCsiUserSearch(scope, term);
    const accounts = name.trim().length >= MIN_SEARCH ? users.map(toSuggestion) : [];
    const add = (member: DraftMember) => { onAdd(member); setName(''); };
    return (
        <div className="relative">
            <AccountCombobox label="Tambah anggota" placeholder="Ketik nama, pilih akun atau Enter untuk nama bebas" value={name} onChange={setName}
                accounts={accounts} onPick={(account) => add({ userId: account.id, name: account.fullName })}
                onEnterFree={() => name.trim() && add({ userId: null, name: name.trim() })}
                inputClassName={FIELD}
                listClassName="absolute inset-x-0 top-10 z-20 grid max-h-56 gap-0.5 overflow-auto rounded-xl bg-[hsl(var(--idesk-surface))] p-1 shadow-lg ring-1 ring-[hsl(var(--border))]" />
        </div>
    );
}

function MemberList({ members, onRemove }: { members: DraftMember[]; onRemove: (index: number) => void }) {
    if (!members.length) return <p className={cn(MUTED_TEXT, 'text-[12.5px]')}>Belum ada anggota.</p>;
    return (
        <ul aria-label="Anggota tim" className="grid gap-1">
            {members.map((member, index) => (
                <li key={`${member.userId ?? 'name'}-${member.name}`} className="flex items-center gap-2 rounded-lg bg-[hsl(var(--muted)/.5)] px-2.5 py-1.5 text-[13px]">
                    <span className="min-w-0 flex-1 truncate">{member.name}</span>
                    {!member.userId && <span className={cn(MUTED_TEXT, 'text-[11.5px]')}>tanpa akun</span>}
                    <button type="button" aria-label={`Hapus ${member.name} dari tim`} onClick={() => onRemove(index)}
                        className="grid h-6 w-6 place-items-center rounded-full hover:bg-[hsl(var(--muted))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                </li>
            ))}
        </ul>
    );
}

interface FormProps { scope: CsiScopeParam; groups: CsiSubjectGroup[]; target: CustomTeamTarget; onClose: () => void; onEditPhoto: (team: CsiSubjectView) => void }

/** Name, layanan (required by the backend) and members; saving writes the team first, then replaces its members. */
function CustomTeamForm({ scope, groups, target, onClose, onEditPhoto }: FormProps) {
    const create = useCreateCustomTeam(scope);
    const update = useUpdateCustomTeam(scope);
    const setMembers = useSetCustomTeamMembers(scope);
    const team = target.mode === 'edit' ? target.team : null;
    const [siteId, setSiteId] = useState(target.mode === 'edit' ? target.siteId : groups[0]?.siteId ?? '');
    const [name, setName] = useState(team?.name ?? '');
    const [serviceCode, setServiceCode] = useState(team?.serviceCode ?? '');
    const [members, setMembersDraft] = useState<DraftMember[]>((team?.members ?? []).map(({ userId, name: memberName }) => ({ userId, name: memberName })));
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [deleting, setDeleting] = useState(false);
    /** Set once a create succeeded: a retry after a failed member save must update that team, not create it again. */
    const [createdId, setCreatedId] = useState<string | null>(null);
    const teamId = team?.teamId ?? createdId;
    const ids = { site: useId(), name: useId(), service: useId() };
    const addMember = (member: DraftMember) => setMembersDraft((prev) =>
        prev.some((item) => (member.userId ? item.userId === member.userId : !item.userId && item.name === member.name)) ? prev : [...prev, member]);

    const run = async (action: () => Promise<unknown>, fallback: string) => {
        setBusy(true);
        setError(null);
        try {
            await action();
            onClose();
        } catch (failure) {
            setError(errorMessage(failure) ?? fallback);
        } finally {
            setBusy(false);
        }
    };
    const save = () => run(async () => {
        const body = { name: name.trim(), serviceCode };
        let id = teamId;
        if (id) await update.mutateAsync({ id, ...body });
        else {
            id = (await create.mutateAsync({ siteId, ...body })).teamId;
            if (!id) throw new Error('missing team id');
            setCreatedId(id);
        }
        await setMembers.mutateAsync({ id, members: members.map(toInput) });
    }, SAVE_FAILED);

    return (
        <>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 pb-4">
                <div className="grid gap-1.5">
                    <label htmlFor={ids.site} className={FIELD_LABEL}>Site</label>
                    <select id={ids.site} className={FIELD} value={siteId} disabled={!!teamId} onChange={(event) => setSiteId(event.target.value)}>
                        {groups.map((group) => <option key={group.siteId} value={group.siteId}>{`${group.siteCode} · ${group.siteName}`}</option>)}
                    </select>
                </div>
                <div className="grid gap-1.5">
                    <label htmlFor={ids.name} className={FIELD_LABEL}>Nama tim</label>
                    <Input id={ids.name} value={name} maxLength={150} onChange={(event) => setName(event.target.value)} />
                </div>
                <div className="grid gap-1.5">
                    <label htmlFor={ids.service} className={FIELD_LABEL}>Layanan</label>
                    <select id={ids.service} className={FIELD} value={serviceCode} onChange={(event) => setServiceCode(event.target.value)}>
                        <option value="">Pilih layanan…</option>
                        {Object.entries(CSI_SERVICE_NAMES.hc).map(([code, label]) => <option key={code} value={code}>{`${code} · ${label}`}</option>)}
                    </select>
                    {!serviceCode && <p className={cn('text-[12.5px]', toneClasses('amber').ink)}>Pilih layanan tim.</p>}
                </div>
                <div className="grid gap-1.5">
                    <span className={FIELD_LABEL}>Anggota</span>
                    <MemberAdder scope={scope} onAdd={addMember} />
                    <MemberList members={members} onRemove={(index) => setMembersDraft((prev) => prev.filter((_, at) => at !== index))} />
                </div>
                {team && (
                    <Button variant="soft" size="sm" onClick={() => onEditPhoto(team)}><Camera aria-hidden="true" />Foto &amp; tagline</Button>
                )}
                {error && <p role="alert" className={cn('text-[12.5px] font-medium', toneClasses('red').ink)}>{error}</p>}
            </div>
            <div className="flex justify-end gap-2 border-t border-[hsl(var(--idesk-border)/.7)] px-6 py-4">
                {team && (
                    <Button variant="subtle" className="mr-auto text-[hsl(var(--ticket-red-ink))]" disabled={busy} onClick={() => setDeleting(true)}>
                        <Trash2 aria-hidden="true" />Hapus tim
                    </Button>
                )}
                <Button variant="subtle" onClick={onClose}>Batal</Button>
                <Button variant="primary" onClick={() => void save()} loading={busy} disabled={!siteId || !name.trim() || !serviceCode}>Simpan</Button>
            </div>
            <TeamDeleteDialog scope={scope} team={deleting && team?.teamId ? { teamId: team.teamId, name: team.name } : null}
                onClose={() => setDeleting(false)} onDeleted={onClose} />
        </>
    );
}

/** HC custom team (any number per site, beside the single SITE team): create or edit name, layanan and members. */
export function CustomTeamSheet({ target, ...props }: Omit<FormProps, 'target'> & { target: CustomTeamTarget | null }) {
    const editing = target?.mode === 'edit';
    return (
        <Sheet open={!!target} onOpenChange={(open) => { if (!open) props.onClose(); }}>
            <SheetContent side="right" className="max-w-lg">
                <SheetHeader className="pr-12">
                    <SheetTitle>{editing ? 'Edit tim custom' : 'Tim custom baru'}</SheetTitle>
                    <SheetDescription>Tim dinilai sebagai satu subjek; hasilnya tampil ke setiap anggota.</SheetDescription>
                </SheetHeader>
                {target && <CustomTeamForm key={editing ? target.team.key : 'new'} target={target} {...props} />}
            </SheetContent>
        </Sheet>
    );
}
