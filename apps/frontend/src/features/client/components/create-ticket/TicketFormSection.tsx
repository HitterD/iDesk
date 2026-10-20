import type { ReactNode, ElementType } from 'react';
import { AlertCircle, ArrowLeft, CircleCheck, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PriorityHoverTip } from '@/components/ui/PriorityHoverTip';
import { PRIORITY_OPTIONS, type FormTone, type TicketTemplate } from './createTicketConfig';

const TITLE_MIN = 5;
const TITLE_MAX = 200;
const DESCRIPTION_MIN = 10;

const PRIORITY_DOT_TONE: Record<string, string> = { LOW: 'neutral', MEDIUM: 'blue', HIGH: 'amber', CRITICAL: 'red' };

/** Soft grouped panel; rows are separated by hairlines. */
export function TicketFormSection({ children, className }: { children: ReactNode; className?: string }) {
    return <div className={cn('ct-groupbox', className)}>{children}</div>;
}

/** One labelled row inside a TicketFormSection. */
export function TicketFormRow({ label, htmlFor, labelId, required, meta, children }: {
    label: ReactNode; htmlFor?: string; labelId?: string; required?: boolean; meta?: ReactNode; children: ReactNode;
}) {
    const content = <>{label}{required && <span className="ct-req" aria-hidden="true">*</span>}{meta}</>;
    return (
        <div className="ct-row">
            {htmlFor
                ? <label htmlFor={htmlFor} id={labelId} className="ct-label">{content}</label>
                : <span id={labelId} className="ct-label">{content}</span>}
            {children}
        </div>
    );
}

export function TicketFormHeader({ title, subtitle, icon: Icon, tone, onBack, draftStatus }: {
    title: string; subtitle: string; icon: ElementType; tone: FormTone; onBack: () => void; draftStatus?: ReactNode;
}) {
    return (
        <header className="ct-form-head">
            <button type="button" onClick={onBack} aria-label="Kembali ke pilihan jenis tiket" className="ct-back">
                <ArrowLeft aria-hidden="true" />
            </button>
            <span className="nav-tile ct-tile" data-tone={tone}><Icon aria-hidden="true" /></span>
            <div className="min-w-0 flex-1">
                <h1>{title}</h1>
                <p>{subtitle}</p>
            </div>
            {draftStatus}
        </header>
    );
}

export function TemplateChips({ templates, selected, onPick }: {
    templates: readonly TicketTemplate[]; selected: string | null; onPick: (template: TicketTemplate) => void;
}) {
    return (
        <div className="ct-templates" role="group" aria-label="Template cepat">
            <span className="ct-templates-label">Mulai dari template:</span>
            {templates.map(tpl => (
                <button key={tpl.label} type="button" className="ct-chip" aria-pressed={selected === tpl.label} onClick={() => onPick(tpl)}>
                    {tpl.label}
                </button>
            ))}
        </div>
    );
}

/** Live counter for a min/max text field; mirrors the previous wording for short input. */
export function CharCounter({ value, min, max }: { value: string; min: number; max: number }) {
    const trimmed = value.trim().length;
    const short = trimmed > 0 && trimmed < min;
    return (
        <small className={cn('ct-counter', short && 'is-short')} aria-live="polite">
            {short ? `Kurang ${min - trimmed} karakter (min. ${min})` : `${value.length} / ${max}`}
        </small>
    );
}

export function FieldError({ message }: { message?: string }) {
    if (!message) return null;
    return <p className="ct-field-error"><AlertCircle aria-hidden="true" /><span>{message}</span></p>;
}

export function TitleField({ id, inputRef, value, error, placeholder, onChange }: {
    id: string; inputRef: React.Ref<HTMLInputElement>; value: string; error?: string; placeholder: string; onChange: (value: string) => void;
}) {
    return (
        <TicketFormRow label="Judul" htmlFor={id} required meta={<CharCounter value={value} min={TITLE_MIN} max={TITLE_MAX} />}>
            <input id={id} ref={inputRef} type="text" required maxLength={TITLE_MAX} value={value}
                aria-invalid={Boolean(error)} onChange={e => onChange(e.target.value)}
                className={cn('ct-input', error && 'is-invalid')} placeholder={placeholder} />
            <FieldError message={error} />
        </TicketFormRow>
    );
}

export { DESCRIPTION_MIN };

export function UrgencySegment({ value, onChange, legendId }: { value: string; onChange: (priority: string) => void; legendId: string }) {
    return (
        <TicketFormRow label="Seberapa mendesak?" labelId={legendId}>
            <div role="radiogroup" aria-labelledby={legendId} className="ct-seg">
                {PRIORITY_OPTIONS.map(p => (
                    <PriorityHoverTip key={p.id} priority={p.id} side="top">
                        <button type="button" role="radio" aria-checked={value === p.id} aria-label={p.label}
                            className={cn('ct-seg-btn', value === p.id && 'is-on')} onClick={() => onChange(p.id)}>
                            <span className={`ct-dot ticket-tone-${PRIORITY_DOT_TONE[p.id]}`} aria-hidden="true" />
                            {p.shortLabel}
                        </button>
                    </PriorityHoverTip>
                ))}
            </div>
            <small className="ct-hint">Urgent: pekerjaan terganggu tapi masih ada cara lain. Blocker: pekerjaan berhenti total.</small>
        </TicketFormRow>
    );
}

export function CriticalReasonField({ id, value, onChange }: { id: string; value: string; onChange: (value: string) => void }) {
    return (
        <TicketFormRow label="Justifikasi Blocker (Critical)" htmlFor={id} required>
            <textarea id={id} required rows={2} value={value} onChange={e => onChange(e.target.value)}
                className="ct-input ct-critical" placeholder="Jelaskan mengapa masalah ini menjadi pemblokir (blocker) / berdampak kritis bagi operasional..." />
        </TicketFormRow>
    );
}

export function DraftStatus({ savedAt, onClear }: { savedAt: Date | null; onClear: () => void }) {
    const time = savedAt ? ` ${savedAt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}` : '';
    return (
        <span className="ct-saved" aria-live="polite">
            <CircleCheck aria-hidden="true" />Draf tersimpan{time}
            <button type="button" className="ct-clear" onClick={onClear}>Hapus draf</button>
        </span>
    );
}

export function SubmitBar({ draftStatus, disabled, loading, label, loadingLabel }: {
    draftStatus?: ReactNode; disabled: boolean; loading: boolean; label: string; loadingLabel: string;
}) {
    return (
        <div className="ct-submit-bar">
            {draftStatus}
            <span className="ct-spacer" />
            <span className="ct-shortcut"><kbd>Ctrl</kbd> <kbd>Enter</kbd></span>
            <button type="submit" disabled={disabled} className="idesk-cta ct-submit">
                {loading
                    ? <><span className="ct-spinner animate-spin" aria-hidden="true" /><span>{loadingLabel}</span></>
                    : <><Send aria-hidden="true" /><span>{label}</span></>}
            </button>
        </div>
    );
}

export function ErrorBanner({ message }: { message?: string }) {
    if (!message) return null;
    return (
        <div role="alert" aria-live="assertive" className="ct-alert">
            <AlertCircle aria-hidden="true" /><p>{message}</p>
        </div>
    );
}
