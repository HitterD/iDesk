import { MAX12_KINDS, PERMANENT_KINDS, durationDays, periodPresets, presetDates, type EformKind } from './eformRules';

interface PeriodPickerProps {
    kind: EformKind;
    from: string;
    to: string;
    onChange: (period: { from: string; to: string }) => void;
}

const MAX_DAYS = 366;
const day = new Intl.DateTimeFormat('id-ID', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' });
const show = (value: string): string => day.format(new Date(`${value}T00:00:00Z`));

/** "Berapa lama?": quick presets, a start and an end date, and a plain sentence saying what that comes to. */
export function PeriodPicker({ kind, from, to, onChange }: PeriodPickerProps) {
    const permanentAllowed = PERMANENT_KINDS.includes(kind);
    const days = to ? durationDays(from, to) : null;
    const tooLong = days !== null && MAX12_KINDS.includes(kind) && days > MAX_DAYS;

    return (
        <div className="req-period">
            <div className="req-period__chips">
                {periodPresets(kind).map(([label, code]) => (
                    <button
                        key={code} type="button" className={code === 'perm' && !to ? 'is-on' : ''}
                        onClick={() => onChange({ from, to: presetDates(from, code) ?? '' })}
                    >
                        {label}
                    </button>
                ))}
            </div>
            <div className="req-period__dates">
                <label className="req-dialog__field">
                    <span>Mulai *</span>
                    <input type="date" aria-label="Mulai" value={from} onChange={(event) => onChange({ from: event.target.value, to })} />
                </label>
                <label className="req-dialog__field">
                    <span>Sampai {permanentAllowed ? <em>(kosongkan bila permanen)</em> : '*'}</span>
                    <input type="date" aria-label="Sampai" value={to} min={from} onChange={(event) => onChange({ from, to: event.target.value })} />
                </label>
            </div>
            <p className="req-period__sum">
                {days === null && permanentAllowed && <span className="req-pill-ok">Permanen</span>}
                {days !== null && days < 0 && <span className="req-dialog__error-inline">Tanggal selesai sebelum mulai</span>}
                {days !== null && days >= 0 && (
                    <>Masa berlaku <b>{days} hari</b> · {show(from)} – {show(to)}{tooLong && <span className="req-dialog__error-inline"> — melebihi 12 bulan</span>}</>
                )}
            </p>
        </div>
    );
}
