import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ScrollToTopButton } from '../ScrollToTopButton';

afterEach(cleanup);

describe('ScrollToTopButton', () => {
    it('stays hidden near the top, appears after scrolling past threshold, and scrolls container to top', async () => {
        const scrollTo = vi.fn();
        const { container } = render(
            <div style={{ overflowY: 'auto', height: '200px' }}>
                <div style={{ height: '1000px' }}>content</div>
                <ScrollToTopButton threshold={200} />
            </div>,
        );
        const scroller = container.firstElementChild as HTMLElement;
        Object.defineProperty(scroller, 'scrollHeight', { value: 1000, configurable: true });
        Object.defineProperty(scroller, 'clientHeight', { value: 200, configurable: true });
        Object.defineProperty(scroller, 'scrollTop', { value: 0, writable: true, configurable: true });
        scroller.scrollTo = scrollTo;

        // Re-render once dimensions are attached so scrollContainerOf detects the scrollable ancestor.
        cleanup();
        const rerendered = render(
            <div style={{ overflowY: 'auto', height: '200px' }}>
                <div style={{ height: '1000px' }}>content</div>
                <ScrollToTopButton threshold={200} />
            </div>,
        );
        const box = rerendered.container.firstElementChild as HTMLElement;
        Object.defineProperty(box, 'scrollHeight', { value: 1000, configurable: true });
        Object.defineProperty(box, 'clientHeight', { value: 200, configurable: true });
        let top = 0;
        Object.defineProperty(box, 'scrollTop', { get: () => top, set: (v) => { top = v; }, configurable: true });
        box.scrollTo = scrollTo;

        // Trigger initial scroll listener registration on window fallback or element.
        expect(screen.queryByRole('button', { name: 'Kembali ke atas' })).toBeNull();

        top = 400;
        fireEvent.scroll(window);
        // Also simulate window.scrollY for JSDOM where getComputedStyle on unmounted/box may vary.
        Object.defineProperty(window, 'scrollY', { value: 400, writable: true, configurable: true });
        fireEvent.scroll(window);

        const button = await screen.findByRole('button', { name: 'Kembali ke atas' });
        window.scrollTo = scrollTo;
        await userEvent.click(button);
        expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 0 }));
    });
});
