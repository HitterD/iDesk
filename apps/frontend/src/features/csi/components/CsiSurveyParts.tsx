import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { m, useReducedMotion } from 'framer-motion';
import { ArrowLeft, CheckCircle2, Clock3, SearchX } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Shared card surface: generous padding, hairline border, soft shadow; tokens keep dark mode working. */
export const CSI_CARD = 'rounded-2xl border border-border/70 bg-card text-card-foreground shadow-[0_1px_2px_rgb(0_0_0/.04)]';
const ENTER_EASE = [0.22, 1, 0.36, 1] as const;
const STAGGER_SECONDS = 0.04;
const MAX_STAGGER_STEPS = 6;

/** Subtle fade + rise; MotionConfig(reducedMotion="user") and useReducedMotion both switch it off. */
export function FadeIn({ index = 0, className, children }: { index?: number; className?: string; children: ReactNode }) {
    const reduce = useReducedMotion();
    return (
        <m.div className={className}
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, ease: ENTER_EASE, delay: Math.min(index, MAX_STAGGER_STEPS) * STAGGER_SECONDS }}>
            {children}
        </m.div>
    );
}

export function BackLink({ to, label = 'Kembali ke daftar survei' }: { to: string; label?: string }) {
    return (
        <Link to={to} className="idesk-text-link">
            <ArrowLeft aria-hidden="true" />{label}
        </Link>
    );
}

type StatusTone = 'success' | 'warning' | 'muted';
const STATUS_ICONS = { success: CheckCircle2, warning: Clock3, muted: SearchX } as const;
const STATUS_TINTS: Record<StatusTone, string> = {
    success: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    warning: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
    muted: 'bg-muted text-muted-foreground',
};

/** Full-card end state: thank-you, already submitted, period ended, or not found. */
export function CsiStatusScreen({ tone, title, message, backTo }: { tone: StatusTone; title: string; message?: string; backTo: string }) {
    const Icon = STATUS_ICONS[tone];
    return (
        <FadeIn className={cn(CSI_CARD, 'mx-auto max-w-xl px-6 py-12 sm:px-10 sm:py-16 text-center')}>
            <div role="status" className="flex flex-col items-center">
                <span className={cn('mb-5 grid h-16 w-16 place-items-center rounded-full', STATUS_TINTS[tone])}>
                    <Icon className="h-8 w-8" aria-hidden="true" />
                </span>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">{title}</h1>
                {message && <p className="mt-3 max-w-md text-[15px] leading-relaxed text-muted-foreground whitespace-pre-line">{message}</p>}
                <div className="mt-8"><BackLink to={backTo} /></div>
            </div>
        </FadeIn>
    );
}
