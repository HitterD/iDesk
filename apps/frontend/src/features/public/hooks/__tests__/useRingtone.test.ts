import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_PENDING_SOUNDS, useRingtone } from '../useRingtone';

let audio: HTMLAudioElement;
const playMock = vi.fn();

beforeEach(() => {
    audio = document.createElement('audio');
    playMock.mockReset();
    playMock.mockResolvedValue(undefined);
    vi.spyOn(audio, 'play').mockImplementation(playMock);
    // Arrow function tidak bisa dipanggil dengan `new`; hook memakai `new Audio()`.
    vi.stubGlobal('Audio', vi.fn(function () { return audio; }));
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('useRingtone', () => {
    it('does nothing when every url is null', () => {
        const { result } = renderHook(() => useRingtone());

        act(() => result.current.enqueue([null, null]));

        expect(playMock).not.toHaveBeenCalled();
        expect(result.current.blocked).toBe(false);
    });

    it('plays the first queued url', () => {
        const { result } = renderHook(() => useRingtone());

        act(() => result.current.enqueue(['/uploads/sounds/a.mp3']));

        expect(playMock).toHaveBeenCalledTimes(1);
    });

    it('waits for ended before playing the next queued url', async () => {
        const { result } = renderHook(() => useRingtone());

        act(() => result.current.enqueue(['/uploads/sounds/a.mp3', '/uploads/sounds/b.mp3']));
        expect(playMock).toHaveBeenCalledTimes(1);

        act(() => audio.dispatchEvent(new Event('ended')));
        await waitFor(() => expect(playMock).toHaveBeenCalledTimes(2));
    });

    it('keeps blocked sounds queued instead of dropping them', async () => {
        playMock.mockRejectedValueOnce(new DOMException('play() failed', 'NotAllowedError'));
        const { result } = renderHook(() => useRingtone());

        act(() => result.current.enqueue(['/uploads/sounds/a.mp3', '/uploads/sounds/b.mp3']));

        await waitFor(() => expect(result.current.blocked).toBe(true));
        expect(playMock).toHaveBeenCalledTimes(1);
    });

    it('plays the held sounds once the user interacts with the page', async () => {
        playMock.mockRejectedValueOnce(new DOMException('play() failed', 'NotAllowedError'));
        const { result } = renderHook(() => useRingtone());

        act(() => result.current.enqueue(['/uploads/sounds/a.mp3']));
        await waitFor(() => expect(result.current.blocked).toBe(true));

        act(() => { window.dispatchEvent(new Event('pointerdown')); });

        await waitFor(() => expect(result.current.blocked).toBe(false));
        await waitFor(() => expect(audio.src).toContain('/uploads/sounds/a.mp3'));
    });

    it('falls back to the built-in sound when a custom upload cannot be loaded', async () => {
        playMock.mockRejectedValueOnce(new DOMException('no source', 'NotSupportedError'));
        const { result } = renderHook(() => useRingtone());

        act(() => result.current.enqueue([{ src: '/uploads/sounds/gone.mp3', fallback: '/sounds/default/assigned.mp3' }]));

        await waitFor(() => expect(playMock).toHaveBeenCalledTimes(2));
        expect(audio.src).toContain('/sounds/default/assigned.mp3');
        expect(result.current.blocked).toBe(false);
    });

    it('advances the queue only once when a load error and a play rejection both fire', async () => {
        let rejectFirst: ((e: unknown) => void) | undefined;
        playMock.mockImplementationOnce(() => new Promise<void>((_, reject) => { rejectFirst = reject; }));
        const { result } = renderHook(() => useRingtone());

        act(() => result.current.enqueue(['/uploads/sounds/a.mp3', '/uploads/sounds/b.mp3', '/uploads/sounds/c.mp3']));
        act(() => { audio.dispatchEvent(new Event('error')); });
        await act(async () => rejectFirst?.(new DOMException('no source', 'NotSupportedError')));

        expect(playMock).toHaveBeenCalledTimes(2);
        expect(audio.src).toContain('/uploads/sounds/b.mp3');
    });

    it('caps the sounds held while blocked', async () => {
        const srcs: string[] = [];
        playMock.mockImplementation(() => {
            srcs.push(audio.src);
            return Promise.reject(new DOMException('play() failed', 'NotAllowedError'));
        });
        const { result } = renderHook(() => useRingtone());

        act(() => result.current.enqueue(['/a.mp3']));
        await waitFor(() => expect(result.current.blocked).toBe(true));
        await act(async () => result.current.enqueue(Array.from({ length: MAX_PENDING_SOUNDS + 3 }, (_, i) => `/s${i}.mp3`)));

        playMock.mockImplementation(() => { srcs.push(audio.src); return Promise.resolve(); });
        await act(async () => { window.dispatchEvent(new Event('keydown')); });
        for (let i = 0; i < MAX_PENDING_SOUNDS + 5; i += 1) {
            await act(async () => { audio.dispatchEvent(new Event('ended')); });
        }
        const played = srcs.slice(srcs.findIndex((src) => src.startsWith('data:')) + 1);
        // Only the newest MAX_PENDING_SOUNDS survive the block, in order.
        expect(played.map((src) => src.replace(/^.*\//, ''))).toEqual(['s3.mp3', 's4.mp3', 's5.mp3', 's6.mp3', 's7.mp3']);
    });
});
