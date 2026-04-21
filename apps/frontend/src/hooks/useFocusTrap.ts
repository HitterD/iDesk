import { useEffect, useRef, RefObject } from 'react';

const FOCUSABLE_ELEMENTS = [
    'button:not([disabled])',
    '[href]',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
].join(', ');

interface UseFocusTrapOptions {
    enabled?: boolean;
    initialFocus?: RefObject<HTMLElement>;
    returnFocus?: boolean;
    escapeDeactivates?: boolean;
    onEscape?: () => void;
}

export function useFocusTrap<T extends HTMLElement>(
    containerRef: RefObject<T | null>,
    options: UseFocusTrapOptions = {}
) {
    const {
        enabled = true,
        initialFocus,
        returnFocus = true,
        escapeDeactivates = true,
        onEscape,
    } = options;

    const previousActiveElement = useRef<Element | null>(null);

    useEffect(() => {
        if (!enabled || !containerRef.current) return;

        const container = containerRef.current;

        // Store the previously focused element
        previousActiveElement.current = document.activeElement;

        // Get all focusable elements
        const getFocusableElements = () => {
            return container.querySelectorAll<HTMLElement>(FOCUSABLE_ELEMENTS);
        };

        // Focus the first element or initial focus element
        const focusFirst = () => {
            if (initialFocus?.current) {
                initialFocus.current.focus();
            } else {
                const focusableElements = getFocusableElements();
                if (focusableElements.length > 0) {
                    focusableElements[0].focus();
                }
            }
        };

        // Handle keydown events
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && escapeDeactivates) {
                e.preventDefault();
                onEscape?.();
                return;
            }

            if (e.key !== 'Tab') return;

            const focusableElements = getFocusableElements();
            if (focusableElements.length === 0) return;

            const firstElement = focusableElements[0];
            const lastElement = focusableElements[focusableElements.length - 1];

            // Shift + Tab on first element -> focus last
            if (e.shiftKey && document.activeElement === firstElement) {
                e.preventDefault();
                lastElement.focus();
                return;
            }

            // Tab on last element -> focus first
            if (!e.shiftKey && document.activeElement === lastElement) {
                e.preventDefault();
                firstElement.focus();
                return;
            }

            // If focus is outside container, bring it back
            if (!container.contains(document.activeElement)) {
                e.preventDefault();
                firstElement.focus();
            }
        };

        // Handle focus events to keep focus within container
        const handleFocusIn = (e: FocusEvent) => {
            if (!container.contains(e.target as Node)) {
                const focusableElements = getFocusableElements();
                if (focusableElements.length > 0) {
                    focusableElements[0].focus();
                }
            }
        };

        // Set up event listeners
        container.addEventListener('keydown', handleKeyDown);
        document.addEventListener('focusin', handleFocusIn);

        // Focus first element after a small delay (for animations)
        const timeoutId = setTimeout(focusFirst, 50);

        // Cleanup
        return () => {
            container.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('focusin', handleFocusIn);
            clearTimeout(timeoutId);

            // Return focus to previously focused element
            if (returnFocus && previousActiveElement.current instanceof HTMLElement) {
                previousActiveElement.current.focus();
            }
        };
    }, [enabled, containerRef, initialFocus, returnFocus, escapeDeactivates, onEscape]);
}

// Simple hook for just trapping focus without options
export function useSimpleFocusTrap(isOpen: boolean) {
    const containerRef = useRef<HTMLDivElement>(null);

    useFocusTrap(containerRef, { enabled: isOpen });

    return containerRef;
}

export default useFocusTrap;
