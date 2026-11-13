import { useCallback, useEffect, useId, useRef, useState, type RefObject } from 'react';
import { Check, ChevronLeft, ChevronRight, CloudCheck, LayoutGrid, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { siteTone, toneClasses, toneColor } from '../../lib/csiTone';
import type { CsiFormRatee } from '../../types';
import { SubjectAvatar } from './RateeAvatar';
import { RESPOND_COPY, railPositionText, railDoneText, railAnsweredText, popoverDoneText } from './respondCopy';

export interface SubjectRailProps {
    ratees: CsiFormRatee[];
    current: number;
    answeredCount: (index: number) => number;
    questionCount: (index: number) => number;
    onSelect: (index: number) => void;
    /** Finished subject; defaults to "every question answered". */
    done?: (index: number) => boolean;
    /** Show "Tersimpan otomatis" (off in preview, which never stores anything). */
    saved?: boolean;
}

export interface SubjectJumpItem { ratee: CsiFormRatee; index: number; answered: number; questions: number; done: boolean }
type SubjectState = SubjectJumpItem;

const SEARCH_THRESHOLD = 8;

export function buildSubjectStates(
    ratees: CsiFormRatee[],
    answeredCount: (index: number) => number,
    questionCount: (index: number) => number,
    done?: (index: number) => boolean,
): SubjectJumpItem[] {
    return ratees.map((ratee, index) => {
        const answered = answeredCount(index);
        const questions = questionCount(index);
        return { ratee, index, answered, questions, done: done ? done(index) : questions > 0 && answered >= questions };
    });
}

/** Overflow fades the rail edges so a cut-off item reads as "more this way". */
const EDGE_FADE = '[mask-image:linear-gradient(90deg,transparent,#000_24px,#000_calc(100%-24px),transparent)]';
/** One arrow press scrolls most of a rail width. */
const SCROLL_STEP = 0.7;
/** Slack for sub-pixel layouts when deciding whether the rail overflows or sits at an end. */
const EDGE_SLACK_PX = 4;
const KIND_SHORT = { TEAM: 'Tim', PERSON: 'Individu' } as const;
const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--idesk-sapphire))] focus-visible:ring-offset-2 focus-visible:ring-offset-background';

const statusText = (subject: SubjectState) => {
    if (subject.done) return RESPOND_COPY.railDone;
    return subject.answered > 0 ? railAnsweredText(subject.answered, subject.questions) : KIND_SHORT[subject.ratee.kind];
};

/**
 * Overflow and scroll-end state of the rail. ResizeObserver reports the first size on observe and every resize;
 * scrolling (arrows, auto-centre, swipe) fires `scroll`. Both re-measure.
 */
function useRailOverflow(rail: RefObject<HTMLElement | null>) {
    const [state, setState] = useState({ overflow: false, atStart: true, atEnd: true });
    useEffect(() => {
        const element = rail.current;
        if (!element) return undefined;
        const measure = () => {
            const { scrollLeft, scrollWidth, clientWidth } = element;
            const next = { overflow: scrollWidth > clientWidth + EDGE_SLACK_PX, atStart: scrollLeft < EDGE_SLACK_PX, atEnd: scrollLeft + clientWidth >= scrollWidth - EDGE_SLACK_PX };
            setState((previous) => (previous.overflow === next.overflow && previous.atStart === next.atStart && previous.atEnd === next.atEnd ? previous : next));
        };
        const observer = new ResizeObserver(measure);
        observer.observe(element);
        element.addEventListener('scroll', measure, { passive: true });
        return () => {
            observer.disconnect();
            element.removeEventListener('scroll', measure);
        };
    }, [rail]);
    return state;
}

/** Keeps the active item centred whenever the subject changes (smooth scrolling comes from CSS, off under reduced motion). */
function useCentreActive(rail: RefObject<HTMLElement | null>, current: number) {
    useEffect(() => {
        const element = rail.current;
        const active = element?.querySelector<HTMLElement>('[data-active]');
        if (!element || !active) return;
        element.scrollTo?.({ left: active.offsetLeft - element.clientWidth / 2 + active.offsetWidth / 2 });
    }, [rail, current]);
}

/** Escape (focus returns to the trigger) or a press outside `area` closes. */
function useDismiss(open: boolean, area: RefObject<HTMLElement | null>, trigger: RefObject<HTMLElement | null>, close: () => void) {
    useEffect(() => {
        if (!open) return undefined;
        const onKey = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            close();
            trigger.current?.focus();
        };
        const onPress = (event: MouseEvent) => {
            if (!area.current?.contains(event.target as Node)) close();
        };
        document.addEventListener('keydown', onKey);
        document.addEventListener('mousedown', onPress);
        return () => {
            document.removeEventListener('keydown', onKey);
            document.removeEventListener('mousedown', onPress);
        };
    }, [open, area, trigger, close]);
}

function RailHeader({ subjects, current, saved }: { subjects: SubjectState[]; current: number; saved: boolean }) {
    const total = subjects.length;
    const finished = subjects.filter((subject) => subject.done).length;
    const active = subjects[current];
    const partial = active && !active.done && active.questions > 0 ? active.answered / active.questions / total : 0;
    return (
        <div className="mb-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
            <p className="flex items-baseline gap-1.5 whitespace-nowrap text-[14px]">
                <b className="font-bold text-foreground">{railPositionText(current + 1, total)}</b>
                <span className="text-[13px] text-muted-foreground">{railDoneText(finished)}</span>
            </p>
            <div aria-hidden="true" className="flex h-1.5 min-w-0 flex-[1_1_160px] overflow-hidden rounded-full bg-muted">
                <i className={cn('block h-full transition-[width] duration-300', toneClasses('green').fill)} style={{ width: `${(finished / total) * 100}%` }} />
                <i className={cn('block h-full transition-[width] duration-300', toneClasses('amber').fill)} style={{ width: `${partial * 100}%` }} />
            </div>
            {saved && (
                <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[12px] font-medium text-muted-foreground">
                    <CloudCheck className="h-3.5 w-3.5" aria-hidden="true" />{RESPOND_COPY.autosaved}
                </span>
            )}
        </div>
    );
}

/** 42 px avatar inside a conic progress ring (amber while partial, green when done) with a number / check badge. */
function RingAvatar({ subject }: { subject: SubjectState }) {
    const progress = subject.done ? 1 : subject.questions > 0 ? Math.min(1, subject.answered / subject.questions) : 0;
    const color = toneColor(subject.done ? 'green' : 'amber');
    return (
        <span className="relative h-[42px] w-[42px] shrink-0 rounded-full p-[3px]"
            style={{ background: `conic-gradient(${color} ${progress * 360}deg, hsl(var(--border)) 0)` }}>
            <SubjectAvatar ratee={subject.ratee} className="h-9 w-9 text-[13px] ring-2 ring-card" />
            <span className={cn('absolute -bottom-[3px] -right-[3px] grid h-[18px] min-w-[18px] place-items-center rounded-full px-1 text-[10px] font-extrabold tabular-nums',
                subject.done ? cn(toneClasses('green').fill, 'text-white ring-2 ring-card') : 'bg-card text-muted-foreground ring-[1.5px] ring-border')}>
                {subject.done ? <Check data-testid="csi-rail-check" className="h-[11px] w-[11px]" strokeWidth={3} aria-hidden="true" /> : subject.index + 1}
            </span>
        </span>
    );
}

function RailItem({ subject, active, onSelect }: { subject: SubjectState; active: boolean; onSelect: () => void }) {
    const { ratee, index } = subject;
    const tone = toneClasses(siteTone(ratee.siteCode));
    return (
        <li data-active={active || undefined} className="shrink-0">
            <button type="button" onClick={onSelect} aria-current={active ? 'step' : undefined} title={`${index + 1}. ${ratee.displayName}`}
                aria-label={`${index + 1}. ${ratee.displayName}${subject.done ? `, ${RESPOND_COPY.railDoneSuffix}` : ''}`}
                className={cn('flex items-center gap-2 rounded-full p-[3px] text-left transition-colors duration-200', FOCUS_RING,
                    active ? cn(tone.soft, tone.ring, 'pr-3.5 ring-[1.5px]') : 'hover:bg-muted')}>
                <RingAvatar subject={subject} />
                {active && (
                    <span className="csi-rail-in flex min-w-0 max-w-[150px] flex-col overflow-hidden sm:max-w-[230px]">
                        <span className="line-clamp-2 text-[12.5px] font-semibold leading-[1.25] text-foreground">{ratee.displayName}</span>
                        <span className="whitespace-nowrap text-[11.5px] text-muted-foreground">{statusText(subject)}</span>
                    </span>
                )}
            </button>
        </li>
    );
}

function StatusPill({ subject }: { subject: SubjectState }) {
    const base = 'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-semibold';
    if (subject.done) {
        const green = toneClasses('green');
        return <span className={cn(base, green.soft, green.ink)}><Check className="h-3 w-3" aria-hidden="true" />{RESPOND_COPY.railDone}</span>;
    }
    if (subject.answered > 0) {
        const amber = toneClasses('amber');
        return <span className={cn(base, amber.soft, amber.ink)}>{`${subject.answered}/${subject.questions}`}</span>;
    }
    return <span className={cn(base, 'bg-muted text-muted-foreground')}>{RESPOND_COPY.railPending}</span>;
}

export function SubjectJumpBody({ subjects, current, onSelect, onClose }: {
    subjects: SubjectState[]; current: number; onSelect: (index: number) => void; onClose: () => void;
}) {
    const [query, setQuery] = useState('');
    const finished = subjects.filter((subject) => subject.done).length;
    const needle = query.trim().toLowerCase();
    const visible = needle
        ? subjects.filter((subject) => subject.ratee.displayName.toLowerCase().includes(needle) || String(subject.index + 1) === needle)
        : subjects;
    return (
        <>
            <div className="flex items-center gap-2">
                <b className="text-[14px] font-bold">{RESPOND_COPY.allSubjects}</b>
                <span className="text-[12.5px] text-muted-foreground">{popoverDoneText(finished, subjects.length)}</span>
                <button type="button" onClick={onClose} aria-label={RESPOND_COPY.close}
                    className={cn('ml-auto grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-muted', FOCUS_RING)}>
                    <X className="h-4 w-4" aria-hidden="true" />
                </button>
            </div>
            {subjects.length > SEARCH_THRESHOLD && (
                <div className="relative mt-2">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                    <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari nama atau nomor…" aria-label="Cari subjek"
                        className="h-8 w-full rounded-lg border border-border bg-background pl-8 pr-2.5 text-[12.5px] outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--idesk-sapphire))]" />
                </div>
            )}
            <div className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(min(220px,100%),1fr))] gap-1.5">
                {visible.map((subject) => (
                    <button key={subject.ratee.periodRateeId} type="button" onClick={() => onSelect(subject.index)}
                        aria-current={subject.index === current ? 'step' : undefined}
                        className={cn('flex items-center gap-2.5 rounded-xl p-2 text-left transition-colors duration-150', FOCUS_RING,
                            subject.index === current ? toneClasses(siteTone(subject.ratee.siteCode)).soft : 'hover:bg-muted')}>
                        <SubjectAvatar ratee={subject.ratee} className="h-9 w-9 text-[13px]" />
                        <span className="min-w-0 flex-1">
                            <span className="block break-words text-[12.5px] font-semibold leading-[1.25]">{`${subject.index + 1}. ${subject.ratee.displayName}`}</span>
                            <span className="block text-[12px] text-muted-foreground">{KIND_SHORT[subject.ratee.kind]}</span>
                        </span>
                        <StatusPill subject={subject} />
                    </button>
                ))}
                {!visible.length && <p className="col-span-full py-4 text-center text-[12.5px] text-muted-foreground">Tidak ada yang cocok.</p>}
            </div>
        </>
    );
}

function SubjectPopover({ id, subjects, current, onSelect, onClose }: {
    id: string; subjects: SubjectState[]; current: number; onSelect: (index: number) => void; onClose: () => void;
}) {
    return (
        <div id={id} role="dialog" aria-label={RESPOND_COPY.allSubjects}
            className="csi-pop-in absolute right-0 top-[calc(100%+6px)] z-40 max-h-[420px] w-[min(560px,100%)] max-w-[calc(100vw-24px)] origin-top-right overflow-auto rounded-2xl bg-card p-3 text-card-foreground shadow-[0_14px_38px_-12px_rgb(15_23_42/.28),0_0_0_.5px_rgb(0_0_0/.07)]">
            <SubjectJumpBody subjects={subjects} current={current} onSelect={onSelect} onClose={onClose} />
        </div>
    );
}

function ArrowButton({ side, disabled, onClick }: { side: 'left' | 'right'; disabled: boolean; onClick: () => void }) {
    const Icon = side === 'left' ? ChevronLeft : ChevronRight;
    return (
        <button type="button" onClick={onClick} disabled={disabled} aria-label={side === 'left' ? RESPOND_COPY.scrollLeft : RESPOND_COPY.scrollRight}
            className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-full bg-card text-foreground shadow-[0_1px_3px_rgb(0_0_0/.12)] disabled:opacity-35', FOCUS_RING)}>
            <Icon className="h-4 w-4" aria-hidden="true" />
        </button>
    );
}

/** Rail items with a thin separator after the last team. */
function RailList({ subjects, current, onSelect }: { subjects: SubjectState[]; current: number; onSelect: (index: number) => void }) {
    return subjects.flatMap((subject, index) => {
        const item = <RailItem key={subject.ratee.periodRateeId} subject={subject} active={index === current} onSelect={() => onSelect(index)} />;
        const afterTeams = index > 0 && subjects[index - 1].ratee.kind === 'TEAM' && subject.ratee.kind !== 'TEAM';
        return afterTeams ? [<li key="csi-rail-sep" aria-hidden="true" className="mx-1 h-7 w-px shrink-0 bg-border" />, item] : [item];
    });
}

/**
 * Subject rail (spec "Rail subjek"): one ring avatar per subject; only the current one opens its name + status.
 * Scrolls sideways (never the page) with arrows and edge fades when it overflows; "Semua N" lists everyone.
 */
export function SubjectRail({ ratees, current, answeredCount, questionCount, onSelect, done, saved = true }: SubjectRailProps) {
    const rail = useRef<HTMLOListElement>(null);
    const area = useRef<HTMLDivElement>(null);
    const trigger = useRef<HTMLButtonElement>(null);
    const popoverId = useId();
    const [open, setOpen] = useState(false);
    const close = useCallback(() => setOpen(false), []);
    const { overflow, atStart, atEnd } = useRailOverflow(rail);
    useCentreActive(rail, current);
    useDismiss(open, area, trigger, close);

    const subjects = buildSubjectStates(ratees, answeredCount, questionCount, done);
    const scrollBy = (direction: 1 | -1) => {
        rail.current?.scrollBy?.({ left: direction * rail.current.clientWidth * SCROLL_STEP });
    };
    const select = (index: number) => {
        setOpen(false);
        onSelect(index);
    };
    return (
        <div>
            <RailHeader subjects={subjects} current={current} saved={saved} />
            <div ref={area} className="relative flex items-center gap-1.5">
                {overflow && <ArrowButton side="left" disabled={atStart} onClick={() => scrollBy(-1)} />}
                <nav aria-label={RESPOND_COPY.chipsLabel} className="min-w-0 flex-1">
                    <ol ref={rail} data-testid="csi-rail"
                        className={cn('relative flex items-center gap-1.5 overflow-x-auto scroll-smooth px-0.5 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden', overflow && EDGE_FADE)}>
                        <RailList subjects={subjects} current={current} onSelect={select} />
                    </ol>
                </nav>
                {overflow && <ArrowButton side="right" disabled={atEnd} onClick={() => scrollBy(1)} />}
                <button ref={trigger} type="button" onClick={() => setOpen((previous) => !previous)} aria-label={`${RESPOND_COPY.allButton} ${ratees.length}`}
                    aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? popoverId : undefined}
                    className={cn('inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-muted px-3 text-[13px] font-medium text-foreground hover:bg-muted/70', FOCUS_RING)}>
                    <LayoutGrid className="h-4 w-4" aria-hidden="true" />
                    <span className="max-sm:hidden">{RESPOND_COPY.allButton}</span>
                    <b className="font-bold tabular-nums">{ratees.length}</b>
                </button>
                {open && <SubjectPopover id={popoverId} subjects={subjects} current={current} onSelect={select} onClose={close} />}
            </div>
        </div>
    );
}
