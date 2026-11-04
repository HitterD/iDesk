import { afterEach, describe, expect, it, vi } from 'vitest';
import { scrollContainerOf, scrollWithin } from '../scrollWithin';

/** jsdom has no layout: give elements the sizes a real browser would. */
function box(element: HTMLElement, { top, height, scrollHeight = height, clientHeight = height }: { top: number; height: number; scrollHeight?: number; clientHeight?: number }) {
    element.getBoundingClientRect = () => ({ top, height, bottom: top + height, left: 0, right: 0, width: 0, x: 0, y: top, toJSON: () => ({}) });
    Object.defineProperty(element, 'scrollHeight', { configurable: true, value: scrollHeight });
    Object.defineProperty(element, 'clientHeight', { configurable: true, value: clientHeight });
}

function shell() {
    // App shell: overflow hidden (must never move) > scroller (overflow auto) > target.
    const outer = document.createElement('div');
    outer.style.overflow = 'hidden';
    const scroller = document.createElement('div');
    scroller.style.overflowY = 'auto';
    const target = document.createElement('section');
    scroller.appendChild(target);
    outer.appendChild(scroller);
    document.body.appendChild(outer);
    box(outer, { top: 0, height: 900, scrollHeight: 1400 });
    box(scroller, { top: 56, height: 844, scrollHeight: 3000 });
    box(target, { top: 700, height: 400 });
    scroller.scrollTop = 200;
    outer.scrollTo = vi.fn();
    scroller.scrollTo = vi.fn();
    return { outer, scroller, target };
}

afterEach(() => { document.body.innerHTML = ''; });

describe('scrollWithin', () => {
    it('picks the nearest overflow-auto ancestor, skipping overflow-hidden shells', () => {
        const { scroller, target } = shell();
        expect(scrollContainerOf(target)).toBe(scroller);
    });

    it('start: moves only the scroller so the element sits a small gap below its top', () => {
        const { outer, scroller, target } = shell();
        scrollWithin(target, 'start', false);
        expect(scroller.scrollTo).toHaveBeenCalledWith({ top: 200 + (700 - 56 - 12), behavior: 'auto' });
        expect(outer.scrollTo).not.toHaveBeenCalled();
    });

    it('center: centres the element in the scroller, smooth when allowed', () => {
        const { scroller, target } = shell();
        scrollWithin(target, 'center', true);
        expect(scroller.scrollTo).toHaveBeenCalledWith({ top: 200 + (700 - 56 - (844 - 400) / 2), behavior: 'smooth' });
    });

    it('does nothing without an element', () => {
        expect(() => scrollWithin(null, 'start', false)).not.toThrow();
    });
});
