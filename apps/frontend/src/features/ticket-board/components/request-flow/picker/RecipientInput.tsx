import { useState } from 'react';
import { X } from 'lucide-react';

interface RecipientInputProps {
    value: string[];
    onChange: (names: string[]) => void;
    max?: number;
}

const DEFAULT_MAX = 20;

/** The people the items are for: type a name and press Enter or comma; each becomes a chip. */
export function RecipientInput({ value, onChange, max = DEFAULT_MAX }: RecipientInputProps) {
    const [draft, setDraft] = useState('');

    const add = (raw: string) => {
        const name = raw.trim();
        setDraft('');
        if (!name || value.length >= max) return;
        if (value.some((existing) => existing.toLowerCase() === name.toLowerCase())) return;
        onChange([...value, name.charAt(0).toUpperCase() + name.slice(1)]);
    };

    return (
        <div className="req-chipsinput">
            {value.map((name) => (
                <span key={name} className="req-chip">
                    {name}
                    <button type="button" aria-label={`Hapus ${name}`} onClick={() => onChange(value.filter((n) => n !== name))}><X aria-hidden="true" /></button>
                </span>
            ))}
            <input
                aria-label="Nama penerima" placeholder={value.length ? 'Tambah penerima lain' : 'Nama penerima, lalu Enter'} value={draft}
                onChange={(event) => (event.target.value.endsWith(',') ? add(event.target.value.slice(0, -1)) : setDraft(event.target.value))}
                onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); add(draft); } }}
                onBlur={() => add(draft)}
            />
        </div>
    );
}
