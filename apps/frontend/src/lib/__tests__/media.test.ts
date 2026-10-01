import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveAudioUrl } from '../media';

afterEach(() => {
    vi.unstubAllEnvs();
});

describe('resolveAudioUrl', () => {
    it('keeps built-in sounds relative', () => {
        expect(resolveAudioUrl('/sounds/default/assigned.mp3')).toBe('/sounds/default/assigned.mp3');
    });

    it('serves uploads from the page origin when no API URL is configured', () => {
        vi.stubEnv('VITE_API_URL', '');
        expect(resolveAudioUrl('/uploads/sounds/a.mp3')).toBe(`${window.location.origin}/uploads/sounds/a.mp3`);
    });

    it('returns an empty string for missing urls', () => {
        expect(resolveAudioUrl(null)).toBe('');
    });
});
