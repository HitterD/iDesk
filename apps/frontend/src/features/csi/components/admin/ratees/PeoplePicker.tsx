import { useState } from 'react';
import { Check, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useCsiSubjects } from '../../../hooks/useCsi';
import type { DraftUser } from '../../../lib/csiAdmin';
import { siteTone, toneClasses } from '../../../lib/csiTone';
import type { CsiScopeParam, CsiSubjectGroup, CsiSubjectView } from '../../../types';
import { imageUrl } from '../../respond/RateeAvatar';
import { MUTED_TEXT, UserMultiPicker } from '../AdminParts';
import { PEOPLE_COPY } from './rateeCopy';

type Person = CsiSubjectView & { userId: string };

const peopleOf = (group: CsiSubjectGroup): Person[] =>
    group.people.filter((person): person is Person => person.userId !== null);
const toDraftUser = (person: Person): DraftUser => ({ id: person.userId, fullName: person.name, jobTitle: person.jobTitle });

function Avatar({ person, siteCode }: { person: Person; siteCode: string }) {
    const [failed, setFailed] = useState<string | null>(null);
    if (person.photoUrl && failed !== person.photoUrl) {
        return <img src={imageUrl(person.photoUrl)} alt="" loading="lazy" onError={() => setFailed(person.photoUrl)}
            className="h-10 w-10 shrink-0 rounded-full object-cover object-[center_25%]" />;
    }
    return (
        <span aria-hidden="true" className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-full text-[15px] font-bold text-white', toneClasses(siteTone(siteCode)).fill)}>
            {person.name.trim().charAt(0).toUpperCase() || '?'}
        </span>
    );
}

function PersonTile({ person, siteCode, picked, assigned, disabled, onToggle }: {
    person: Person; siteCode: string; picked: boolean; assigned: boolean; disabled?: boolean; onToggle: () => void;
}) {
    return (
        <li>
            <button type="button" role="checkbox" aria-checked={picked} disabled={disabled} onClick={onToggle}
                className={cn('flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60',
                    picked ? 'border-[hsl(var(--idesk-sapphire))] bg-[hsl(var(--idesk-sapphire)/.08)]' : 'border-[hsl(var(--idesk-border)/.7)] bg-card hover:bg-[hsl(var(--muted)/.5)]')}>
                <Avatar person={person} siteCode={siteCode} />
                <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold">{person.name}</span>
                    <span className={cn(MUTED_TEXT, 'block truncate text-[11.5px]')}>{assigned ? PEOPLE_COPY.assigned : person.jobTitle ?? ' '}</span>
                </span>
                <span aria-hidden="true" className={cn('grid h-5 w-5 shrink-0 place-items-center rounded-md border',
                    picked ? 'border-transparent bg-[hsl(var(--idesk-sapphire))] text-white' : 'border-[hsl(var(--idesk-border))]')}>
                    {picked && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                </span>
            </button>
        </li>
    );
}

interface PeoplePickerProps {
    scope: CsiScopeParam;
    selected: readonly DraftUser[];
    onChange: (users: DraftUser[]) => void;
    /** User ids already in the draft (shown as "sudah dipasang"). */
    assignedIds: ReadonlySet<string>;
    disabled?: boolean;
}

/**
 * Pick people from the "Subjek & foto" master (photo tiles grouped per site, "Pilih semua" per site);
 * anyone else can still be found with the search below.
 */
export function PeoplePicker({ scope, selected, onChange, assignedIds, disabled }: PeoplePickerProps) {
    const { data: groups = [], isLoading } = useCsiSubjects(scope);
    const chosen = new Set(selected.map((user) => user.id));
    const withPeople = groups.filter((group) => peopleOf(group).length > 0);
    const known = new Set(withPeople.flatMap((group) => peopleOf(group).map((person) => person.userId)));
    const toggle = (person: Person) => onChange(chosen.has(person.userId)
        ? selected.filter((user) => user.id !== person.userId)
        : [...selected, toDraftUser(person)]);
    const toggleSite = (group: CsiSubjectGroup) => {
        const people = peopleOf(group);
        const allOn = people.every((person) => chosen.has(person.userId));
        const ids = new Set(people.map((person) => person.userId));
        onChange(allOn ? selected.filter((user) => !ids.has(user.id))
            : [...selected, ...people.filter((person) => !chosen.has(person.userId)).map(toDraftUser)]);
    };
    // Users picked through the search (not in the subject master) stay visible as chips there.
    const extra = selected.filter((user) => !known.has(user.id));
    const setExtra = (users: DraftUser[]) => onChange([...selected.filter((user) => known.has(user.id)), ...users]);

    return (
        <div className="grid gap-3">
            {isLoading && <div className="h-24 animate-pulse rounded-xl bg-[hsl(var(--muted)/.6)] motion-reduce:animate-none" aria-busy="true" aria-label={PEOPLE_COPY.loading} />}
            {!isLoading && !withPeople.length && <p className={cn(MUTED_TEXT, 'text-[12.5px]')}>{PEOPLE_COPY.noSubjects}</p>}
            {withPeople.map((group) => {
                const people = peopleOf(group);
                const allOn = people.every((person) => chosen.has(person.userId));
                return (
                    <section key={group.siteId} aria-label={PEOPLE_COPY.siteLabel(group.siteName)} className="grid gap-2">
                        <div className="flex items-center gap-2">
                            <span className={cn('rounded-md px-1.5 py-0.5 text-[11px] font-bold text-white', toneClasses(siteTone(group.siteCode)).fill)}>{group.siteCode}</span>
                            <span className="text-[12.5px] font-semibold">{group.siteName}</span>
                            <span className={cn(MUTED_TEXT, 'text-[12px]')}>· {people.length} orang</span>
                            <Button variant="subtle" size="sm" className="ml-auto" disabled={disabled} onClick={() => toggleSite(group)}>
                                <CheckCheck aria-hidden="true" />{allOn ? PEOPLE_COPY.clearSite : PEOPLE_COPY.pickSite}
                            </Button>
                        </div>
                        <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(210px,100%),1fr))] gap-2 p-0">
                            {people.map((person) => (
                                <PersonTile key={person.key} person={person} siteCode={group.siteCode} picked={chosen.has(person.userId)}
                                    assigned={assignedIds.has(person.userId)} disabled={disabled} onToggle={() => toggle(person)} />
                            ))}
                        </ul>
                    </section>
                );
            })}
            <div className="grid gap-1.5 border-t border-[hsl(var(--idesk-border)/.6)] pt-3">
                <span className={cn(MUTED_TEXT, 'text-[12px]')}>{PEOPLE_COPY.searchOthers}</span>
                <UserMultiPicker scope={scope} label={PEOPLE_COPY.searchLabel} selected={extra} onChange={setExtra} disabled={disabled} excludeIds={known} />
            </div>
        </div>
    );
}
