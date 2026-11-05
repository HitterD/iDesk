import { CalendarClock, Info, Lock, Users } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { countDimensions } from '../../lib/csiForm';
import { formatDate } from '../../lib/format';
import { estimateMinutes } from '../../lib/wizard';
import type { CsiOpenForm } from '../../types';
import { CSI_CARD } from '../CsiSurveyParts';
import { FlowFooter, ScreenHeading } from './FlowChrome';
import { deadlineText, RESPOND_COPY, summaryText } from './respondCopy';

interface IntroScreenProps {
    form: CsiOpenForm;
    departmentId: string;
    onDepartmentChange: (id: string) => void;
    /** The department comes from the account (earlier answer or HR profile) and cannot be changed. */
    departmentLocked: boolean;
    canStart: boolean;
    onStart: () => void;
    /** Live survey without any active department: nothing can be submitted, so explain instead of a dead button. */
    unavailable: boolean;
}

const LABEL = 'text-[13px] font-medium text-muted-foreground';
const LOCKED_FIELD = 'flex h-11 items-center gap-2 rounded-xl border border-border/70 bg-muted/50 px-3.5 text-[15px] font-medium text-foreground';

/** Read-only identity value with a lock icon (name always; department once known). */
function LockedValue({ id, label, value }: { id: string; label: string; value: string }) {
    return (
        <div className="space-y-1.5">
            <p id={`${id}-label`} className={LABEL}>{label}</p>
            <div id={id} role="textbox" aria-readonly="true" aria-labelledby={`${id}-label`} className={LOCKED_FIELD}>
                <span className="min-w-0 flex-1 truncate">{value}</span>
                <Lock className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </div>
        </div>
    );
}

function DepartmentField({ departments, value, onChange }: { departments: CsiOpenForm['departments']; value: string; onChange: (id: string) => void }) {
    return (
        <div className="space-y-1.5">
            <label id="csi-department-label" htmlFor="csi-department" className={LABEL}>{RESPOND_COPY.department}</label>
            <Select value={value || undefined} onValueChange={onChange}>
                <SelectTrigger id="csi-department" aria-labelledby="csi-department-label" className="h-11 bg-card dark:bg-card">
                    <SelectValue placeholder={RESPOND_COPY.departmentPlaceholder} />
                </SelectTrigger>
                <SelectContent>
                    {departments.map((department) => (
                        <SelectItem key={department.id} value={department.id}>{department.name}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <p className="text-[12.5px] text-muted-foreground">{RESPOND_COPY.departmentOnce}</p>
        </div>
    );
}

const FACT = 'flex items-center gap-2.5 text-[14px] text-muted-foreground';

export function IntroScreen({ form, departmentId, onDepartmentChange, departmentLocked, canStart, onStart, unavailable }: IntroScreenProps) {
    const minutes = estimateMinutes(countDimensions(form));
    const hasTeam = form.ratees.some((ratee) => ratee.kind === 'TEAM');
    const people = form.ratees.filter((ratee) => ratee.kind === 'PERSON').length;
    const departmentName = form.departments.find((department) => department.id === departmentId)?.name ?? RESPOND_COPY.noScore;
    return (
        <div className="space-y-5 sm:space-y-6">
            <header className="space-y-3">
                <ScreenHeading className="text-2xl sm:text-[28px] font-bold leading-tight tracking-tight">{form.title}</ScreenHeading>
                {form.intro && <p className="text-[15px] leading-relaxed text-muted-foreground whitespace-pre-line">{form.intro}</p>}
                <ul className="space-y-1.5 pt-1">
                    <li className={FACT}><Users className="h-4 w-4 shrink-0" aria-hidden="true" />{summaryText(people, minutes, hasTeam ? form.teamLabel : null)}</li>
                    <li className={FACT}><CalendarClock className="h-4 w-4 shrink-0" aria-hidden="true" />{deadlineText(formatDate(form.endDate))}</li>
                </ul>
            </header>

            <section aria-labelledby="csi-identity-heading" className={cn(CSI_CARD, 'p-6 sm:p-10')}>
                <h2 id="csi-identity-heading" className="text-[15px] font-semibold text-foreground">{RESPOND_COPY.identity}</h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <LockedValue id="csi-respondent-name" label={RESPOND_COPY.name} value={form.respondent.fullName} />
                    {!unavailable && (departmentLocked
                        ? <LockedValue id="csi-department" label={RESPOND_COPY.department} value={departmentName} />
                        : <DepartmentField departments={form.departments} value={departmentId} onChange={onDepartmentChange} />)}
                </div>
                <p className="mt-4 flex items-start gap-2 text-[13px] text-muted-foreground">
                    <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{RESPOND_COPY.identityLocked}
                </p>
                {unavailable && (
                    <p role="status" className="mt-4 flex items-start gap-2 rounded-xl bg-muted px-4 py-3 text-[14px] text-muted-foreground">
                        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{RESPOND_COPY.notReady}
                    </p>
                )}
            </section>

            {!unavailable && (
                <FlowFooter>
                    <button type="button" className="idesk-cta ct-submit w-full justify-center sm:ml-auto sm:w-auto" disabled={!canStart} onClick={onStart}>
                        {RESPOND_COPY.start}
                    </button>
                </FlowFooter>
            )}
        </div>
    );
}

