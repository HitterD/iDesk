import { useLayoutEffect, useRef, type ElementType, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface SegmentedOption<V extends string> {
    value: V;
    label: ReactNode;
    icon?: ElementType;
    /** Tooltip / accessible hint when the label collapses to an icon. */
    title?: string;
}

export interface SegmentedControlProps<V extends string> {
    options: readonly SegmentedOption<V>[];
    /** Selected value; `null` renders no selected segment (and no thumb). */
    value: V | null;
    /** Receives the clicked segment, including the already-selected one (callers may toggle). */
    onValueChange: (value: V) => void;
    'aria-label': string;
    className?: string;
}

const ARROW_STEP: Readonly<Record<string, number>> = { ArrowRight: 1, ArrowLeft: -1 };

/**
 * Pressed-button group with one thumb that slides behind the selected segment (mockup `motion.js`).
 * Duration comes from `--dur-3`, so prefers-reduced-motion (which zeroes it) makes the move instant.
 */
export function SegmentedControl<V extends string>({
    options, value, onValueChange, 'aria-label': ariaLabel, className,
}: SegmentedControlProps<V>) {
    const groupRef = useRef<HTMLDivElement>(null);
    const thumbRef = useRef<HTMLSpanElement>(null);
    const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);
    const placedRef = useRef(false);
    const selectedIndex = options.findIndex((option) => option.value === value);

    useLayoutEffect(() => {
        const thumb = thumbRef.current;
        const group = groupRef.current;
        if (!thumb || !group) return undefined;
        const place = (instant: boolean) => {
            const on = buttonRefs.current[selectedIndex];
            thumb.hidden = !on;
            if (!on) return;
            thumb.classList.toggle('is-instant', instant);
            thumb.style.width = `${on.offsetWidth}px`;
            thumb.style.height = `${on.offsetHeight}px`;
            thumb.style.transform = `translate(${on.offsetLeft}px, ${on.offsetTop}px)`;
            if (instant) requestAnimationFrame(() => thumb.classList.remove('is-instant'));
        };
        place(!placedRef.current);
        placedRef.current = true;
        const observer = new ResizeObserver(() => place(true));
        observer.observe(group);
        return () => observer.disconnect();
    }, [selectedIndex, options.length]);

    const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
        const step = ARROW_STEP[event.key];
        if (!step) return;
        event.preventDefault();
        buttonRefs.current[(index + step + options.length) % options.length]?.focus();
    };

    return (
        <div ref={groupRef} role="group" aria-label={ariaLabel} className={cn('portal-seg has-thumb', className)}>
            <span ref={thumbRef} className="seg-thumb" aria-hidden="true" />
            {options.map((option, index) => {
                const Icon = option.icon;
                const selected = index === selectedIndex;
                return (
                    <button
                        key={option.value}
                        ref={(el) => { buttonRefs.current[index] = el; }}
                        type="button"
                        title={option.title}
                        aria-pressed={selected}
                        className={cn('portal-seg-btn', selected && 'is-active')}
                        onClick={() => onValueChange(option.value)}
                        onKeyDown={(event) => handleKeyDown(event, index)}
                    >
                        {Icon && <Icon className="w-3.5 h-3.5" aria-hidden="true" />}
                        {option.label}
                    </button>
                );
            })}
        </div>
    );
}
