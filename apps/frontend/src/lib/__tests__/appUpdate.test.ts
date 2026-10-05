import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isStaleChunkError, reloadOnce, isNewerBuild, RELOAD_GUARD_KEY } from '../appUpdate';

describe('isStaleChunkError', () => {
    // After a deploy the old tab requests chunk hashes that no longer exist.
    it.each([
        'Failed to fetch dynamically imported module: https://idesk/assets/Page-abc123.js',
        'error loading dynamically imported module',
        'Importing a module script failed.',
        "Unable to preload CSS for /assets/index-abc.css",
    ])('recognises "%s"', (message) => {
        expect(isStaleChunkError(new Error(message))).toBe(true);
    });

    it('recognises a ChunkLoadError by name', () => {
        const err = new Error('Loading chunk 12 failed');
        err.name = 'ChunkLoadError';
        expect(isStaleChunkError(err)).toBe(true);
    });

    it('ignores ordinary runtime errors', () => {
        expect(isStaleChunkError(new TypeError("Cannot read properties of undefined (reading 'map')"))).toBe(false);
        expect(isStaleChunkError(null)).toBe(false);
    });
});

describe('reloadOnce', () => {
    beforeEach(() => sessionStorage.clear());

    it('reloads and records the attempt', () => {
        const reload = vi.fn();

        expect(reloadOnce(reload, 1_000)).toBe(true);
        expect(reload).toHaveBeenCalledTimes(1);
        expect(sessionStorage.getItem(RELOAD_GUARD_KEY)).toBe('1000');
    });

    // A chunk that is genuinely broken must not trap the user in a reload loop.
    it('does not reload again within the guard window', () => {
        const reload = vi.fn();
        reloadOnce(reload, 1_000);

        expect(reloadOnce(reload, 20_000)).toBe(false);
        expect(reload).toHaveBeenCalledTimes(1);
    });

    it('allows another reload once the guard window has passed', () => {
        const reload = vi.fn();
        reloadOnce(reload, 1_000);

        expect(reloadOnce(reload, 1_000 + 31_000)).toBe(true);
        expect(reload).toHaveBeenCalledTimes(2);
    });
});

describe('isNewerBuild', () => {
    it('detects a different deployed build id', () => {
        expect(isNewerBuild('build-a', { buildId: 'build-b' })).toBe(true);
    });

    it('treats the same id, a missing payload or a dev build as current', () => {
        expect(isNewerBuild('build-a', { buildId: 'build-a' })).toBe(false);
        expect(isNewerBuild('build-a', null)).toBe(false);
        expect(isNewerBuild('build-a', {})).toBe(false);
        expect(isNewerBuild('', { buildId: 'build-b' })).toBe(false);
    });
});
