import { useCallback, useEffect, useRef, useState } from 'react';
import { resolveAudioUrl } from '@/lib/media';

const SILENT_AUDIO_DATA_URI =
    'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

/** Sounds held while the browser blocks autoplay; older ones are dropped so a long block does not replay a backlog. */
export const MAX_PENDING_SOUNDS = 5;

/** A sound to play, with the built-in sound to fall back to when a custom upload cannot be loaded. */
export interface RingtoneSound {
    src: string;
    fallback?: string;
}

type SoundInput = string | RingtoneSound | null | undefined;

const toSound = (input: SoundInput): RingtoneSound | null => {
    if (!input) return null;
    return typeof input === 'string' ? { src: input } : input.src ? input : null;
};

const isAutoplayBlock = (error: unknown): boolean =>
    error instanceof DOMException && error.name === 'NotAllowedError';

export function useRingtone(): {
    enqueue: (sounds: SoundInput[]) => void;
    blocked: boolean;
    unlockAudio: () => void;
    playTestSound: (url?: string) => void;
    /** Plays a synthesized cue (e.g. the leaderboard fanfare) on the unlocked Web Audio context; false while blocked. */
    playSynth: (play: (context: AudioContext | null) => boolean) => boolean;
} {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const queueRef = useRef<RingtoneSound[]>([]);
    const currentRef = useRef<RingtoneSound | null>(null);
    /** Bumped per playback so the `error` event and the play() rejection cannot both advance the queue. */
    const playbackIdRef = useRef(0);
    const blockedRef = useRef(false);
    const [blocked, setBlockedState] = useState(false);

    const setBlocked = useCallback((value: boolean) => {
        blockedRef.current = value;
        setBlockedState(value);
    }, []);

    const getAudio = useCallback(() => {
        if (!audioRef.current) {
            audioRef.current = new Audio();
        }
        return audioRef.current;
    }, []);

    const playNextRef = useRef<() => void>(() => undefined);

    /** Ends the current playback once; a later call for the same playback is ignored. */
    const finishRef = useRef<(id: number, retry?: RingtoneSound) => void>(() => undefined);
    finishRef.current = (id, retry) => {
        if (id !== playbackIdRef.current || !currentRef.current) return;
        currentRef.current = null;
        if (retry) queueRef.current.unshift(retry);
        playNextRef.current();
    };

    playNextRef.current = () => {
        // While blocked, each new sound retries the head of the queue: Chrome may lift the block on its own.
        if (currentRef.current) return;
        const sound = queueRef.current.shift();
        if (!sound) return;

        const audio = getAudio();
        const id = ++playbackIdRef.current;
        currentRef.current = sound;
        audio.src = resolveAudioUrl(sound.src);
        audio.currentTime = 0;
        audio.play().then(
            () => setBlocked(false),
            (error: unknown) => {
                if (id !== playbackIdRef.current) return;
                if (isAutoplayBlock(error)) {
                    // Keep the sound: it plays as soon as someone interacts with the page.
                    queueRef.current.unshift(sound);
                    currentRef.current = null;
                    setBlocked(true);
                    return;
                }
                finishRef.current(id, sound.fallback ? { src: sound.fallback } : undefined);
            },
        );
    };

    const enqueue = useCallback((inputs: SoundInput[]) => {
        const sounds = inputs.map(toSound).filter((sound): sound is RingtoneSound => sound !== null);
        if (sounds.length === 0) return;
        queueRef.current.push(...sounds);
        if (blockedRef.current && queueRef.current.length > MAX_PENDING_SOUNDS) {
            queueRef.current.splice(0, queueRef.current.length - MAX_PENDING_SOUNDS);
        }
        playNextRef.current();
    }, []);

    useEffect(() => {
        const audio = getAudio();
        const handleEnd = () => finishRef.current(playbackIdRef.current);
        const handleError = () => {
            const sound = currentRef.current;
            finishRef.current(playbackIdRef.current, sound?.fallback ? { src: sound.fallback } : undefined);
        };
        audio.addEventListener('ended', handleEnd);
        audio.addEventListener('error', handleError);
        return () => {
            audio.removeEventListener('ended', handleEnd);
            audio.removeEventListener('error', handleError);
            audio.pause();
        };
    }, [getAudio]);

    useEffect(() => () => {
        audioContextRef.current?.close().catch(() => undefined);
    }, []);

    const resumeAudioContext = useCallback(() => {
        try {
            if (!audioContextRef.current) {
                const AudioContextClass = typeof window !== 'undefined'
                    ? (window.AudioContext || (window as any).webkitAudioContext)
                    : null;
                if (!AudioContextClass) return;
                audioContextRef.current = new AudioContextClass();
            }
            if (audioContextRef.current.state === 'suspended') {
                audioContextRef.current.resume().catch(() => undefined);
            }
        } catch {
            // Web Audio is only a hint for the autoplay policy; the <audio> element still works without it.
        }
    }, []);

    const unlockAudio = useCallback(() => {
        resumeAudioContext();
        if (currentRef.current) return;

        // Play a silent clip inside the user gesture so the browser lifts the autoplay block.
        const audio = getAudio();
        const id = ++playbackIdRef.current;
        audio.src = SILENT_AUDIO_DATA_URI;
        audio.play().then(
            () => {
                if (id !== playbackIdRef.current) return;
                setBlocked(false);
                playNextRef.current();
            },
            () => setBlocked(true),
        );
    }, [getAudio, resumeAudioContext, setBlocked]);

    const playTestSound = useCallback((soundUrl = '/sounds/default/new-ticket.mp3') => {
        enqueue([soundUrl]);
    }, [enqueue]);

    // Autoplay biasanya diblokir sampai halaman menerima interaksi. TV memakai
    // flag --autoplay-policy=no-user-gesture-required, tapi bila kebetulan ada
    // yang menyentuh layar atau menekan tombol remote, buka kuncinya di situ.
    useEffect(() => {
        window.addEventListener('pointerdown', unlockAudio);
        window.addEventListener('keydown', unlockAudio);
        return () => {
            window.removeEventListener('pointerdown', unlockAudio);
            window.removeEventListener('keydown', unlockAudio);
        };
    }, [unlockAudio]);

    const playSynth = useCallback((play: (context: AudioContext | null) => boolean) => {
        resumeAudioContext();
        return play(audioContextRef.current);
    }, [resumeAudioContext]);

    return { enqueue, blocked, unlockAudio, playTestSound, playSynth };
}
