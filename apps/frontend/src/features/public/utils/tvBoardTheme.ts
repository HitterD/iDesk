import type { CSSProperties } from 'react';

export type TvTheme = 'light' | 'dark';

/**
 * Board palette as CSS variables, so every component reads `var(--tv-*)` and the
 * theme switches by swapping this one style object on the board root.
 */
export const TV_THEME_VARS: Record<TvTheme, CSSProperties> = {
    light: {
        '--tv-bg': '#F5F5F7',
        '--tv-surface': '#FFFFFF',
        '--tv-text': '#1D1D1F',
        '--tv-text-body': '#424245',
        '--tv-text-secondary': '#6E6E73',
        '--tv-text-tertiary': '#86868B',
        '--tv-separator': '#C7C7CC',
        '--tv-divider': '#E8E8ED',
        '--tv-avatar': '#E8E8ED',
        '--tv-inverse-bg': '#1D1D1F',
        '--tv-inverse-text': '#FFFFFF',
        '--tv-hairline': 'rgba(0,0,0,0.1)',
        '--tv-live': '#248A3D',
    } as CSSProperties,
    dark: {
        '--tv-bg': '#000000',
        '--tv-surface': '#1C1C1E',
        '--tv-text': '#F5F5F7',
        '--tv-text-body': '#D1D1D6',
        '--tv-text-secondary': '#AEAEB2',
        '--tv-text-tertiary': '#8E8E93',
        '--tv-separator': '#48484A',
        '--tv-divider': '#38383A',
        '--tv-avatar': '#3A3A3C',
        '--tv-inverse-bg': '#F5F5F7',
        '--tv-inverse-text': '#1D1D1F',
        '--tv-hairline': 'rgba(255,255,255,0.15)',
        '--tv-live': '#30D158',
    } as CSSProperties,
};

const storageKey = (token: string) => `tv-board-theme:${token}`;

export function isTvTheme(value: unknown): value is TvTheme {
    return value === 'light' || value === 'dark';
}

/** The theme this screen picked with the on-screen toggle, if any. */
export function readThemeOverride(token: string | undefined): TvTheme | null {
    if (!token) return null;
    try {
        const stored = window.localStorage.getItem(storageKey(token));
        return isTvTheme(stored) ? stored : null;
    } catch {
        return null; // storage disabled (e.g. kiosk privacy mode): fall back to the admin default
    }
}

/**
 * Picking the admin default clears the override, so later admin changes reach this screen again.
 */
export function writeThemeOverride(token: string | undefined, theme: TvTheme, boardDefault: TvTheme): void {
    if (!token) return;
    try {
        if (theme === boardDefault) {
            window.localStorage.removeItem(storageKey(token));
        } else {
            window.localStorage.setItem(storageKey(token), theme);
        }
    } catch {
        // Storage unavailable: the toggle still applies for this session.
    }
}
