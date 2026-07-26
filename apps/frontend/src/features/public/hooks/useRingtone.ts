import { useCallback, useEffect, useRef, useState } from 'react';

export function useRingtone(): {
    enqueue: (urls: Array<string | null>) => void;
    blocked: boolean;
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
        isPlayingRef.current = true;
        audio.src = url;
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

    // Autoplay biasanya diblokir sampai halaman menerima interaksi. TV memakai
    // flag --autoplay-policy=no-user-gesture-required, tapi bila kebetulan ada
    // yang menyentuh layar atau menekan tombol remote, buka kuncinya di situ.
    // Hasil unlock tidak pernah mematikan indikator: memutar Audio tanpa src
    // bisa resolve atau reject berbeda antar-browser, jadi hanya pemutaran
    // ringtone sungguhan yang boleh mengubah flag blocked.
    useEffect(() => {
        const unlock = () => {
            const audio = getAudio();
            audio.play().then(
                () => audio.pause(),
                () => undefined,
            );
        };
        window.addEventListener('pointerdown', unlock, { once: true });
        window.addEventListener('keydown', unlock, { once: true });
        return () => {
            window.removeEventListener('pointerdown', unlock);
            window.removeEventListener('keydown', unlock);
        };
    }, [getAudio]);

    return { enqueue, blocked };
}
