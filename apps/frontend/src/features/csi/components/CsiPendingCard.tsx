import { Link } from 'react-router-dom';
import { ArrowRight, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/stores/useAuth';
import { hasDraft } from '../lib/surveyDraft';
import { useCsiActive } from '../hooks/useCsi';
import { useCsiBasePath } from '../lib/useCsiBasePath';
import { CSI_CARD, FadeIn } from './CsiSurveyParts';

/** Nudge shown only while at least one active survey is still unanswered; silent on loading/error. */
export function CsiPendingCard({ className }: { className?: string }) {
    const basePath = useCsiBasePath();
    const { user } = useAuth();
    const { data } = useCsiActive();
    const pending = Array.isArray(data) ? data.filter((survey) => !survey.submitted) : [];
    if (!pending.length) return null;

    const [first] = pending;
    const target = pending.length === 1 ? `${basePath}/${encodeURIComponent(first.id)}` : basePath;
    const title = pending.length === 1 ? first.title : `${pending.length} survei belum diisi`;

    return (
        <FadeIn className={className}>
            <section aria-label="Ada survei menunggu"
                className={cn(CSI_CARD, 'flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:gap-4')}>
                <span aria-hidden="true" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-amber-400/15 text-amber-500">
                    <Star className="h-5 w-5 fill-current" />
                </span>
                <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-muted-foreground">Ada survei menunggu</p>
                    <p className="truncate text-[15px] font-semibold text-foreground">{title}</p>
                </div>
                <Link to={target} className="idesk-btn is-primary is-lg shrink-0 justify-center">
                    {user && pending.some((survey) => hasDraft(user.id, survey.id)) ? 'Lanjutkan' : 'Isi Survei'}<ArrowRight aria-hidden="true" />
                </Link>
            </section>
        </FadeIn>
    );
}

export default CsiPendingCard;
