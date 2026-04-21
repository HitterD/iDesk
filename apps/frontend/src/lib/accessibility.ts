/**
 * Accessibility utilities for iDesk
 * Provides consistent ARIA labels, roles, and keyboard navigation helpers
 */

// Skip link for keyboard navigation
export const SKIP_LINK_ID = 'main-content';

// Live region announcements
export const announce = (message: string, priority: 'polite' | 'assertive' = 'polite') => {
    const container = document.getElementById('aria-live-region');
    if (container) {
        container.setAttribute('aria-live', priority);
        container.textContent = message;
        // Clear after announcement
        setTimeout(() => {
            container.textContent = '';
        }, 1000);
    }
};

// Focus management
export const focusFirst = (container: HTMLElement | null) => {
    if (!container) return;
    
    const focusable = container.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    if (focusable.length > 0) {
        focusable[0].focus();
    }
};

export const trapFocus = (container: HTMLElement) => {
    const focusableElements = container.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key !== 'Tab') return;

        if (e.shiftKey && document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
        }
    };

    container.addEventListener('keydown', handleKeyDown);
    
    return () => container.removeEventListener('keydown', handleKeyDown);
};

// Status labels for screen readers
export const getStatusLabel = (status: string): string => {
    const labels: Record<string, string> = {
        TODO: 'Open',
        IN_PROGRESS: 'In Progress',
        WAITING_VENDOR: 'Waiting for Vendor',
        RESOLVED: 'Resolved',
        CANCELLED: 'Cancelled',
    };
    return labels[status] || status;
};

export const getPriorityLabel = (priority: string): string => {
    const labels: Record<string, string> = {
        CRITICAL: 'Critical Priority',
        HIGH: 'High Priority',
        MEDIUM: 'Medium Priority',
        LOW: 'Low Priority',
    };
    return labels[priority] || priority;
};

// Keyboard navigation helpers
export const handleArrowKeys = (
    e: React.KeyboardEvent,
    items: HTMLElement[],
    currentIndex: number,
    onSelect: (index: number) => void
) => {
    let newIndex = currentIndex;

    switch (e.key) {
        case 'ArrowDown':
        case 'ArrowRight':
            e.preventDefault();
            newIndex = (currentIndex + 1) % items.length;
            break;
        case 'ArrowUp':
        case 'ArrowLeft':
            e.preventDefault();
            newIndex = (currentIndex - 1 + items.length) % items.length;
            break;
        case 'Home':
            e.preventDefault();
            newIndex = 0;
            break;
        case 'End':
            e.preventDefault();
            newIndex = items.length - 1;
            break;
        default:
            return;
    }

    items[newIndex]?.focus();
    onSelect(newIndex);
};

// Color contrast utilities
export const getContrastColor = (bgColor: string): 'black' | 'white' => {
    // Convert hex to RGB
    const hex = bgColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    // Calculate luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    
    return luminance > 0.5 ? 'black' : 'white';
};

// Screen reader only styles (for text that should be read but not visible)
export const srOnlyStyles: React.CSSProperties = {
    position: 'absolute',
    width: '1px',
    height: '1px',
    padding: 0,
    margin: '-1px',
    overflow: 'hidden',
    clip: 'rect(0, 0, 0, 0)',
    whiteSpace: 'nowrap',
    border: 0,
};

// Common ARIA attributes
export const ariaLabels = {
    navigation: {
        main: 'Main navigation',
        breadcrumb: 'Breadcrumb',
        pagination: 'Pagination',
    },
    regions: {
        main: 'Main content',
        sidebar: 'Sidebar navigation',
        header: 'Site header',
        footer: 'Site footer',
        search: 'Search',
        notifications: 'Notifications',
    },
    actions: {
        close: 'Close',
        open: 'Open',
        expand: 'Expand',
        collapse: 'Collapse',
        delete: 'Delete',
        edit: 'Edit',
        save: 'Save',
        cancel: 'Cancel',
        submit: 'Submit',
        refresh: 'Refresh',
        filter: 'Filter',
        sort: 'Sort',
    },
    status: {
        loading: 'Loading...',
        success: 'Success',
        error: 'Error',
        warning: 'Warning',
        info: 'Information',
    },
};

export default {
    announce,
    focusFirst,
    trapFocus,
    getStatusLabel,
    getPriorityLabel,
    handleArrowKeys,
    getContrastColor,
    srOnlyStyles,
    ariaLabels,
    SKIP_LINK_ID,
};
