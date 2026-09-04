import { useEffect, useRef } from 'react';

export const SCROLL_SPEED_PX_PER_SEC = 40;
export const PAUSE_MS = 2000;

export type AutoScrollPhase = 'pause-top' | 'down' | 'pause-bottom' | 'up';

export interface AutoScrollState {
    phase: AutoScrollPhase;
    scrollTop: number;
    elapsedMs: number;
}

export function stepAutoScroll(
    state: AutoScrollState,
    deltaMs: number,
    maxScroll: number,
): AutoScrollState {
    if (maxScroll <= 0) {
        return { phase: 'pause-top', scrollTop: 0, elapsedMs: 0 };
    }

    if (state.phase === 'pause-top' && state.elapsedMs + deltaMs >= PAUSE_MS) {
        return { phase: 'down', scrollTop: 0, elapsedMs: 0 };
    }

    if (state.phase === 'pause-bottom' && state.elapsedMs + deltaMs >= PAUSE_MS) {
        return { phase: 'up', scrollTop: maxScroll, elapsedMs: 0 };
    }

    if (state.phase === 'pause-top' || state.phase === 'pause-bottom') {
        return { ...state, elapsedMs: state.elapsedMs + deltaMs };
    }

    const distance = (SCROLL_SPEED_PX_PER_SEC * deltaMs) / 1000;
    const scrollTop = state.phase === 'down'
        ? Math.min(state.scrollTop + distance, maxScroll)
        : Math.max(state.scrollTop - distance, 0);

    if (state.phase === 'down' && scrollTop >= maxScroll) {
        return { phase: 'pause-bottom', scrollTop: maxScroll, elapsedMs: 0 };
    }

    if (state.phase === 'up' && scrollTop <= 0) {
        return { phase: 'pause-top', scrollTop: 0, elapsedMs: 0 };
    }

    return { ...state, scrollTop };
}

export function useColumnAutoScroll<T extends HTMLElement>(deps?: any) {
    const ref = useRef<T>(null);
    const isHoveredRef = useRef(false);

    useEffect(() => {
        let frameId = 0;
        let lastTimestamp: number | null = null;
        let state: AutoScrollState = { phase: 'pause-top', scrollTop: 0, elapsedMs: 0 };

        const element = ref.current;
        if (element) {
            element.scrollTop = 0;
        }

        const handleMouseEnter = () => { isHoveredRef.current = true; };
        const handleMouseLeave = () => { isHoveredRef.current = false; };

        if (element) {
            element.addEventListener('mouseenter', handleMouseEnter);
            element.addEventListener('mouseleave', handleMouseLeave);
        }

        const tick = (timestamp: number) => {
            const el = ref.current;
            const deltaMs = lastTimestamp === null ? 0 : Math.min(timestamp - lastTimestamp, 100);
            lastTimestamp = timestamp;

            if (el && !isHoveredRef.current) {
                const maxScroll = Math.max(0, el.scrollHeight - el.clientHeight);
                state = stepAutoScroll(state, deltaMs, maxScroll);
                el.scrollTop = Math.round(state.scrollTop);
            }

            frameId = requestAnimationFrame(tick);
        };

        frameId = requestAnimationFrame(tick);
        return () => {
            cancelAnimationFrame(frameId);
            if (element) {
                element.removeEventListener('mouseenter', handleMouseEnter);
                element.removeEventListener('mouseleave', handleMouseLeave);
            }
        };
    }, [deps]);

    return ref;
}

export default useColumnAutoScroll;
