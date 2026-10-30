import { useEffect, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { useReducedMotion } from 'framer-motion';
import { Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { orderRatees, rateeAverage, type CsiAnswers } from '../../lib/csiForm';
import { toneClasses, type CsiTone } from '../../lib/csiTone';
import type { CsiFormRatee, SubmitCsiResponse } from '../../types';
import { CSI_CARD, FadeIn } from '../CsiSurveyParts';
import { SubjectAvatar } from './RateeAvatar';
import { averageLabel, RESPOND_COPY, thankYouName, thankYouSummary } from './respondCopy';
import { formatAverage } from '../../lib/format';

const STARS = [1, 2, 3, 4, 5] as const;
const CONFETTI_PIECES = 90;
const CONFETTI_MS = 2600;
const CONFETTI_TONES: readonly CsiTone[] = ['teal', 'amber', 'green', 'sky', 'brown'];
/** Golden-ratio spread: deterministic, evenly scattered pieces without Math.random in render. */
const SPREAD = 0.618034;
const MAX_DELAY_S = 0.4;
const BASE_FALL_S = 1.2;

/** Answers as the server received them, keyed like the form state, so averages match the review screen. */
export const answersFromPayload = (payload: SubmitCsiResponse): CsiAnswers =>
    Object.fromEntries(payload.items.map(({ periodRateeDimensionId, ...answer }) => [periodRateeDimensionId, answer]));

function pieceStyle(index: number): CSSProperties {
    const spread = (index * SPREAD) % 1;
    const jitter = ((index * 7) % 10) / 10;
    return { left: `${spread * 100}vw`, animationDelay: `${jitter * MAX_DELAY_S}s`, animationDuration: `${BASE_FALL_S + spread}s` };
}

/** Falling paper for a moment after sending; never rendered under reduced motion (and hidden by CSS as well). */
function Confetti() {
    const reduce = useReducedMotion();
    const [visible, setVisible] = useState(true);
    useEffect(() => {
        const timer = window.setTimeout(() => setVisible(false), CONFETTI_MS);
        return () => window.clearTimeout(timer);
    }, []);
    if (reduce || !visible) return null;
    return (
        <div aria-hidden="true" data-testid="csi-confetti" className="pointer-events-none fixed inset-0 z-[99] overflow-hidden">
            {Array.from({ length: CONFETTI_PIECES }, (_, index) => (
                <i key={index} style={pieceStyle(index)}
                    className={cn('csi-confetti absolute -top-5 h-3 w-2 rounded-[2px]', toneClasses(CONFETTI_TONES[index % CONFETTI_TONES.length]).fill)} />
            ))}
        </div>
    );
}

function MiniStars({ average }: { average: number | null }) {
    const filled = average === null ? 0 : Math.round(average);
    const label = average === null ? RESPOND_COPY.noScore : averageLabel(formatAverage(average));
    return (
        <span role="img" aria-label={label} className="inline-flex gap-px">
            {STARS.map((star) => (
                <Star key={star} aria-hidden="true" strokeWidth={0}
                    className={cn('h-3 w-3 fill-current', star <= filled ? toneClasses('amber').ink : 'text-muted-foreground/35')} />
            ))}
        </span>
    );
}

function SubjectSummary({ ratee, answers }: { ratee: CsiFormRatee; answers: CsiAnswers }) {
    return (
        <li className="flex items-center gap-2.5 rounded-xl bg-muted/50 p-2.5 ring-1 ring-border/60">
            <SubjectAvatar ratee={ratee} className="h-9 w-9 text-[13px]" />
            <span className="min-w-0 flex-1">
                <span className="block break-words text-[13px] font-semibold leading-[1.25] text-foreground">{ratee.displayName}</span>
                <MiniStars average={rateeAverage(ratee, answers)} />
            </span>
        </li>
    );
}

interface ThankYouScreenProps {
    ratees: CsiFormRatee[];
    payload: SubmitCsiResponse | null;
    message: string;
    basePath: string;
    onFillAgain: () => void;
}

/** After sending: drawn check, "Terima kasih, <nama>!", every subject with its average as mini stars, and confetti. */
export function ThankYouScreen({ ratees, payload, message, basePath, onFillAgain }: ThankYouScreenProps) {
    const answers = payload ? answersFromPayload(payload) : {};
    const green = toneClasses('green');
    const ordered = orderRatees(ratees);
    return (
        <FadeIn className={cn(CSI_CARD, 'mx-auto max-w-5xl px-4 py-10 text-center sm:px-10 sm:py-14')}>
            <Confetti />
            <div role="status" className="flex flex-col items-center">
                <span className={cn('csi-done-pop grid h-[84px] w-[84px] place-items-center rounded-full', green.soft, green.ink)}>
                    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-11 w-11 fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:2.6]">
                        <path className="csi-draw-check" d="M20 6 9 17l-5-5" />
                    </svg>
                </span>
                <h1 className="mt-4 text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                    {payload ? thankYouName(payload.respondentName) : RESPOND_COPY.thankYouTitle}
                </h1>
                <p className="mt-2 max-w-md text-[15px] leading-relaxed text-muted-foreground">{thankYouSummary(ordered.length)}</p>
                {message && <p className="mt-2 max-w-md whitespace-pre-line text-[15px] leading-relaxed text-muted-foreground">{message}</p>}
            </div>
            {ordered.length > 0 && (
                <ul aria-label={RESPOND_COPY.allSubjects} className="mx-auto mt-6 grid max-w-[900px] grid-cols-[repeat(auto-fill,minmax(min(220px,100%),1fr))] gap-2 text-left">
                    {ordered.map((ratee) => <SubjectSummary key={ratee.periodRateeId} ratee={ratee} answers={answers} />)}
                </ul>
            )}
            <div className="mt-8 flex flex-col items-center gap-4">
                <Button type="button" size="lg" onClick={onFillAgain}>{RESPOND_COPY.fillAgain}</Button>
                <Link to={basePath} className="idesk-text-link">{RESPOND_COPY.backToList}</Link>
            </div>
        </FadeIn>
    );
}
