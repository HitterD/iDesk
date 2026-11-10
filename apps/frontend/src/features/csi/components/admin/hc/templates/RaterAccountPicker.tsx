import { useState, type ReactElement } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { useDebounce } from '@/hooks/useDebounce';
import { cn } from '@/lib/utils';
import { useAccountSuggestions, useConfirmRaters, useSetRaterAccount } from '../../../../hooks/useCsiHc';
import type { AccountSuggestion } from '../../../../hcTypes';
import type { CsiScopeParam } from '../../../../types';

/** Same delay for every account search box so typing never fires one request per keystroke. */
export const ACCOUNT_SEARCH_DEBOUNCE_MS = 250;
const OPTION_CLASS = 'grid cursor-pointer gap-0.5 rounded-lg px-2 py-1.5 text-left text-[12.5px] outline-none hover:bg-[hsl(var(--muted))] focus-visible:bg-[hsl(var(--muted))] aria-selected:bg-[hsl(var(--muted))]';

/** "department · site · email" (+ NIK) so two people with the same name can be told apart. */
export function suggestionDetail(account: AccountSuggestion) {
    return [account.department, account.siteCode, account.email].filter(Boolean).join(' · ');
}

/** One account suggestion as a listbox option; shared by the picker and the add-rater field. */
export function AccountOption({ account, active = false, onPick }: { account: AccountSuggestion; active?: boolean; onPick: (account: AccountSuggestion) => void }) {
    return (
        <li role="option" aria-selected={active} tabIndex={-1} className={OPTION_CLASS}
            // Keep focus in the search field: a blur before click would close the list and lose the pick.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onPick(account)}>
            <span className="font-semibold">{account.fullName}</span>
            <span className="text-[11.5px] text-muted-foreground">
                {suggestionDetail(account)}{account.employeeId && ` · NIK ${account.employeeId}`}
            </span>
        </li>
    );
}

interface PickerBodyProps {
    scope: CsiScopeParam; templateId: string; raterIds: string[]; initialName: string;
    userId: string | null; confirmed: boolean; onDone: () => void;
}

function PickerBody({ scope, templateId, raterIds, initialName, userId, confirmed, onDone }: PickerBodyProps) {
    const [search, setSearch] = useState(initialName);
    const debounced = useDebounce(search, ACCOUNT_SEARCH_DEBOUNCE_MS);
    const suggestions = useAccountSuggestions(scope, templateId, debounced);
    const setAccount = useSetRaterAccount(scope);
    const confirm = useConfirmRaters(scope);
    const busy = setAccount.isPending || confirm.isPending;
    const pin = (next: string | null) => setAccount.mutate({ raterIds, userId: next }, { onSuccess: onDone });
    const accounts = suggestions.data ?? [];
    return (
        <div className="grid gap-2">
            <input autoFocus aria-label="Cari akun" value={search} onChange={(event) => setSearch(event.target.value)}
                className="h-8 w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--idesk-surface))] px-2 text-[12.5px]" />
            {suggestions.isFetching && !accounts.length && <p className="text-[12px] text-muted-foreground">Mencari akun…</p>}
            {!suggestions.isFetching && debounced.trim().length >= 2 && !accounts.length && (
                <p className="text-[12px] text-muted-foreground">Tidak ada akun yang cocok. Coba nama lain.</p>
            )}
            {accounts.length > 0 && (
                <ul role="listbox" aria-label="Saran akun" className={cn('grid max-h-64 gap-0.5 overflow-auto', busy && 'pointer-events-none opacity-60')}>
                    {accounts.map((account) => <AccountOption key={account.id} account={account} active={account.id === userId} onPick={(picked) => pin(picked.id)} />)}
                </ul>
            )}
            {(userId || confirmed) && (
                <div className="flex flex-wrap gap-2 border-t border-[hsl(var(--border))] pt-2">
                    {confirmed && (
                        <Button variant="subtle" size="sm" disabled={busy}
                            onClick={() => confirm.mutate({ raterIds, confirmed: false }, { onSuccess: onDone })}>Batalkan konfirmasi</Button>
                    )}
                    {userId && <Button variant="subtle" size="sm" disabled={busy} onClick={() => pin(null)}>Lepas akun</Button>}
                </div>
            )}
        </div>
    );
}

export interface RaterAccountPickerProps extends Omit<PickerBodyProps, 'onDone'> {
    /** The element the popover anchors to (badge, "Pilih lain" button). */
    trigger: ReactElement;
    label: string;
}

/**
 * Pins one or more template rater rows to an iDesk account: search prefilled with the rater name,
 * suggestions show department, site, email and NIK. Also unpins ("Lepas akun") and undoes a confirmation.
 */
export function RaterAccountPicker({ trigger, label, ...body }: RaterAccountPickerProps) {
    const [open, setOpen] = useState(false);
    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>{trigger}</PopoverTrigger>
            <PopoverContent align="start" aria-label={label} className="picker-panel w-[min(92vw,360px)] p-3">
                {open && <PickerBody {...body} onDone={() => setOpen(false)} />}
            </PopoverContent>
        </Popover>
    );
}
