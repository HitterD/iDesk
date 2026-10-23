import React, { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { displayTime, parseTypedTime } from '../utils/slotAvailability';

export interface TimeOption {
    /** "HH:mm" */
    time: string;
    /** Title of what already sits here, if anything. */
    busyTitle?: string;
    isCurrent?: boolean;
    disabled?: boolean;
}

interface ZoomTimeComboboxProps {
    value: string;
    onChange: (time: string) => void;
    options: TimeOption[];
    disabled?: boolean;
    labelledBy?: string;
}

const digitsOf = (text: string) => text.replace(/\D/g, '');
const statusOf = (option: TimeOption) =>
    option.busyTitle ? `Terisi · ${option.busyTitle}` : option.isCurrent ? 'Jadwal saat ini' : 'Kosong';

/**
 * Start time as a field you can type into ("1430", "14.30") or open as a list. The list keeps availability
 * visible: taken times show who has them and cannot be picked.
 */
export const ZoomTimeCombobox: React.FC<ZoomTimeComboboxProps> = ({ value, onChange, options, disabled, labelledBy }) => {
    const listId = useId();
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLUListElement>(null);
    const [open, setOpen] = useState(false);
    const [text, setText] = useState(value ? displayTime(value) : '');
    const [typing, setTyping] = useState(false);
    const [active, setActive] = useState(-1);
    const [error, setError] = useState('');

    useEffect(() => { if (!typing) setText(value ? displayTime(value) : ''); }, [value, typing]);

    // While typing, narrow the list to the typed digits ("14" → 14.00, 14.30).
    const typedDigits = typing ? digitsOf(text) : '';
    // An odd digit count means the hour was typed without its leading zero: "9" → 09, "930" → 09.30 (but "13" is 13, not 01.3x).
    const typedPrefix = typedDigits.length % 2 === 1 ? `0${typedDigits}` : typedDigits;
    const shown = typedDigits
        ? options.filter((o) => digitsOf(o.time).startsWith(typedDigits) || digitsOf(o.time).startsWith(typedPrefix))
        : options;

    // Open on the chosen time (or the first free one) instead of the top of a 48-row list.
    useEffect(() => {
        if (!open) return;
        const index = Math.max(0, shown.findIndex((o) => o.time === value || (!value && !o.disabled)));
        setActive(index);
        requestAnimationFrame(() => listRef.current?.children[index]?.scrollIntoView({ block: 'nearest' }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const pick = (option: TimeOption) => {
        if (option.disabled) return;
        onChange(option.time);
        setError(''); setTyping(false); setOpen(false);
    };

    const commitTyped = () => {
        setTyping(false);
        if (!text.trim()) return;
        const time = parseTypedTime(text);
        const option = time ? options.find((o) => o.time === time) : undefined;
        if (!time) setError('Format jam tidak dikenali. Contoh: 14.30');
        else if (!option) setError(`${displayTime(time)} tidak tersedia. Pilih jam dari daftar.`);
        else if (option.disabled) setError(`${displayTime(time)} sudah terisi${option.busyTitle ? `: ${option.busyTitle}` : ''}.`);
        else { pick(option); return; }
        setText(value ? displayTime(value) : '');
    };

    const move = (step: number) => {
        if (!open) { setOpen(true); return; }
        if (shown.length === 0) return;
        let next = active;
        for (let i = 0; i < shown.length; i++) {
            next = (next + step + shown.length) % shown.length;
            if (!shown[next].disabled) break;
        }
        setActive(next);
        listRef.current?.children[next]?.scrollIntoView({ block: 'nearest' });
    };

    const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); move(event.key === 'ArrowDown' ? 1 : -1); }
        else if (event.key === 'Enter') {
            event.preventDefault();
            if (open && !typing && shown[active]) pick(shown[active]); else commitTyped();
            setOpen(false);
        } else if (event.key === 'Escape' && open) { event.stopPropagation(); setOpen(false); setTyping(false); }
    };

    return (
        <div className="zsp-combo" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) { if (typing) commitTyped(); setOpen(false); } }}>
            <div className={cn('zsp-field', error && 'is-invalid')}>
                <Clock aria-hidden="true" />
                <input ref={inputRef} type="text" inputMode="numeric" autoComplete="off" role="combobox" aria-expanded={open}
                    aria-controls={listId} aria-labelledby={labelledBy} aria-invalid={Boolean(error)}
                    aria-activedescendant={open && shown[active] ? `${listId}-${shown[active].time}` : undefined}
                    placeholder="Ketik atau pilih, mis. 14.30" value={text} disabled={disabled}
                    onFocus={() => setOpen(true)} onClick={() => setOpen(true)}
                    onChange={(e) => { setText(e.target.value); setTyping(true); setError(''); setOpen(true); setActive(0); }}
                    onKeyDown={onKeyDown} />
                <button type="button" tabIndex={-1} aria-label="Tampilkan daftar jam" disabled={disabled}
                    onMouseDown={(e) => e.preventDefault()} onClick={() => { setOpen((o) => !o); inputRef.current?.focus(); }}>
                    <ChevronDown aria-hidden="true" />
                </button>
            </div>
            {open && (
                <ul ref={listRef} id={listId} role="listbox" className="zsp-list" aria-labelledby={labelledBy}>
                    {shown.length === 0 && <li className="zsp-list-empty">Tidak ada jam yang cocok</li>}
                    {shown.map((option, index) => (
                        <li key={option.time} id={`${listId}-${option.time}`} role="option" aria-selected={option.time === value}
                            aria-disabled={option.disabled || undefined} aria-label={`${displayTime(option.time)} ${statusOf(option)}`}
                            className={cn('zsp-opt', index === active && 'is-active', option.busyTitle && 'is-busy')}
                            onMouseDown={(e) => e.preventDefault()} onMouseEnter={() => setActive(index)} onClick={() => pick(option)}>
                            <b>{displayTime(option.time)}</b>
                            <span>{statusOf(option)}</span>
                        </li>
                    ))}
                </ul>
            )}
            {error && <p className="zsp-error" role="alert">{error}</p>}
        </div>
    );
};
