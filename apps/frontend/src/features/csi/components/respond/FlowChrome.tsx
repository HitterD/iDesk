import { createContext, useContext, useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { m, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

export type HeadingLevel = 'h1' | 'h2';

interface FlowChromeState {
    /** True once the respondent moved between screens: only then the new heading scrolls in and takes focus. */
    navigated: boolean;
    /** Live page: lift the sticky footer above the client portal's fixed bottom nav on mobile. */
    aboveBottomNav: boolean;
    /** Level of every screen title unless a heading overrides it (`h2` when embedded, e.g. a preview sheet). */
    headingLevel?: HeadingLevel;
}

export const FlowChromeContext = createContext<FlowChromeState>({ navigated: false, aboveBottomNav: false });

const SLIDE_PX = 24;
const SLIDE_SECONDS = 0.2;
const SLIDE_EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Title of the current screen. After navigation it scrolls itself into view (works in any layout's
 * scroll container) and takes focus so screen readers announce the new step. Nothing happens on first mount.
 * `scrollTarget` scrolls another element instead (a heading inside a sticky photo is a poor scroll anchor).
 */
export function ScreenHeading({ id, className, as, scrollTarget, children }: {
    id?: string; className?: string; as?: HeadingLevel; scrollTarget?: RefObject<HTMLElement | null>; children: ReactNode;
}) {
    const { navigated, headingLevel = 'h1' } = useContext(FlowChromeContext);
    const reduce = useReducedMotion();
    const ref = useRef<HTMLHeadingElement>(null);
    useEffect(() => {
        if (!navigated) return;
        (scrollTarget?.current ?? ref.current)?.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
        ref.current?.focus({ preventScroll: true });
    }, [navigated, reduce, scrollTarget]);
    const Tag = as ?? headingLevel;
    return (
        <Tag ref={ref} id={id} tabIndex={-1} className={cn('scroll-mt-24 text-foreground outline-none', className)}>{children}</Tag>
    );
}

/** 200ms slide/fade between screens; `direction` 1 = forward, -1 = back. Off under reduced motion. */
export function ScreenTransition({ screenKey, direction, children }: { screenKey: string; direction: number; children: ReactNode }) {
    const reduce = useReducedMotion();
    return (
        <m.div key={screenKey}
            initial={reduce ? false : { opacity: 0, x: direction * SLIDE_PX }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: reduce ? 0 : SLIDE_SECONDS, ease: SLIDE_EASE }}>
            {children}
        </m.div>
    );
}

/**
 * Live page while FlowFooter is sticky (below `sm`, under the fixed bottom nav): bottom room under the flow = footer
 * (~4.5rem incl. the "N pertanyaan wajib" note) + its offset above the bottom nav (6rem) + the safe area, so the last
 * field can always scroll clear of the footer. From `sm` the footer is inline, so nothing is added (and nothing at `lg`).
 */
export const LIVE_FOOTER_SPACE = 'pb-[calc(10.5rem+env(safe-area-inset-bottom))] sm:pb-0';

/**
 * Action bar: sticky to the bottom of the scroll area on mobile, inline on desktop.
 * On the live page it sits above the fixed bottom nav (5rem tall plus the create button raised ~14 px, hence the 6rem
 * offset); the flow reserves `LIVE_FOOTER_SPACE` under it.
 * On mobile it bleeds to the edges by `--flow-gutter`, which each host sets to its own horizontal padding
 * (unset = no bleed), so it never overflows a layout whose padding differs.
 */
export function FlowFooter({ note, children }: { note?: ReactNode; children: ReactNode }) {
    const { aboveBottomNav } = useContext(FlowChromeContext);
    return (
        <div className={cn('sticky z-20 mx-[calc(-1*var(--flow-gutter,0px))] border-t border-border/60 bg-background/90 px-[var(--flow-gutter,0px)] pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl',
            'sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:pb-2 sm:backdrop-blur-none',
            aboveBottomNav ? 'bottom-[calc(6rem+env(safe-area-inset-bottom))] lg:bottom-0' : 'bottom-0')}>
            {note}
            <div className="flex items-center gap-3">{children}</div>
        </div>
    );
}
