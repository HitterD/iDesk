import { CalendarClock, Info, Users } from 'lucide-react';
import { Input } from '@/components/ui/input';
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
    canStart: boolean;
    onStart: () => void;
    /** Live survey without any active department: nothing can be submitted, so explain instead of a dead button. */
    unavailable: boolean;
}

function DepartmentField({ departments, value, onChange }: { departments: CsiOpenForm['departments']; value: string; onChange: (id: string) => void }) {
    return (
        <div className="space-y-1.5">
            <label id="csi-department-label" htmlFor="csi-department" className="text-[13px] font-medium text-muted-foreground">{RESPOND_COPY.department}</label>
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
        </div>
    );
}

const FACT = 'flex items-center gap-2.5 text-[14px] text-muted-foreground';

export function IntroScreen({ form, departmentId, onDepartmentChange, canStart, onStart, unavailable }: IntroScreenProps) {
    const minutes = estimateMinutes(countDimensions(form));
    return (
        <div className="space-y-5 sm:space-y-6">
            <header className="space-y-3">
                <ScreenHeading className="text-2xl sm:text-[28px] font-bold leading-tight tracking-tight">{form.title}</ScreenHeading>
                {form.intro && <p className="text-[15px] leading-relaxed text-muted-foreground whitespace-pre-line">{form.intro}</p>}
                <ul className="space-y-1.5 pt-1">
                    <li className={FACT}><Users className="h-4 w-4 shrink-0" aria-hidden="true" />{summaryText(form.ratees.length, minutes)}</li>
                    <li className={FACT}><CalendarClock className="h-4 w-4 shrink-0" aria-hidden="true" />{deadlineText(formatDate(form.endDate))}</li>
                </ul>
            </header>

            <section aria-labelledby="csi-identity-heading" className={cn(CSI_CARD, 'p-5 sm:p-7')}>
                <h2 id="csi-identity-heading" className="text-[15px] font-semibold text-foreground">{RESPOND_COPY.identity}</h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <label htmlFor="csi-respondent-name" className="text-[13px] font-medium text-muted-foreground">{RESPOND_COPY.name}</label>
                        <Input id="csi-respondent-name" value={form.respondent.fullName} readOnly
                            className="h-11 rounded-xl bg-muted/50 text-foreground cursor-default focus-visible:ring-0 focus-visible:ring-offset-0" />
                    </div>
                    {!unavailable && <DepartmentField departments={form.departments} value={departmentId} onChange={onDepartmentChange} />}
                </div>
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
