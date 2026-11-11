import { useId, useState, type KeyboardEvent } from 'react';
import { Check } from 'lucide-react';
import type { AccountSuggestion } from '../../../../hcTypes';

/** Same delay for every account search box so typing never fires one request per keystroke. */
export const ACCOUNT_SEARCH_DEBOUNCE_MS = 250;
const OPTION_CLASS = 'grid cursor-pointer gap-0.5 rounded-lg px-2 py-1.5 text-left text-[12.5px] hover:bg-[hsl(var(--muted))] aria-selected:bg-[hsl(var(--muted))] aria-selected:ring-1 aria-selected:ring-[hsl(var(--ring))]';

/** "department · site · email" so two people with the same name can be told apart. */
export function suggestionDetail(account: AccountSuggestion) {
    return [account.department, account.siteCode, account.email].filter(Boolean).join(' · ');
}

export interface AccountComboboxProps {
    label: string;
    value: string;
    onChange: (value: string) => void;
    accounts: AccountSuggestion[];
    onPick: (account: AccountSuggestion) => void;
    /** Enter with no active option (e.g. save the typed name). */
    onEnterFree?: () => void;
    /** Account the row is already pinned to: marked with a check, not with selection. */
    currentId?: string | null;
    placeholder?: string;
    autoFocus?: boolean;
    disabled?: boolean;
    inputClassName?: string;
    listClassName?: string;
}

/**
 * Search field + account suggestion listbox following the ARIA combobox pattern: focus stays in the input,
 * ArrowUp/ArrowDown move the active option (aria-activedescendant), Enter picks it, Escape hides the list.
 * Shared by the add-rater field and the account picker so both behave identically for keyboard users.
 */
export function AccountCombobox({ label, value, onChange, accounts, onPick, onEnterFree, currentId, placeholder, autoFocus, disabled, inputClassName, listClassName }: AccountComboboxProps) {
    const listId = useId();
    const [active, setActive] = useState(-1);
    const [hidden, setHidden] = useState(false);
    const shown = hidden ? [] : accounts;
    const optionId = (index: number) => `${listId}-opt-${index}`;
    const activeIndex = active < shown.length ? active : -1;
    const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && shown.length) {
            event.preventDefault();
            const step = event.key === 'ArrowDown' ? 1 : -1;
            setActive(Math.max(-1, Math.min(shown.length - 1, activeIndex + step)));
        } else if (event.key === 'Escape' && shown.length) {
            setHidden(true);
            setActive(-1);
        } else if (event.key === 'Enter') {
            event.preventDefault();
            if (shown[activeIndex]) onPick(shown[activeIndex]);
            else onEnterFree?.();
        }
    };
    return (
        <>
            <input role="combobox" aria-label={label} aria-expanded={shown.length > 0} aria-controls={listId} aria-autocomplete="list"
                aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
                value={value} placeholder={placeholder} autoFocus={autoFocus} disabled={disabled} onKeyDown={onKeyDown}
                onChange={(event) => { onChange(event.target.value); setActive(-1); setHidden(false); }} className={inputClassName} />
            {shown.length > 0 && (
                <ul id={listId} role="listbox" aria-label="Saran akun" className={listClassName}>
                    {shown.map((account, index) => (
                        <li key={account.id} id={optionId(index)} role="option" aria-selected={index === activeIndex} className={OPTION_CLASS}
                            // Keep focus in the input: a blur before click would lose the pick.
                            onMouseDown={(event) => event.preventDefault()} onMouseEnter={() => setActive(index)} onClick={() => onPick(account)}>
                            <span className="flex items-center gap-1 font-semibold">
                                {account.fullName}
                                {account.id === currentId && <Check className="h-3 w-3" aria-label="akun saat ini" />}
                            </span>
                            <span className="text-[11.5px] text-muted-foreground">
                                {suggestionDetail(account)}{account.employeeId && ` · NIK ${account.employeeId}`}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </>
    );
}
