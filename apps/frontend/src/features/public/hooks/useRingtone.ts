import { useCallback, useEffect, useRef, useState } from 'react';
import { resolveAudioUrl } from '@/lib/media';

const SILENT_AUDIO_DATA_URI =
    'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

export function useRingtone(): {
    enqueue: (urls: Array<string | null>) => void;
    blocked: boolean;
    unlockAudio: () => void;
    playTestSound: (url?: string) => void;
} {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const queueRef = useRef<string[]>([]);
    const isPlayingRef = useRef(false);
    const [blocked, setBlocked] = useState(false);

    const getAudio = useCallback(() => {
        if (!audioRef.current) {
            audioRef.current = new Audio();
        }
        return audioRef.current;
    }, []);

    const playNextRef = useRef<() => void>(() => undefined);

    playNextRef.current = () => {
        if (isPlayingRef.current) {
            return;
        }
        const url = queueRef.current.shift();
        if (!url) {
            return;
        }

        const audio = getAudio();
        const resolvedUrl = resolveAudioUrl(url);
        isPlayingRef.current = true;
        audio.src = resolvedUrl;
        audio.currentTime = 0;
        audio.play().then(
            () => setBlocked(false),
            () => {
                setBlocked(true);
                isPlayingRef.current = false;
                playNextRef.current();
            },
        );
    };

    const enqueue = useCallback((urls: Array<string | null>) => {
        queueRef.current.push(...urls.filter((url): url is string => Boolean(url)));
        playNextRef.current();
    }, []);

    useEffect(() => {
        const audio = getAudio();
        const handleEnd = () => {
            isPlayingRef.current = false;
            playNextRef.current();
        };
        audio.addEventListener('ended', handleEnd);
        audio.addEventListener('error', handleEnd);
        return () => {
            audio.removeEventListener('ended', handleEnd);
            audio.removeEventListener('error', handleEnd);
            audio.pause();
        };
    }, [getAudio]);

    const unlockAudio = useCallback(() => {
        const audio = getAudio();

        // Resume AudioContext if present in browser
        try {
            const AudioContextClass = typeof window !== 'undefined'
                ? (window.AudioContext || (window as any).webkitAudioContext)
                : null;
            if (AudioContextClass) {
                const ctx = new AudioContextClass();
                if (ctx.state === 'suspended') {
                    ctx.resume().catch(() => undefined);
                }
            }
        } catch {
            // ignore Web Audio context errors
        }

        // Prime the audio element with a valid sound so play() succeeds without throwing NotSupportedError
        if (!audio.src || (typeof window !== 'undefined' && audio.src === window.location.href)) {
            audio.src = SILENT_AUDIO_DATA_URI;
        }

        audio.play().then(
            () => {
                setBlocked(false);
                if (queueRef.current.length > 0) {
                    playNextRef.current();
                }
            },
            () => {
                setBlocked(true);
            },
        );
    }, [getAudio]);

    const playTestSound = useCallback((soundUrl = '/sounds/default/new-ticket.mp3') => {
        unlockAudio();
        enqueue([soundUrl]);
    }, [unlockAudio, enqueue]);

    // Autoplay biasanya diblokir sampai halaman menerima interaksi. TV memakai
    // flag --autoplay-policy=no-user-gesture-required, tapi bila kebetulan ada
    // yang menyentuh layar atau menekan tombol remote, buka kuncinya di situ.
    useEffect(() => {
        const unlock = () => {
            unlockAudio();
        };
        window.addEventListener('pointerdown', unlock, { once: true });
        window.addEventListener('keydown', unlock, { once: true });
        return () => {
            window.removeEventListener('pointerdown', unlock);
            window.removeEventListener('keydown', unlock);
        };
    }, [unlockAudio]);

    return { enqueue, blocked, unlockAudio, playTestSound };
}
