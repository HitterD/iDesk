import { Link } from 'react-router-dom';
import { ArrowRight, Star } from 'lucide-react';
import { TicketPill } from '@/components/ui/ticket-pill';
import { cn } from '@/lib/utils';
import { useCsiActive } from '../../hooks/useCsi';
import { moreSurveysText, RESPOND_COPY } from './respondCopy';

/**
 * After answering one survey: invites the respondent to the next unanswered one (e.g. CSI HC right after CSI ICT
 * in the same period). Renders nothing while loading, on error, or when nothing is left.
 */
export function NextSurveyCard({ currentId, basePath, className }: { currentId: string; basePath: string; className?: string }) {
    const { data } = useCsiActive();
    const pending = Array.isArray(data) ? data.filter((survey) => survey.id !== currentId && !survey.submitted) : [];
    if (!pending.length) return null;
    const [next] = pending;
    return (
        <section aria-label={RESPOND_COPY.nextSurveyLabel}
            className={cn('flex flex-col gap-3 rounded-2xl border border-amber-400/40 bg-amber-400/10 px-5 py-4 text-left sm:flex-row sm:items-center sm:gap-4', className)}>
            <span aria-hidden="true" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-amber-400/20 text-amber-500">
                <Star className="h-5 w-5 fill-current" />
            </span>
            <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-muted-foreground">
                    {pending.length === 1 ? RESPOND_COPY.nextSurveyLabel : moreSurveysText(pending.length)}
                </p>
                <p className="flex flex-wrap items-center gap-2 text-[15px] font-semibold text-foreground">
                    <span className="truncate">{next.title}</span>
                    <TicketPill tone={next.scope === 'HC' ? 'teal' : 'blue'}>{next.scope}</TicketPill>
                </p>
            </div>
            <Link to={`${basePath}/${encodeURIComponent(next.id)}`} className="idesk-btn is-primary is-lg shrink-0 justify-center">
                {RESPOND_COPY.nextSurveyCta}<ArrowRight aria-hidden="true" />
            </Link>
        </section>
    );
}
