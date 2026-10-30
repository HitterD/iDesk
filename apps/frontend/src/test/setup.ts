import '@testing-library/jest-dom';

// jsdom lacks the layout APIs used by cmdk and Radix popovers.
globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
} as unknown as typeof ResizeObserver;
Element.prototype.scrollIntoView ??= () => {};
// Radix Select opens on pointerdown and captures the pointer.
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.releasePointerCapture ??= () => {};
