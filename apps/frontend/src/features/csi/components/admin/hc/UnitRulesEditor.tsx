import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useApplyCsiUnitRules, useCsiUnitOptions } from '../../../hooks/useCsiHc';
import type { CsiPeriodDetail, CsiScopeParam } from '../../../types';
import type { CsiLocationCode, CsiUnitRule } from '../../../hcTypes';
import { FIELD_LABEL, MUTED_TEXT } from '../AdminParts';
import { titleCase } from './hcFormat';

/**
 * "Per unit": each row says which respondent unit (division, optionally department / bagian / location) rates which
 * layanan (optionally one bagian). Saving rewrites the survey's raters and pairs from the rows.
 */
const ANY = '__all';
const SERVICES = [['HCC', 'HC Compensation & Benefit'], ['HCD', 'HC Development'], ['HCS', 'HC Services']] as const;
const LOCATIONS: Array<[CsiLocationCode, string]> = [['SJA1', 'SJA 1'], ['SJA2', 'SJA 2'], ['SJA3', 'SJA 3'], ['SJA4', 'SJA 4 (Semarang)'], ['JKT', 'Jakarta']];
const emptyRule = (): CsiUnitRule => ({ division: '', serviceCode: 'HCS' });

function Pick({ label, value, options, onChange, disabled, placeholder = 'Semua' }: {
    label: string; value: string | null | undefined; options: Array<[string, string]>; onChange: (value: string | null) => void;
    disabled?: boolean; placeholder?: string;
}) {
    return (
        <label className="grid min-w-0 gap-1">
            <span className="text-[11.5px] font-semibold text-[hsl(var(--idesk-text-secondary))]">{label}</span>
            <Select value={value || ANY} disabled={disabled} onValueChange={(next) => onChange(next === ANY ? null : next)}>
                <SelectTrigger className="h-9 min-w-0" aria-label={label}><SelectValue /></SelectTrigger>
                <SelectContent>
                    <SelectItem value={ANY}>{placeholder}</SelectItem>
                    {options.map(([key, text]) => <SelectItem key={key} value={key}>{text}</SelectItem>)}
                </SelectContent>
            </Select>
        </label>
    );
}

export function UnitRulesEditor({ scope, period, picBagians }: { scope: CsiScopeParam; period: CsiPeriodDetail; picBagians: Record<string, string[]> }) {
    const { data: units = [] } = useCsiUnitOptions(scope);
    const apply = useApplyCsiUnitRules(scope, period.id);
    const [rules, setRules] = useState<CsiUnitRule[]>(() => (period.unitRules?.length ? period.unitRules : [emptyRule()]));
    const divisions = useMemo(() => [...new Set(units.map((unit) => unit.division))].sort(), [units]);
    const departmentsOf = (division: string) => [...new Set(units.filter((unit) => unit.division === division && unit.department).map((unit) => unit.department!))].sort();
    const bagiansOf = (division: string, department?: string | null) =>
        [...new Set(units.filter((unit) => unit.division === division && (!department || unit.department === department) && unit.bagian).map((unit) => unit.bagian!))].sort();
    const accountsOf = (rule: CsiUnitRule) => units.filter((unit) => unit.division === rule.division && (!rule.department || unit.department === rule.department)
        && (!rule.bagian || unit.bagian === rule.bagian)).reduce((sum, unit) => sum + unit.accounts, 0);
    const update = (index: number, patch: Partial<CsiUnitRule>) => setRules((current) => current.map((rule, at) => (at === index ? { ...rule, ...patch } : rule)));
    const valid = rules.filter((rule) => rule.division && rule.serviceCode);
    const save = () => apply.mutate(valid, {
        onSuccess: (result) => toast.success(`${result.raters} penilai, ${result.pairs} pasangan dibuat${result.unmatched ? ` · ${result.unmatched} orang belum punya akun iDesk` : ''}`),
    });
    const locked = period.locked;
    return (
        <div className="grid gap-3">
            <p className={MUTED_TEXT}>Contoh: semua karyawan <b>OPERATION SJA 1</b> menilai layanan <b>HCS · GA Management</b>. Kosongkan kolom untuk "semua".</p>
            {rules.map((rule, index) => (
                <div key={index} className="grid gap-2 rounded-2xl bg-[hsl(var(--muted)/.45)] p-3 lg:grid-cols-[1.3fr_1.2fr_1.2fr_0.9fr_auto_0.8fr_1.2fr_auto] lg:items-end">
                    <Pick label="Divisi responden" value={rule.division} placeholder="Pilih divisi" disabled={locked}
                        options={divisions.map((division) => [division, titleCase(division)])}
                        onChange={(value) => update(index, { division: value ?? '', department: null, bagian: null })} />
                    <Pick label="Departemen" value={rule.department} disabled={locked || !rule.division}
                        options={departmentsOf(rule.division).map((value) => [value, titleCase(value)])} onChange={(value) => update(index, { department: value, bagian: null })} />
                    <Pick label="Bagian" value={rule.bagian} disabled={locked || !rule.division}
                        options={bagiansOf(rule.division, rule.department).map((value) => [value, titleCase(value)])} onChange={(value) => update(index, { bagian: value })} />
                    <Pick label="Lokasi" value={rule.location} disabled={locked} options={LOCATIONS} onChange={(value) => update(index, { location: value as CsiLocationCode | null })} />
                    <span aria-hidden="true" className="hidden pb-2 text-center text-[13px] font-bold text-[hsl(var(--idesk-sapphire))] lg:block">menilai →</span>
                    <Pick label="Layanan" value={rule.serviceCode} disabled={locked} placeholder="Pilih" options={SERVICES.map(([code]) => [code, code])}
                        onChange={(value) => update(index, { serviceCode: value ?? 'HCS', picBagian: null })} />
                    <Pick label="Bagian PIC" value={rule.picBagian} disabled={locked} placeholder="Semua bagian"
                        options={(picBagians[rule.serviceCode] ?? []).map((value) => [value, titleCase(value)])} onChange={(value) => update(index, { picBagian: value })} />
                    <Button variant="subtle" size="icon" disabled={locked} aria-label="Hapus aturan" onClick={() => setRules((current) => current.filter((_, at) => at !== index))}>
                        <Trash2 aria-hidden="true" />
                    </Button>
                    {rule.division && <p className="text-[11.5px] text-[hsl(var(--idesk-text-secondary))] lg:col-span-8">{`± ${accountsOf(rule)} karyawan dengan akun iDesk di unit ini`}</p>}
                </div>
            ))}
            <div className="flex flex-wrap items-center gap-2">
                <Button variant="soft" disabled={locked} onClick={() => setRules((current) => [...current, emptyRule()])}><Plus aria-hidden="true" />Tambah aturan</Button>
                <span className="flex-1" />
                <span className={FIELD_LABEL}>{`${valid.length} aturan`}</span>
                <Button variant="primary" disabled={locked || !valid.length || apply.isPending} onClick={save}>Terapkan aturan</Button>
            </div>
            <p className={MUTED_TEXT}>Menerapkan aturan MENGGANTI daftar penilai dan pasangan survei ini. Pengecualian per orang bisa diatur di tab "Cari nama" setelahnya.</p>
        </div>
    );
}
