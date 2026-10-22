import React from 'react';
import { Ticket, FileSignature, HardDrive, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WIPE_DOMAIN_LABELS, WipeDomain } from '../../hooks/useDataWipe';

interface WipeScopeSelectorProps {
    selected: WipeDomain[];
    disabled: boolean;
    onChange: (domains: WipeDomain[]) => void;
}

const DOMAIN_CARDS: {
    key: WipeDomain;
    icon: React.ComponentType<{ className?: string }>;
    detail: string;
}[] = [
        {
            key: 'TICKETING',
            icon: Ticket,
            detail: 'Tiket, pesan, survei, peserta, catatan waktu, dan lampirannya.',
        },
        {
            key: 'EFORM',
            icon: FileSignature,
            detail: 'Pengajuan e-form, persetujuan, tanda tangan, dan kredensial.',
        },
        {
            key: 'HARDWARE',
            icon: HardDrive,
            detail: 'Permintaan hardware, item, jadwal instalasi, dan aset terpasang.',
        },
    ];

/**
 * Domain picker. Selecting nothing is a valid state — it simply leaves the
 * preview button disabled, which is clearer than pre-selecting all three on a
 * screen whose only action is destructive.
 */
export const WipeScopeSelector: React.FC<WipeScopeSelectorProps> = ({
    selected,
    disabled,
    onChange,
}) => {
    const toggle = (domain: WipeDomain) => {
        onChange(
            selected.includes(domain)
                ? selected.filter((d) => d !== domain)
                : [...selected, domain],
        );
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {DOMAIN_CARDS.map(({ key, icon: Icon, detail }) => {
                const isSelected = selected.includes(key);
                return (
                    <button
                        key={key}
                        type="button"
                        role="checkbox"
                        aria-checked={isSelected}
                        disabled={disabled}
                        onClick={() => toggle(key)}
                        className={cn(
                            'group relative text-left rounded-2xl border p-4 transition-all duration-150',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bad/40',
                            'disabled:opacity-50 disabled:cursor-not-allowed',
                            isSelected
                                ? 'border-bad bg-bad/10 shadow-xs'
                                : 'border-line bg-surface hover:border-line-strong',
                        )}
                    >
                        <div className="flex items-start gap-3">
                            <div
                                className={cn(
                                    'w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors',
                                    isSelected
                                        ? 'bg-bad text-white'
                                        : 'bg-fill text-ink-2',
                                )}
                            >
                                <Icon className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <h4 className="font-bold text-sm text-ink">
                                        {WIPE_DOMAIN_LABELS[key]}
                                    </h4>
                                    {isSelected && (
                                        <Check className="w-4 h-4 text-bad shrink-0" aria-hidden="true" />
                                    )}
                                </div>
                                <p className="mt-1 text-xs leading-relaxed text-ink-2">
                                    {detail}
                                </p>
                            </div>
                        </div>
                    </button>
                );
            })}
        </div>
    );
};
