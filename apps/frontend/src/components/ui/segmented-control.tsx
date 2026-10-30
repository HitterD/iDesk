import { useLayoutEffect, useRef, type ElementType, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

export interface SegmentedOption<V extends string> {
    value: V;
    label: ReactNode;
    icon?: ElementType;
    /** Tooltip / accessible hint when the label collapses to an icon. */
    title?: string;
    /** Accessible name override (e.g. when the visible label hides on mobile). */
    ariaLabel?: string;
    /**
     * Renders the segment as a link (e.g. Kanban | Tabel). Plain clicks are reported through
     * `onValueChange` with the default prevented, so the caller can let the thumb arrive before
     * navigating; modified clicks (new tab/window) keep native link behaviour.
     */
    href?: string;
}

export interface SegmentedControlProps<V extends string> {
    options: readonly SegmentedOption<V>[];
    /** Selected value; `null` renders no selected segment (and no thumb). */
    value: V | null;
    /** Receives the clicked segment, including the already-selected one (callers may toggle). */
    onValueChange: (value: V) => void;
    'aria-label': string;
    className?: string;
    /** Disables every button segment (link segments are unaffected). */
    disabled?: boolean;
}

const ARROW_STEP: Readonly<Record<string, number>> = { ArrowRight: 1, ArrowLeft: -1 };
const isModifiedClick = (event: MouseEvent) => event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;

/**
 * Pressed-button group with one thumb that slides behind the selected segment (mockup `motion.js`).
 * Duration comes from `--dur-3`, so prefers-reduced-motion (which zeroes it) makes the move instant.
 */
export function SegmentedControl<V extends string>({
    options, value, onValueChange, 'aria-label': ariaLabel, className, disabled,
}: SegmentedControlProps<V>) {
    const groupRef = useRef<HTMLDivElement>(null);
    const thumbRef = useRef<HTMLSpanElement>(null);
    const itemRefs = useRef<Array<HTMLElement | null>>([]);
    const placedRef = useRef(false);
    const selectedIndex = options.findIndex((option) => option.value === value);

    useLayoutEffect(() => {
        const thumb = thumbRef.current;
        const group = groupRef.current;
        if (!thumb || !group) return undefined;
        const place = (instant: boolean) => {
            const on = itemRefs.current[selectedIndex];
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

    const handleKeyDown = (event: KeyboardEvent<HTMLElement>, index: number) => {
        const step = ARROW_STEP[event.key];
        if (!step) return;
        event.preventDefault();
        itemRefs.current[(index + step + options.length) % options.length]?.focus();
    };

    return (
        <div ref={groupRef} role="group" aria-label={ariaLabel} className={cn('portal-seg has-thumb', disabled && 'opacity-60 cursor-not-allowed', className)}>
            <span ref={thumbRef} className="seg-thumb" aria-hidden="true" />
            {options.map((option, index) => {
                const Icon = option.icon;
                const selected = index === selectedIndex;
                const content = (
                    <>
                        {Icon && <Icon className="w-3.5 h-3.5" aria-hidden="true" />}
                        {option.label}
                    </>
                );
                const shared = {
                    title: option.title,
                    'aria-label': option.ariaLabel,
                    className: cn('portal-seg-btn', selected && 'is-active'),
                    onKeyDown: (event: KeyboardEvent<HTMLElement>) => handleKeyDown(event, index),
                };
                if (option.href) {
                    return (
                        <Link
                            key={option.value}
                            ref={(el) => { itemRefs.current[index] = el; }}
                            to={option.href}
                            aria-current={selected ? 'page' : undefined}
                            {...shared}
                            onClick={(event) => {
                                if (isModifiedClick(event)) return;
                                event.preventDefault();
                                onValueChange(option.value);
                            }}
                        >
                            {content}
                        </Link>
                    );
                }
                return (
                    <button
                        key={option.value}
                        ref={(el) => { itemRefs.current[index] = el; }}
                        type="button"
                        aria-pressed={selected}
                        disabled={disabled}
                        {...shared}
                        onClick={() => onValueChange(option.value)}
                    >
                        {content}
                    </button>
                );
            })}
        </div>
    );
}
