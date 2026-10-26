import { SearchablePicker } from '@/components/ui/searchable-picker';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { formatDateRange } from '../../lib/format';
import { formatSites } from '../../lib/location';
import type { PeriodFormState } from '../../lib/periodForm';
import type { CsiPeriodListItem } from '../../types';
import { WIZARD_COPY } from '../wizard/wizardCopy';
import { FIELD_LABEL, MUTED_TEXT } from './AdminParts';

type StartMode = 'blank' | 'copy';
const START_OPTIONS = [
    { value: 'blank', label: WIZARD_COPY.startBlank },
    { value: 'copy', label: WIZARD_COPY.copyPrevious },
] as const;

/** Create only: "Mulai kosong" or "Salin dari survei sebelumnya" plus the source picker. */
export function CopySourceField({ form, periods, onModeChange, onSourceChange }: {
    form: PeriodFormState; periods: readonly CsiPeriodListItem[];
    onModeChange: (copying: boolean) => void; onSourceChange: (id: string) => void;
}) {
    if (!periods.length) return null;
    const options = periods.map((item) => ({
        value: item.id, label: item.title, description: `${formatSites(item.sites)} · ${formatDateRange(item.startDate, item.endDate)}`,
    }));
    return (
        <div className="grid gap-3">
            <SegmentedControl<StartMode> aria-label="Cara memulai" className="dash-seg w-fit" options={START_OPTIONS}
                value={form.copying ? 'copy' : 'blank'} onValueChange={(value) => onModeChange(value === 'copy')} />
            {form.copying && (
                <div className="grid gap-1.5 rounded-2xl bg-[hsl(var(--muted)/.45)] p-4">
                    <span className={FIELD_LABEL}>{WIZARD_COPY.copySource}</span>
                    <SearchablePicker label={WIZARD_COPY.copySource} value={form.copyFromPeriodId} options={options} onValueChange={onSourceChange}
                        placeholder="Pilih survei" searchPlaceholder="Cari survei…" triggerClassName="min-h-9 w-full sm:max-w-md" />
                    <span className={MUTED_TEXT}>{WIZARD_COPY.copyHint}</span>
                </div>
            )}
        </div>
    );
}
