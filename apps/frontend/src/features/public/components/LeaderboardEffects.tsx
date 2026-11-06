import { useEffect, useRef } from 'react';
import type { LeaderboardTheme } from '../utils/tvLeaderboard';

/** Colors for the particle themes; the gold/sapphire mix reads on both TV themes. */
const PALETTE = ['#FFC83D', '#FF9500', '#34C759', '#007AFF', '#FF2D55', '#AF52DE', '#5AC8FA'];
const GOLD = ['#FFE58A', '#FFC83D', '#F5A623', '#FFF4CC'];
/** Cap at ~60 fps; the 2 ms slack keeps a 60 Hz TV from skipping every other frame on timer jitter. */
const FRAME_MS = 1000 / 60 - 2;

interface Particle { x: number; y: number; vx: number; vy: number; size: number; color: string; life: number; spin: number; angle: number }

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const pick = <T,>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)];

/** One step of a theme: spawns new particles and moves the old ones. */
type Step = (particles: Particle[], w: number, h: number, frame: number) => void;

const STEPS: Record<Exclude<LeaderboardTheme, 'spotlight'>, Step> = {
    // Paper falling from the top, swaying.
    confetti: (p, w, _h, frame) => {
        if (frame % 2 === 0) for (let i = 0; i < 3; i++) p.push({ x: rand(0, w), y: -20, vx: rand(-1, 1), vy: rand(2, 4), size: rand(6, 12), color: pick(PALETTE), life: 600, spin: rand(-0.2, 0.2), angle: rand(0, Math.PI) });
        for (const q of p) { q.x += q.vx + Math.sin((frame + q.size) / 20); q.y += q.vy; q.angle += q.spin; q.life--; }
    },
    // Bursts from below the podium, falling with gravity.
    fireworks: (p, w, h, frame) => {
        if (frame % 45 === 0) {
            const cx = rand(w * 0.15, w * 0.85);
            const cy = rand(h * 0.12, h * 0.45);
            const color = pick(PALETTE);
            for (let i = 0; i < 70; i++) {
                const a = (Math.PI * 2 * i) / 70;
                const speed = rand(2, 6);
                p.push({ x: cx, y: cy, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, size: rand(2, 4), color, life: rand(50, 80), spin: 0, angle: 0 });
            }
        }
        for (const q of p) { q.x += q.vx; q.y += q.vy; q.vy += 0.06; q.vx *= 0.985; q.life--; }
    },
    // Streaks crossing the sky diagonally.
    shootingStars: (p, w, h, frame) => {
        if (frame % 18 === 0) p.push({ x: rand(-w * 0.2, w * 0.6), y: rand(-40, h * 0.3), vx: rand(9, 14), vy: rand(4, 7), size: rand(2, 3.5), color: pick(GOLD), life: 140, spin: 0, angle: 0 });
        if (frame % 3 === 0) p.push({ x: rand(0, w), y: rand(0, h), vx: 0, vy: 0, size: rand(1, 2.2), color: '#FFFFFF', life: rand(30, 70), spin: 0, angle: -1 });
        for (const q of p) { q.x += q.vx; q.y += q.vy; q.life--; }
    },
    // Gold glitter drifting upwards.
    goldRibbon: (p, w, h, frame) => {
        if (frame % 2 === 0) for (let i = 0; i < 2; i++) p.push({ x: rand(0, w), y: h + 10, vx: rand(-0.4, 0.4), vy: -rand(0.8, 2.2), size: rand(2, 5), color: pick(GOLD), life: 500, spin: 0.05, angle: 0 });
        for (const q of p) { q.x += q.vx + Math.sin((frame + q.y) / 40) * 0.4; q.y += q.vy; q.angle += q.spin; q.life--; }
    },
};

function drawParticle(ctx: CanvasRenderingContext2D, q: Particle, theme: LeaderboardTheme) {
    ctx.globalAlpha = Math.max(0, Math.min(1, q.life / 40));
    ctx.fillStyle = q.color;
    if (theme === 'confetti') {
        ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.angle);
        ctx.fillRect(-q.size / 2, -q.size / 4, q.size, q.size / 2);
        ctx.restore();
        return;
    }
    if (theme === 'shootingStars' && q.angle >= 0) {
        // Head plus a fading tail along the velocity.
        const grad = ctx.createLinearGradient(q.x, q.y, q.x - q.vx * 9, q.y - q.vy * 9);
        grad.addColorStop(0, q.color); grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.strokeStyle = grad; ctx.lineWidth = q.size; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(q.x - q.vx * 9, q.y - q.vy * 9); ctx.stroke();
        return;
    }
    if (theme === 'goldRibbon') {
        // Four-point sparkle.
        ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.angle);
        ctx.beginPath();
        for (let i = 0; i < 4; i++) { ctx.rotate(Math.PI / 2); ctx.lineTo(0, -q.size * 1.8); ctx.lineTo(q.size * 0.4, -q.size * 0.4); }
        ctx.closePath(); ctx.fill(); ctx.restore();
        return;
    }
    ctx.beginPath(); ctx.arc(q.x, q.y, q.size, 0, Math.PI * 2); ctx.fill();
}

/**
 * Full-screen background animation of the day's theme. Canvas for the particle themes, CSS for the
 * spotlight; nothing moves when the TV asks for reduced motion.
 */
export function LeaderboardEffects({ theme }: { theme: LeaderboardTheme }) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    useEffect(() => {
        if (reduced || theme === 'spotlight') return;
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;
        const step = STEPS[theme];
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
            step(particles, canvas.width, canvas.height, frame);
            particles = particles.filter((q) => q.life > 0 && q.y < canvas.height + 40 && q.y > -60 && q.x > -80 && q.x < canvas.width + 80);
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            for (const q of particles) drawParticle(ctx, q, theme);
            ctx.globalAlpha = 1;
        };
        raf = requestAnimationFrame(loop);
        return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
    }, [theme, reduced]);

    if (reduced) return null;
    if (theme === 'spotlight') {
        return (
            <div className="tv-lb-spotlight" aria-hidden="true">
                <span className="is-left" /><span className="is-right" />
            </div>
        );
    }
    return <canvas ref={canvasRef} className="tv-lb-canvas" data-testid="tv-leaderboard-effects" aria-hidden="true" />;
}
