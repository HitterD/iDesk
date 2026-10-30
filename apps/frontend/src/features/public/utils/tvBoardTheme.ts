import type { CSSProperties } from 'react';

export type TvTheme = 'light' | 'dark';

/**
 * Board palette as CSS variables, so every component reads `var(--tv-*)` and the
 * theme switches by swapping this one style object on the board root.
 */
export const TV_THEME_VARS: Record<TvTheme, CSSProperties> = {
    light: {
        '--tv-bg': '#F4F4F6',
        // Sapphire chrome, as in the app shell.
        '--tv-chrome': 'linear-gradient(180deg, #2D4A8C, #243D75)',
        '--tv-chrome-text': '#FFFFFF',
        '--tv-chrome-muted': 'rgba(255,255,255,0.72)',
        '--tv-chrome-fill': 'rgba(255,255,255,0.12)',
        '--tv-accent': '#2D4A8C',
        '--tv-accent-2': '#0E7C7B',
        '--tv-warn': '#B25E00',
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
        '--tv-bg': '#0B0D12',
        '--tv-chrome': 'linear-gradient(180deg, #1B2848, #141D35)',
        '--tv-chrome-text': '#F5F5F7',
        '--tv-chrome-muted': 'rgba(245,245,247,0.66)',
        '--tv-chrome-fill': 'rgba(255,255,255,0.10)',
        '--tv-accent': '#9DB0E8',
        '--tv-accent-2': '#5CC8C6',
        '--tv-warn': '#FFB340',
        '--tv-surface': '#17181C',
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
