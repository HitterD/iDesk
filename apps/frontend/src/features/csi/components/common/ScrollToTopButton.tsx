import { useEffect, useRef, useState } from 'react';
import { ArrowUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { scrollContainerOf } from '../../lib/scrollWithin';

const DEFAULT_THRESHOLD_PX = 320;

const scrollTopOf = (container: HTMLElement | null) => (container ? container.scrollTop : window.scrollY);
const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Floating bottom-right button that appears once the scroll area passes `threshold` px and jumps back to the top. */
export function ScrollToTopButton({ threshold = DEFAULT_THRESHOLD_PX }: { threshold?: number }) {
    const anchorRef = useRef<HTMLDivElement>(null);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const anchor = anchorRef.current;
        if (!anchor) return undefined;
        const container = scrollContainerOf(anchor);
        const target: HTMLElement | Window = container ?? window;
        const update = () => setVisible(scrollTopOf(container) > threshold);
        update();
        target.addEventListener('scroll', update, { passive: true });
        return () => target.removeEventListener('scroll', update);
    }, [threshold]);

    const scrollToTop = () => {
        const anchor = anchorRef.current;
        const container = anchor ? scrollContainerOf(anchor) : null;
        const behavior: ScrollBehavior = prefersReducedMotion() ? 'auto' : 'smooth';
        if (container) container.scrollTo({ top: 0, behavior });
        else window.scrollTo({ top: 0, behavior });
    };

    if (!visible) return <div ref={anchorRef} aria-hidden="true" className="pointer-events-none h-0" />;

    return (
        <div ref={anchorRef} className="pointer-events-none sticky bottom-4 z-30 mt-4 flex justify-end max-lg:bottom-20 print:hidden">
            <Button type="button" variant="soft" size="sm" onClick={scrollToTop} aria-label="Kembali ke atas"
                className="pointer-events-auto rounded-full border border-[hsl(var(--idesk-border)/.7)] bg-[hsl(var(--idesk-surface)/.95)] px-3.5 shadow-[var(--dash-shadow-2)] backdrop-blur-md hover:bg-[hsl(var(--idesk-surface))]">
                <ArrowUp className="h-4 w-4" aria-hidden="true" />
                <span>Ke atas</span>
            </Button>
        </div>
    );
}
