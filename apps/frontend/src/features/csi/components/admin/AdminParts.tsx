import { useState, type ReactNode } from 'react';
import { Check, ChevronDown, Lock, Plus, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { TicketPill } from '@/components/ui/ticket-pill';
import { useDebounce } from '@/hooks/useDebounce';
import { cn } from '@/lib/utils';
import { useCsiUserSearch } from '../../hooks/useCsi';
import { CSI_LOCKED_NOTE, CSI_SEARCH_DEBOUNCE_MS, CSI_STATUS_LABELS, CSI_STATUS_TONES, type DraftUser } from '../../lib/csiAdmin';
import type { CsiPeriodStatus, CsiScopeParam } from '../../types';

/** Panel surface: hairline shadow on the neutral sheet, tokens keep dark mode working. */
export const ADMIN_PANEL = 'rounded-[18px] bg-[hsl(var(--idesk-surface))] text-[hsl(var(--idesk-text))] shadow-[var(--dash-shadow-1)]';
export const FIELD_LABEL = 'text-[13px] font-medium text-[hsl(var(--idesk-text-secondary))]';
export const MUTED_TEXT = 'text-[13px] text-[hsl(var(--idesk-text-secondary))]';

export function AdminSection({ title, description, actions, children, className }: {
    title: string; description?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string;
}) {
    return (
        <section aria-label={title} className={cn(ADMIN_PANEL, 'p-5 sm:p-6', className)}>
            <header className="mb-4 flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1">
                    <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
                    {description && <p className={cn(MUTED_TEXT, 'mt-0.5')}>{description}</p>}
                </div>
                {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
            </header>
            {children}
        </section>
    );
}

/** The one amber create action of the visible tab. */
export function CreateButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
    return (
        <button type="button" className="idesk-cta ct-submit" onClick={onClick} disabled={disabled}>
            <Plus aria-hidden="true" />{label}
        </button>
    );
}

export function LockedNote({ children = CSI_LOCKED_NOTE }: { children?: ReactNode }) {
    return (
        <p role="note" className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--ticket-amber)/.12)] px-3 py-1 text-[12.5px] font-medium text-[hsl(var(--ticket-amber-ink))]">
            <Lock className="h-3.5 w-3.5" aria-hidden="true" />{children}
        </p>
    );
}

export function StatusPill({ status }: { status: CsiPeriodStatus }) {
    return <TicketPill tone={CSI_STATUS_TONES[status]}>{CSI_STATUS_LABELS[status]}</TicketPill>;
}

export function EmptyNote({ children }: { children: ReactNode }) {
    return <p className={cn(MUTED_TEXT, 'rounded-2xl border border-dashed border-[hsl(var(--idesk-border))] px-4 py-8 text-center')}>{children}</p>;
}

interface UserMultiPickerProps {
    scope: CsiScopeParam;
    label: string;
    selected: readonly DraftUser[];
    onChange: (users: DraftUser[]) => void;
    disabled?: boolean;
    /** User IDs that cannot be picked again (e.g. already registered raters). */
    excludeIds?: ReadonlySet<string>;
}

/** Server-searched multi-select in the SearchablePicker look; stays open while picking several users. */
export function UserMultiPicker({ scope, label, selected, onChange, disabled, excludeIds }: UserMultiPickerProps) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const term = useDebounce(search.trim(), CSI_SEARCH_DEBOUNCE_MS);
    const { data: users = [], isFetching } = useCsiUserSearch(scope, term);
    const chosen = new Set(selected.map((user) => user.id));
    const toggle = (user: DraftUser) => onChange(chosen.has(user.id)
        ? selected.filter((item) => item.id !== user.id)
        : [...selected, { id: user.id, fullName: user.fullName, jobTitle: user.jobTitle }]);
    const triggerText = selected.length ? `${selected.length} orang dipilih` : 'Cari nama atau email';

    return (
        <div className="space-y-2">
            <Popover open={open && !disabled} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <button type="button" aria-label={label} disabled={disabled}
                        className="ticket-pill ticket-tone-neutral picker-trigger min-h-9 w-full max-w-md">
                        <span className="min-w-0 truncate">{triggerText}</span>
                        <ChevronDown aria-hidden="true" className="h-3 w-3 shrink-0 opacity-60" />
                    </button>
                </PopoverTrigger>
                <PopoverContent align="start" collisionPadding={12} sideOffset={8} className="picker-panel w-[min(92vw,380px)] p-1.5" aria-label={label}>
                    <Command label={label} shouldFilter={false} loop className="picker-command">
                        <CommandInput aria-label="Cari pengguna" placeholder="Cari nama atau email…" value={search} onValueChange={setSearch} />
                        <CommandList className="picker-list" aria-label="Pengguna" aria-multiselectable="true" aria-busy={isFetching || undefined}>
                            <CommandEmpty>{isFetching ? 'Mencari…' : 'Tidak ditemukan. Coba kata lain.'}</CommandEmpty>
                            {users.filter((user) => !excludeIds?.has(user.id)).map((user) => (
                                <CommandItem key={user.id} value={user.id} className="picker-option"
                                    data-checked={chosen.has(user.id)} aria-checked={chosen.has(user.id)} onSelect={() => toggle(user)}>
                                    <span className="min-w-0 flex-1 break-words">
                                        <span>{user.fullName}</span>
                                        <span className="picker-description block">{[user.jobTitle, user.site?.code, user.email].filter(Boolean).join(' · ')}</span>
                                    </span>
                                    {chosen.has(user.id) && <Check aria-hidden="true" className="h-4 w-4 shrink-0" />}
                                </CommandItem>
                            ))}
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
            {selected.length > 0 && (
                <ul className="flex flex-wrap gap-1.5" aria-label="Dipilih">
                    {selected.map((user) => (
                        <li key={user.id} className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--idesk-sapphire)/.1)] py-1 pl-3 pr-1 text-[12.5px] font-medium text-[hsl(var(--idesk-sapphire))]">
                            {user.fullName}
                            <button type="button" disabled={disabled} onClick={() => toggle(user)} aria-label={`Hapus ${user.fullName} dari pilihan`}
                                className="grid h-5 w-5 place-items-center rounded-full hover:bg-[hsl(var(--idesk-sapphire)/.15)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                                <X className="h-3 w-3" aria-hidden="true" />
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
