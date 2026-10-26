import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';
import { m, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface FlowChromeState {
    /** True once the respondent moved between screens: only then the new heading takes focus. */
    navigated: boolean;
    /** Live page: lift the sticky footer above the client portal's fixed bottom nav on mobile. */
    aboveBottomNav: boolean;
}

export const FlowChromeContext = createContext<FlowChromeState>({ navigated: false, aboveBottomNav: false });

const SLIDE_PX = 24;
const SLIDE_SECONDS = 0.2;
const SLIDE_EASE = [0.22, 1, 0.36, 1] as const;

/** Heading of the current screen; receives focus after navigation so screen readers announce the new step. */
export function ScreenHeading({ id, className, children }: { id?: string; className?: string; children: ReactNode }) {
    const { navigated } = useContext(FlowChromeContext);
    const ref = useRef<HTMLHeadingElement>(null);
    useEffect(() => {
        if (navigated) ref.current?.focus({ preventScroll: true });
    }, [navigated]);
    return (
        <h1 ref={ref} id={id} tabIndex={-1} className={cn('text-foreground outline-none', className)}>{children}</h1>
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
 * Action bar: sticky to the bottom of the scroll area on mobile, inline on desktop.
 * On the live page it sits above the fixed bottom nav (the layout already reserves `pb-28` for it).
 */
export function FlowFooter({ note, children }: { note?: ReactNode; children: ReactNode }) {
    const { aboveBottomNav } = useContext(FlowChromeContext);
    return (
        <div className={cn('sticky z-20 -mx-3.5 border-t border-border/60 bg-background/90 px-3.5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl',
            'sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:pb-2 sm:backdrop-blur-none',
            aboveBottomNav ? 'bottom-[calc(4.75rem+env(safe-area-inset-bottom))] lg:bottom-0' : 'bottom-0')}>
            {note}
            <div className="flex items-center gap-3">{children}</div>
        </div>
    );
}
