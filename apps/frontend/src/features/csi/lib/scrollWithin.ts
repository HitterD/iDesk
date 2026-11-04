/**
 * Scrolls `element` into view inside its nearest *scrollable* ancestor only.
 *
 * `Element.scrollIntoView` also scrolls every `overflow: hidden` ancestor. The app shells are
 * `h-screen overflow-hidden`, so a native call shifts the whole shell (topbar out of view, blank area below).
 * Here only a container whose overflow-y is `auto`/`scroll` moves (falling back to the window).
 */
export type ScrollBlock = 'start' | 'center';

/** Gap kept above the element when aligning to the start (px). */
const START_GAP_PX = 12;
const SCROLLABLE = /(auto|scroll|overlay)/;

export function scrollContainerOf(element: Element): HTMLElement | null {
    for (let node = element.parentElement; node; node = node.parentElement) {
        const { overflowY } = getComputedStyle(node);
        if (SCROLLABLE.test(overflowY) && node.scrollHeight > node.clientHeight) return node;
    }
    return null;
}

export function scrollWithin(element: Element | null | undefined, block: ScrollBlock, smooth: boolean): void {
    if (!element) return;
    const behavior: ScrollBehavior = smooth ? 'smooth' : 'auto';
    const container = scrollContainerOf(element);
    const rect = element.getBoundingClientRect();
    const viewTop = container ? container.getBoundingClientRect().top : 0;
    const viewHeight = container ? container.clientHeight : window.innerHeight;
    const offset = block === 'start' ? rect.top - viewTop - START_GAP_PX : rect.top - viewTop - (viewHeight - rect.height) / 2;
    if (container) container.scrollTo({ top: container.scrollTop + offset, behavior });
    else window.scrollTo({ top: window.scrollY + offset, behavior });
}
