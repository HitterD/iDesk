import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronsUpDown, User, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import api from '@/lib/api';

interface RequesterOption {
    id: string;
    fullName: string;
    jobTitle?: string;
    department?: { name: string };
}

interface RequesterSelectorProps {
    /** Selected requester id; null means "saya sendiri". */
    requesterId: string | null;
    onChange: (requesterId: string | null) => void;
    currentUserId?: string;
}

/**
 * Staff-only "Requester" field: file the ticket for yourself or on behalf of
 * another user. The ticket then shows in that user's portal and in the staff
 * member's "Tiket yang saya buat".
 */
export const RequesterSelector: React.FC<RequesterSelectorProps> = ({ requesterId, onChange, currentUserId }) => {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [forOther, setForOther] = useState(requesterId !== null);

    const { data: users = [], isLoading } = useQuery<RequesterOption[]>({
        queryKey: ['users', 'approvers', currentUserId],
        queryFn: async () => {
            const url = currentUserId ? `/users/approvers?exclude=${currentUserId}` : '/users/approvers';
            const { data } = await api.get(url);
            return Array.isArray(data) ? data : [];
        },
        enabled: forOther,
    });

    const filtered = useMemo(
        () => users.filter(u => `${u.fullName} ${u.jobTitle ?? ''} ${u.department?.name ?? ''}`.toLowerCase().includes(search.toLowerCase())),
        [users, search],
    );
    const selected = users.find(u => u.id === requesterId);

    const choose = (other: boolean) => {
        setForOther(other);
        if (!other) onChange(null);
    };

    return (
        <div className="space-y-2">
            <span id="requester-selector-label" className="text-xs font-bold text-foreground flex items-center gap-1.5 tracking-wide">
                <Users className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
                Requester
            </span>
            <div role="radiogroup" aria-labelledby="requester-selector-label" className="grid grid-cols-2 gap-2">
                {[
                    { other: false, label: 'Saya sendiri' },
                    { other: true, label: 'User lain' },
                ].map(opt => (
                    <button
                        key={opt.label}
                        type="button"
                        role="radio"
                        aria-checked={forOther === opt.other}
                        onClick={() => choose(opt.other)}
                        className={cn(
                            'rounded-xl border px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            forOther === opt.other
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-border text-muted-foreground hover:bg-muted',
                        )}
                    >
                        {opt.label}
                    </button>
                ))}
            </div>

            {forOther && (
                <Popover open={open} onOpenChange={setOpen}>
                    <PopoverTrigger asChild>
                        <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={open}
                            aria-label="Pilih user requester"
                            className="h-auto min-h-11 w-full justify-between rounded-xl px-4 py-2"
                        >
                            {selected ? (
                                <span className="flex flex-col items-start overflow-hidden">
                                    <span className="w-full truncate text-left text-sm font-bold text-foreground">{selected.fullName}</span>
                                    <span className="w-full truncate text-left text-xs text-muted-foreground">
                                        {selected.jobTitle}
                                        {selected.department?.name ? ` • ${selected.department.name}` : ''}
                                    </span>
                                </span>
                            ) : (
                                <span className="text-sm text-muted-foreground">Pilih user…</span>
                            )}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] rounded-xl border-border p-2 shadow-lg">
                        <Input
                            placeholder="Cari nama, jabatan, divisi…"
                            aria-label="Cari user"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="mb-2 h-9 rounded-xl"
                            autoFocus
                        />
                        <div className="max-h-60 overflow-y-auto">
                            {isLoading && (
                                <div className="space-y-1 p-1">
                                    {Array.from({ length: 3 }, (_, i) => (
                                        <div key={i} className="h-14 animate-pulse rounded-xl bg-muted" />
                                    ))}
                                </div>
                            )}
                            {!isLoading && filtered.length === 0 && (
                                <p className="py-6 text-center text-sm text-muted-foreground">Tidak ada user yang cocok.</p>
                            )}
                            {filtered.map(u => (
                                <button
                                    key={u.id}
                                    type="button"
                                    onClick={() => {
                                        onChange(u.id);
                                        setOpen(false);
                                        setSearch('');
                                    }}
                                    className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                                        <User size={16} aria-hidden="true" />
                                    </span>
                                    <span className="flex flex-1 flex-col overflow-hidden">
                                        <span className="truncate text-sm font-bold text-foreground">{u.fullName}</span>
                                        <span className="truncate text-xs text-muted-foreground">
                                            {u.jobTitle}
                                            {u.department?.name ? ` • ${u.department.name}` : ''}
                                        </span>
                                    </span>
                                    <Check className={cn('ml-auto h-4 w-4 text-primary', requesterId === u.id ? 'opacity-100' : 'opacity-0')} />
                                </button>
                            ))}
                        </div>
                    </PopoverContent>
                </Popover>
            )}
        </div>
    );
};
