import { useState } from 'react';
import { Link2, Unlink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useDebounce } from '@/hooks/useDebounce';
import { cn } from '@/lib/utils';
import { usePicAccountSuggestions } from '../../../hooks/useCsiHc';
import type { CsiPicView } from '../../../hcTypes';
import type { CsiScopeParam } from '../../../types';
import { titleCase } from './hcFormat';
import { ACCOUNT_SEARCH_DEBOUNCE_MS, AccountCombobox } from './templates/AccountCombobox';

interface PicAccountPickerProps {
    scope: CsiScopeParam;
    pic: CsiPicView;
    pending: boolean;
    onPick: (userId: string | null) => void;
}

function PickerBody({ scope, pic, pending, onPick, onDone }: PicAccountPickerProps & { onDone: () => void }) {
    const [search, setSearch] = useState(pic.user?.fullName ?? titleCase(pic.fullName));
    const debounced = useDebounce(search, ACCOUNT_SEARCH_DEBOUNCE_MS);
    const suggestions = usePicAccountSuggestions(scope, debounced, pic.siteId);
    const accounts = suggestions.data ?? [];
    const pick = (userId: string | null) => {
        onPick(userId);
        onDone();
    };
    return (
        <div className="grid gap-2">
            <AccountCombobox label="Cari akun iDesk" autoFocus value={search} onChange={setSearch} accounts={accounts}
                currentId={pic.userId} placeholder="Nama, email, atau NIK…"
                onPick={(account) => !pending && pick(account.id)}
                inputClassName="h-8 w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--idesk-surface))] px-2 text-[12.5px]"
                listClassName={cn('grid max-h-64 gap-0.5 overflow-auto', pending && 'pointer-events-none opacity-60')} />
            {suggestions.isFetching && !accounts.length && <p className="text-[12px] text-muted-foreground">Mencari akun…</p>}
            {!suggestions.isFetching && debounced.trim().length >= 2 && !accounts.length && (
                <p className="text-[12px] text-muted-foreground">Tidak ada akun yang cocok. Coba nama, email, atau NIK lain.</p>
            )}
            {pic.userId && (
                <div className="flex flex-wrap gap-2 border-t border-[hsl(var(--border))] pt-2">
                    <Button type="button" variant="subtle" size="sm" disabled={pending} onClick={() => pick(null)}>
                        <Unlink className="h-3.5 w-3.5" aria-hidden="true" />Lepas akun
                    </Button>
                </div>
            )}
        </div>
    );
}

/** Popover button on a PIC HC row to link, switch, or unlink an existing iDesk account. */
export function PicAccountPicker({ scope, pic, pending, onPick }: PicAccountPickerProps) {
    const [open, setOpen] = useState(false);
    const label = pic.user ? `${titleCase(pic.user.fullName)} (${pic.user.email})` : pic.userId ? 'akun iDesk' : 'Pilih akun iDesk';
    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button type="button" disabled={pending}
                    aria-label={pic.userId ? `Ubah akun iDesk ${titleCase(pic.fullName)}` : `Pilih akun iDesk ${titleCase(pic.fullName)}`}
                    className={cn('inline-flex max-w-full items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium transition-colors hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        pic.userId
                            ? 'bg-[hsl(var(--ticket-green)/.13)] text-[hsl(var(--ticket-green-ink))]'
                            : 'bg-[hsl(var(--muted))] text-[hsl(var(--idesk-text-secondary))] hover:text-foreground')}>
                    <Link2 className="h-3 w-3 shrink-0" aria-hidden="true" />
                    <span className="truncate">{label}</span>
                </button>
            </PopoverTrigger>
            <PopoverContent align="start" aria-label={`Pilih akun iDesk untuk ${titleCase(pic.fullName)}`} className="picker-panel w-[min(92vw,360px)] p-3">
                {open && <PickerBody scope={scope} pic={pic} pending={pending} onPick={onPick} onDone={() => setOpen(false)} />}
            </PopoverContent>
        </Popover>
    );
}
