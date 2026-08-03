/**
 * Ref-counted body scroll lock.
 *
 * Nested overlays (e.g. an image lightbox opened from inside a modal) each
 * lock on mount and release on unmount. Without counting, the inner overlay's
 * cleanup would restore scrolling while the outer modal is still open.
 */
let lockCount = 0;
let previousOverflow = '';

export function lockBodyScroll(): void {
    if (lockCount === 0) {
        previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
    }
    lockCount += 1;
}

export function unlockBodyScroll(): void {
    if (lockCount === 0) return;
    lockCount -= 1;
    if (lockCount === 0) {
        document.body.style.overflow = previousOverflow;
    }
}

/** Test-only: reset module state between cases. */
export function __resetScrollLock(): void {
    lockCount = 0;
    previousOverflow = '';
    document.body.style.overflow = '';
}
