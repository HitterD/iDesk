import type { ReactNode, ElementType } from 'react';
import { AlertCircle, ArrowLeft, Check, CircleCheck, Send, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PriorityHoverTip } from '@/components/ui/PriorityHoverTip';
import { PRIORITY_OPTIONS, templateIcon, type FormTone, type TicketTemplate } from './createTicketConfig';
import { DESCRIPTION_MIN, FIELD_LABEL, TITLE_MAX, TITLE_MIN, type TicketField } from './createTicketValidation';

/** Restarts the field's nudge on every rejected submit: the two names alternate so the animation replays. */
export const nudgeAttr = (error: string | undefined, attempt: number) => (error && attempt > 0 ? (attempt % 2 ? 'a' : 'b') : undefined);

const PRIORITY_DOT_TONE: Record<string, string> = { LOW: 'neutral', MEDIUM: 'blue', HIGH: 'amber', CRITICAL: 'red' };

/** Soft grouped panel; rows are separated by hairlines. */
export function TicketFormSection({ children, className }: { children: ReactNode; className?: string }) {
    return <div className={cn('ct-groupbox', className)}>{children}</div>;
}

/** One labelled row inside a TicketFormSection. The label holds only the field name;
 *  the required marker and live meta (counters, actions) sit beside it so the accessible name stays stable. */
export function TicketFormRow({ label, htmlFor, labelId, required, meta, children }: {
    label: ReactNode; htmlFor?: string; labelId?: string; required?: boolean; meta?: ReactNode; children: ReactNode;
}) {
    return (
        <div className="ct-row">
            <div className="ct-label">
                {htmlFor
                    ? <label htmlFor={htmlFor} id={labelId}>{label}</label>
                    : <span id={labelId}>{label}</span>}
                {required && <span className="ct-req" aria-hidden="true">*</span>}
                {meta}
            </div>
            {children}
        </div>
    );
}

export function TicketFormHeader({ title, subtitle, icon: Icon, tone, onBack }: {
    title: string; subtitle: string; icon: ElementType; tone: FormTone; onBack: () => void;
}) {
    return (
        <>
            <button type="button" onClick={onBack} className="ct-back-link">
                <ArrowLeft aria-hidden="true" />
                <span>Ganti jenis tiket</span>
            </button>
            <header className="ct-form-head">
                <span className="nav-tile ct-tile" data-tone={tone}><Icon aria-hidden="true" /></span>
                <div className="min-w-0 flex-1">
                    <h1>{title}</h1>
                    <p>{subtitle}</p>
                </div>
            </header>
        </>
    );
}

export function TemplateChips({ templates, selected, onPick }: {
    templates: readonly TicketTemplate[]; selected: string | null; onPick: (template: TicketTemplate) => void;
}) {
    return (
        <section className="ct-templates" aria-labelledby="ct-templates-label">
            <p className="ct-templates-label" id="ct-templates-label">
                <Sparkles aria-hidden="true" />
                <span><strong>Pilih template</strong> untuk mengisi judul &amp; detail otomatis</span>
            </p>
            <div className="ct-templates-list" role="group" aria-labelledby="ct-templates-label">
                {templates.map(tpl => {
                    const active = selected === tpl.label;
                    const Icon = active ? Check : templateIcon(tpl);
                    return (
                        <button key={tpl.label} type="button" className="ct-chip" aria-pressed={active} onClick={() => onPick(tpl)}
                            title={tpl.subject}>
                            <Icon aria-hidden="true" />
                            {tpl.label}
                        </button>
                    );
                })}
            </div>
        </section>
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

export function FieldError({ id, message }: { id?: string; message?: string }) {
    if (!message) return null;
    return <p id={id} className="ct-field-error"><AlertCircle aria-hidden="true" /><span>{message}</span></p>;
}

export function TitleField({ id, inputRef, value, error, attempt = 0, placeholder, onChange }: {
    id: string; inputRef: React.Ref<HTMLInputElement>; value: string; error?: string; attempt?: number; placeholder: string; onChange: (value: string) => void;
}) {
    return (
        <TicketFormRow label="Judul" htmlFor={id} required meta={<CharCounter value={value} min={TITLE_MIN} max={TITLE_MAX} />}>
            <input id={id} ref={inputRef} type="text" required maxLength={TITLE_MAX} value={value}
                aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} data-nudge={nudgeAttr(error, attempt)}
                onChange={e => onChange(e.target.value)}
                className={cn('ct-input', error && 'is-invalid')} placeholder={placeholder} />
            <FieldError id={`${id}-error`} message={error} />
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

export function CriticalReasonField({ id, inputRef, label, placeholder, value, error, attempt = 0, onChange }: {
    id: string; inputRef?: React.Ref<HTMLTextAreaElement>; label: string; placeholder: string; value: string;
    error?: string; attempt?: number; onChange: (value: string) => void;
}) {
    return (
        <TicketFormRow label={label} htmlFor={id} required>
            <textarea id={id} ref={inputRef} required rows={2} value={value} onChange={e => onChange(e.target.value)}
                aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} data-nudge={nudgeAttr(error, attempt)}
                className={cn('ct-input ct-critical', error && 'is-invalid')} placeholder={placeholder} />
            <FieldError id={`${id}-error`} message={error} />
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

/** Form-level alert. With `fields`, lists what is still missing; each name jumps to its field. */
export function ErrorBanner({ message, fields = [], onJump }: {
    message?: string; fields?: readonly TicketField[]; onJump?: (field: TicketField) => void;
}) {
    if (!message && fields.length === 0) return null;
    return (
        <div role="alert" aria-live="assertive" className="ct-alert">
            <AlertCircle aria-hidden="true" />
            <div className="ct-alert-body">
                <p>{message ?? `Lengkapi ${fields.length} isian sebelum mengirim:`}</p>
                {fields.length > 0 && (
                    <ul className="ct-alert-fields">
                        {fields.map((field) => (
                            <li key={field}><button type="button" onClick={() => onJump?.(field)}>{FIELD_LABEL[field]}</button></li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
