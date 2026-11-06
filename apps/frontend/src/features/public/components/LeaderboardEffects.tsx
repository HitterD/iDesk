import { useEffect, useRef } from 'react';
import type { LeaderboardTheme } from '../utils/tvLeaderboard';

/** Cap at ~60 fps; the 2 ms slack keeps a 60 Hz TV from skipping every other frame on timer jitter. */
const FRAME_MS = 1000 / 60 - 2;

interface Particle { x: number; y: number; vx: number; vy: number; size: number; color: string; life: number; square: boolean }

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const pick = <T,>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)];

/** How each look fills the sky: what spawns, how it moves, and whether it is a crisp pixel or a soft dot. */
interface Recipe { colors: readonly string[]; every: number; spawn: (w: number, h: number, color: string) => Particle; gravity?: number; burst?: number }

const RECIPES: Partial<Record<LeaderboardTheme, Recipe>> = {
    // Twinkling square stars drifting down.
    pixelSpace: { colors: ['#FFFFFF', '#38F2FF', '#FF3CC7'], every: 3, spawn: (w, _h, c) => ({ x: rand(0, w), y: -10, vx: 0, vy: rand(0.6, 1.8), size: rand(3, 6), color: c, life: 900, square: true }) },
    // Pixel coins popping up from behind the podium, falling back.
    pixelSky: { colors: ['#FFD60A', '#FFFFFF'], every: 26, burst: 6, gravity: 0.12, spawn: (w, h, c) => ({ x: rand(w * 0.3, w * 0.7), y: h * 0.62, vx: rand(-2.5, 2.5), vy: -rand(5, 8), size: 7, color: c, life: 110, square: true }) },
    // Falling single-pixel "blocks" on a 16px grid.
    blockStack: { colors: ['#FFD60A', '#C77DFF', '#3A86FF', '#38E54D', '#00E5FF', '#FF4D4D'], every: 4, spawn: (w, _h, c) => ({ x: Math.round(rand(0, w) / 16) * 16, y: -16, vx: 0, vy: 2.5, size: 12, color: c, life: 900, square: true }) },
    // Fireflies rising through the forest.
    pixelForest: { colors: ['#FFF59D', '#C6FF5E', '#7BE36B'], every: 4, spawn: (w, h, c) => ({ x: rand(0, w), y: rand(h * 0.2, h), vx: rand(-0.4, 0.4), vy: -rand(0.2, 0.7), size: rand(3, 5), color: c, life: rand(120, 260), square: true }) },
    // Neon sparks floating up.
    neonCircuit: { colors: ['#38F2FF', '#B15CFF', '#FFD60A'], every: 3, spawn: (w, h, c) => ({ x: rand(0, w), y: h + 10, vx: rand(-0.3, 0.3), vy: -rand(0.8, 2), size: rand(1.5, 3), color: c, life: 500, square: false }) },
    // Cyan data motes blinking in place.
    hexTech: { colors: ['#4CE1FF', '#FFC83D'], every: 4, spawn: (w, h, c) => ({ x: rand(0, w), y: rand(0, h), vx: 0, vy: -0.3, size: rand(1.5, 2.5), color: c, life: rand(60, 140), square: false }) },
    // Welding sparks from the podium base.
    mechaSteel: { colors: ['#FFB020', '#FFE08A', '#FF7A00'], every: 9, burst: 10, gravity: 0.18, spawn: (w, h, c) => ({ x: rand(w * 0.32, w * 0.68), y: h * 0.86, vx: rand(-4, 4), vy: -rand(3, 7), size: rand(1.5, 3), color: c, life: rand(30, 60), square: false }) },
    // Streaks flying past, left to right.
    racing: { colors: ['#FF3B30', '#FFB020', '#FFFFFF'], every: 3, spawn: (_w, h, c) => ({ x: -60, y: rand(h * 0.05, h * 0.95), vx: rand(18, 30), vy: 0, size: rand(1.5, 3), color: c, life: 140, square: false }) },
};

/**
 * Full-screen particles of the day's look on a canvas (the arcade maze animates in CSS instead).
 * Nothing moves when the TV asks for reduced motion.
 */
export function LeaderboardEffects({ theme }: { theme: LeaderboardTheme }) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const recipe = RECIPES[theme];

    useEffect(() => {
        if (reduced || !recipe) return;
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;
        let particles: Particle[] = [];
        let frame = 0;
        let raf = 0;
        let last = 0;
        const resize = () => { canvas.width = canvas.clientWidth; canvas.height = canvas.clientHeight; };
        resize();
        window.addEventListener('resize', resize);
        const loop = (t: number) => {
            raf = requestAnimationFrame(loop);
            if (t - last < FRAME_MS) return;
            last = t;
            frame++;
            const { width: w, height: h } = canvas;
            if (frame % recipe.every === 0) {
                for (let i = 0; i < (recipe.burst ?? 1); i++) particles.push(recipe.spawn(w, h, pick(recipe.colors)));
            }
            for (const q of particles) { q.x += q.vx; q.y += q.vy; q.vy += recipe.gravity ?? 0; q.life--; }
            particles = particles.filter((q) => q.life > 0 && q.y < h + 40 && q.y > -60 && q.x < w + 120);
            ctx.clearRect(0, 0, w, h);
            for (const q of particles) {
                ctx.globalAlpha = Math.max(0, Math.min(1, q.life / 30));
                ctx.fillStyle = q.color;
                if (theme === 'racing') {
                    ctx.fillRect(q.x, q.y, q.vx * 3, q.size);
                } else if (q.square) {
                    // Pixel looks: whole pixels only, never anti-aliased.
                    ctx.fillRect(Math.round(q.x), Math.round(q.y), Math.round(q.size), Math.round(q.size));
                } else {
                    ctx.beginPath(); ctx.arc(q.x, q.y, q.size, 0, Math.PI * 2); ctx.fill();
                }
            }
            ctx.globalAlpha = 1;
        };
        raf = requestAnimationFrame(loop);
        return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
    }, [theme, reduced, recipe]);

    if (reduced || !recipe) return null;
    return <canvas ref={canvasRef} className="tv-lb-canvas" data-testid="tv-leaderboard-effects" aria-hidden="true" />;
}
