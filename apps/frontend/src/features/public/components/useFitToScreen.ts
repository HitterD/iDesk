import { useEffect, useState } from 'react';

/** The leaderboard is laid out once for a 1080p screen and scaled to whatever the TV browser reports. */
export const DESIGN_WIDTH = 1920;
export const DESIGN_HEIGHT = 1080;
/** Root font size the layout was tuned at (0.95vw of 1920). */
export const DESIGN_ROOT_FONT_PX = 18.24;

/** Largest scale that keeps the whole design inside the viewport (letterboxed, never cropped). */
export function fitScale(viewportWidth: number, viewportHeight: number): number {
    if (viewportWidth <= 0 || viewportHeight <= 0) return 1;
    return Math.min(viewportWidth / DESIGN_WIDTH, viewportHeight / DESIGN_HEIGHT);
}

const FIT_STYLE_ID = 'tv-leaderboard-design-rem';

/**
 * While the leaderboard is up, rem is pinned to the size the layout was designed at, so the
 * 1920x1080 frame always holds the same content; the frame is then scaled to the screen.
 * (The queue board's own clamp would otherwise bottom out at 14px on a 720p TV browser and overflow.)
 */
export function useDesignRem(): void {
    useEffect(() => {
        const style = document.createElement('style');
        style.id = FIT_STYLE_ID;
        style.textContent = `html { font-size: ${DESIGN_ROOT_FONT_PX}px !important; }`;
        document.head.appendChild(style);
        return () => style.remove();
    }, []);
}

/** Current fit scale, following window resizes and TV browser zoom changes. */
export function useFitToScreen(): number {
    const read = () => (typeof window === 'undefined' ? 1 : fitScale(window.innerWidth, window.innerHeight));
    const [scale, setScale] = useState(read);
    useEffect(() => {
        const update = () => setScale(read());
        update();
        window.addEventListener('resize', update);
        return () => window.removeEventListener('resize', update);
    }, []);
    return scale;
}
