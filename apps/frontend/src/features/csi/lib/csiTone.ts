/** CSI colour language (spec "Bahasa warna"): per site, per question and per score, all from the --ticket-* tokens. */
export type CsiTone = 'green' | 'amber' | 'red' | 'teal' | 'sky' | 'brown' | 'navy' | 'neutral';
export interface CsiToneClasses { fill: string; ink: string; soft: string; ring: string }

/** Score thresholds on the 1–5 scale: >= 4.5 green, >= 4.0 amber, below red. */
export const CSI_SCORE_GOOD = 4.5;
export const CSI_SCORE_FAIR = 4;

const SITE_TONES: Readonly<Record<string, CsiTone>> = { SPJ: 'teal', KRW: 'brown', SMG: 'green', JKT: 'sky' };
const QUESTION_TONES: readonly CsiTone[] = ['sky', 'teal', 'brown', 'amber'];

/** Index = star count (1–5); index 0 is the empty state. Emoji appear only in the star reaction. */
export const STAR_EMOJI = ['', '😞', '😕', '😐', '😊', '🤩'] as const;
export const STAR_LABELS = ['', 'Sangat kurang', 'Kurang', 'Cukup', 'Puas', 'Luar biasa!'] as const;

export type CsiScoreWord = 'Sangat puas' | 'Puas' | 'Perlu perbaikan';

export function siteTone(code: string | null): CsiTone {
    return (code && SITE_TONES[code.toUpperCase()]) || 'neutral';
}

export function scoreTone(avg: number | null): CsiTone {
    if (avg === null) return 'neutral';
    if (avg >= CSI_SCORE_GOOD) return 'green';
    return avg >= CSI_SCORE_FAIR ? 'amber' : 'red';
}

/** Star or scale points (1–5): 1–2 red, 3 amber, 4–5 green; nothing chosen = neutral. */
const STAR_LOW_MAX = 2;
const STAR_MID = 3;
export function starTone(points: number | null | undefined): CsiTone {
    if (!points) return 'neutral';
    if (points <= STAR_LOW_MAX) return 'red';
    return points === STAR_MID ? 'amber' : 'green';
}

export function questionTone(index: number): CsiTone {
    const length = QUESTION_TONES.length;
    return QUESTION_TONES[((index % length) + length) % length];
}

export function scoreWord(avg: number): CsiScoreWord {
    if (avg >= CSI_SCORE_GOOD) return 'Sangat puas';
    return avg >= CSI_SCORE_FAIR ? 'Puas' : 'Perlu perbaikan';
}

// Tailwind only generates classes it can see as literal strings, so every tone is spelled out.
const TONE_CLASSES: Readonly<Record<CsiTone, CsiToneClasses>> = {
    green: {
        fill: 'bg-[hsl(var(--ticket-green))]', ink: 'text-[hsl(var(--ticket-green-ink))]',
        soft: 'bg-[hsl(var(--ticket-green)/var(--ticket-tint))]', ring: 'ring-[hsl(var(--ticket-green))]',
    },
    amber: {
        fill: 'bg-[hsl(var(--ticket-amber))]', ink: 'text-[hsl(var(--ticket-amber-ink))]',
        soft: 'bg-[hsl(var(--ticket-amber)/var(--ticket-tint))]', ring: 'ring-[hsl(var(--ticket-amber))]',
    },
    red: {
        fill: 'bg-[hsl(var(--ticket-red))]', ink: 'text-[hsl(var(--ticket-red-ink))]',
        soft: 'bg-[hsl(var(--ticket-red)/var(--ticket-tint))]', ring: 'ring-[hsl(var(--ticket-red))]',
    },
    teal: {
        fill: 'bg-[hsl(var(--ticket-teal))]', ink: 'text-[hsl(var(--ticket-teal-ink))]',
        soft: 'bg-[hsl(var(--ticket-teal)/var(--ticket-tint))]', ring: 'ring-[hsl(var(--ticket-teal))]',
    },
    sky: {
        fill: 'bg-[hsl(var(--ticket-sky))]', ink: 'text-[hsl(var(--ticket-sky-ink))]',
        soft: 'bg-[hsl(var(--ticket-sky)/var(--ticket-tint))]', ring: 'ring-[hsl(var(--ticket-sky))]',
    },
    brown: {
        fill: 'bg-[hsl(var(--ticket-brown))]', ink: 'text-[hsl(var(--ticket-brown-ink))]',
        soft: 'bg-[hsl(var(--ticket-brown)/var(--ticket-tint))]', ring: 'ring-[hsl(var(--ticket-brown))]',
    },
    navy: {
        fill: 'bg-[hsl(var(--ticket-navy))]', ink: 'text-[hsl(var(--ticket-navy-ink))]',
        soft: 'bg-[hsl(var(--ticket-navy)/var(--ticket-tint))]', ring: 'ring-[hsl(var(--ticket-navy))]',
    },
    neutral: {
        fill: 'bg-[hsl(var(--ticket-neutral))]', ink: 'text-[hsl(var(--ticket-neutral-ink))]',
        soft: 'bg-[hsl(var(--ticket-neutral)/var(--ticket-tint))]', ring: 'ring-[hsl(var(--ticket-neutral))]',
    },
};

export function toneClasses(tone: CsiTone): CsiToneClasses {
    return TONE_CLASSES[tone];
}
