import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRingtone } from '../useRingtone';

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

    it('flags blocked and starts the next queued url when playback is rejected', async () => {
        let resolveSecond: (() => void) | undefined;
        playMock.mockRejectedValueOnce(new DOMException('play() failed', 'NotAllowedError'));
        playMock.mockImplementationOnce(() => new Promise<void>((resolve) => { resolveSecond = resolve; }));
        const { result } = renderHook(() => useRingtone());

        act(() => result.current.enqueue(['/uploads/sounds/a.mp3', '/uploads/sounds/b.mp3']));

        await waitFor(() => expect(playMock).toHaveBeenCalledTimes(2));
        expect(result.current.blocked).toBe(true);
        await act(async () => resolveSecond?.());
    });

    it('clears blocked once a later playback succeeds', async () => {
        playMock.mockRejectedValueOnce(new DOMException('play() failed', 'NotAllowedError'));
        playMock.mockResolvedValueOnce(undefined);
        const { result } = renderHook(() => useRingtone());

        act(() => result.current.enqueue(['/uploads/sounds/a.mp3', '/uploads/sounds/b.mp3']));

        await waitFor(() => expect(playMock).toHaveBeenCalledTimes(2));
        await waitFor(() => expect(result.current.blocked).toBe(false));
    });
});
