import { useState } from 'react';
import { Check, X } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';
import { cn } from '@/lib/utils';
import { useAccountSuggestions } from '../../../../hooks/useCsiHc';
import type { CsiTemplateRater, CsiTemplateRaterStatus } from '../../../../hcTypes';
import type { CsiScopeParam } from '../../../../types';
import { titleCase } from '../hcFormat';
import { ACCOUNT_SEARCH_DEBOUNCE_MS, AccountCombobox } from './AccountCombobox';
import { RaterAccountPicker } from './RaterAccountPicker';

export const RATER_STATUS: Record<CsiTemplateRaterStatus, { label: string; className: string; hint: string }> = {
    confirmed: { label: 'Terkonfirmasi', className: 'bg-[hsl(var(--ticket-green)/.14)] text-[hsl(var(--ticket-green-ink))]', hint: 'Akun dikonfirmasi atau cocok berdasarkan NIK' },
    ok: { label: 'Cocok otomatis', className: 'bg-[hsl(var(--muted))] text-muted-foreground', hint: 'Nama cocok dengan satu akun iDesk; klik untuk ganti akun' },
    'no-account': { label: 'Belum punya akun', className: 'bg-[hsl(var(--ticket-amber)/.16)] text-[hsl(var(--ticket-amber-ink))]', hint: 'Klik untuk memilih akun, atau biarkan: masuk survei otomatis saat akunnya ada' },
    ambiguous: { label: 'Nama ganda', className: 'bg-[hsl(var(--ticket-red)/.12)] text-[hsl(var(--ticket-red))]', hint: 'Lebih dari satu akun dengan nama ini: klik untuk memilih akun yang benar' },
};
const MIN_SEARCH = 2;
const ICON_BUTTON = 'shrink-0 rounded p-0.5 text-muted-foreground hover:bg-[hsl(var(--muted))]';
/**
 * When the PIC card (an `@container`) is narrower than 280px the status badge shrinks to a coloured dot;
 * the label stays in aria-label and title. Follows the card width, not the viewport.
 */
const COMPACT_LABEL = '@max-[280px]:hidden';
const COMPACT_DOT = 'hidden @max-[280px]:inline-block';

export interface RaterRowProps {
    scope: CsiScopeParam; templateId: string; rater: CsiTemplateRater; pending: boolean;
    onConfirm: () => void; onRemove: () => void;
}

/** One rater of a template PIC: name, status badge (opens the account picker), confirm and remove. */
export function RaterRow({ scope, templateId, rater, pending, onConfirm, onRemove }: RaterRowProps) {
    const status = RATER_STATUS[rater.status];
    const name = titleCase(rater.raterName);
    return (
        <li className="flex min-w-0 items-center gap-2 text-[12.5px]">
            <span className="min-w-0 flex-1 truncate" title={rater.raterJobTitle ? `${name} · ${titleCase(rater.raterJobTitle)}` : name}>{name}</span>
            <RaterAccountPicker scope={scope} templateId={templateId} raterIds={[rater.id]} initialName={rater.raterName}
                userId={rater.userId} confirmed={rater.status === 'confirmed'} label={`Akun untuk ${name}`}
                trigger={(
                    <button type="button" title={`${status.label}: ${status.hint}`} aria-label={`Pilih akun untuk ${name} (${status.label})`} disabled={pending}
                        className={cn('inline-flex shrink-0 items-center rounded-md px-1.5 text-[11px] font-semibold hover:brightness-95', status.className)}>
                        <span className={cn('whitespace-nowrap', COMPACT_LABEL)}>{status.label}</span>
                        <span data-status-dot aria-hidden="true" className={cn('my-1 h-2 w-2 rounded-full bg-current', COMPACT_DOT)} />
                    </button>
                )} />
            {rater.status === 'ok' && (
                <button type="button" aria-label={`Konfirmasi ${name}`} title="Konfirmasi akun ini" disabled={pending} onClick={onConfirm} className={ICON_BUTTON}>
                    <Check className="h-3 w-3" aria-hidden="true" />
                </button>
            )}
            <button type="button" aria-label={`Hapus penilai ${rater.raterName}`} disabled={pending} onClick={onRemove} className={ICON_BUTTON}>
                <X className="h-3 w-3" aria-hidden="true" />
            </button>
        </li>
    );
}

export type AddRaterBody = { name: string } | { userId: string };

/**
 * Adds a rater: suggestions appear while typing (picking one stores that account, confirmed by the backend);
 * Enter without a pick stores the typed name and lets the backend work out its status.
 */
export function AddRaterField({ scope, templateId, onAdd, disabled }: { scope: CsiScopeParam; templateId: string; onAdd: (body: AddRaterBody) => void; disabled: boolean }) {
    const [name, setName] = useState('');
    const debounced = useDebounce(name, ACCOUNT_SEARCH_DEBOUNCE_MS);
    const suggestions = useAccountSuggestions(scope, templateId, debounced);
    const accounts = name.trim().length >= MIN_SEARCH ? suggestions.data ?? [] : [];
    const add = (body: AddRaterBody) => { onAdd(body); setName(''); };
    return (
        <div className="relative">
            <AccountCombobox label="Tambah penilai" placeholder="Tambah penilai: ketik nama, pilih akun atau Enter" value={name} onChange={setName}
                accounts={accounts} disabled={disabled} onPick={(account) => add({ userId: account.id })}
                onEnterFree={() => name.trim().length >= MIN_SEARCH && add({ name: name.trim() })}
                inputClassName="h-8 w-full rounded-lg border border-dashed border-[hsl(var(--border))] bg-transparent px-2 text-[12.5px]"
                listClassName="absolute inset-x-0 top-9 z-20 grid max-h-56 gap-0.5 overflow-auto rounded-xl bg-[hsl(var(--idesk-surface))] p-1 shadow-lg ring-1 ring-[hsl(var(--border))]" />
        </div>
    );
}
