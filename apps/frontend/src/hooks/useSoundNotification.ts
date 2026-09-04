import { useState, useCallback, useEffect } from 'react';
import api from '@/lib/api';
import { resolveAudioUrl } from '@/lib/media';

export type NotificationEventType =
    | 'NEW_TICKET'
    | 'MESSAGE'
    | 'ASSIGNED'
    | 'RESOLVED'
    | 'CRITICAL'
    | 'SLA_WARNING'
    | 'SLA_BREACH';

interface SoundSettings {
    enabled: boolean;
    volume: number;
}

const STORAGE_KEY = 'idesk_sound_settings';

const DEFAULT_SOUNDS: Record<NotificationEventType, string> = {
    NEW_TICKET: '/sounds/default/new-ticket.mp3',
    MESSAGE: '/sounds/default/message.mp3',
    ASSIGNED: '/sounds/default/assigned.mp3',
    RESOLVED: '/sounds/default/resolved.mp3',
    CRITICAL: '/sounds/default/critical-alert.mp3',
    SLA_WARNING: '/sounds/default/sla-warning.mp3',
    SLA_BREACH: '/sounds/default/sla-breach.mp3',
};

const normalizeEventKey = (key: string): NotificationEventType => {
    const k = String(key || '').toUpperCase().replace(/[-\s]/g, '_');
    if (k in DEFAULT_SOUNDS) {
        return k as NotificationEventType;
    }
    return 'NEW_TICKET';
};

// Cache for sound URLs from API
const soundUrlCache: Map<NotificationEventType, string> = new Map();

export const useSoundNotification = () => {
    const [settings, setSettings] = useState<SoundSettings>(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            return saved ? JSON.parse(saved) : { enabled: true, volume: 0.5 };
        } catch {
            return { enabled: true, volume: 0.5 };
        }
    });

    // Save settings to localStorage
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    }, [settings]);

    // Fetch sound URL from API or use cached/default
    const getSoundUrl = useCallback(async (rawEventType: NotificationEventType | string): Promise<string> => {
        const eventKey = normalizeEventKey(rawEventType);
        // Check cache first
        if (soundUrlCache.has(eventKey)) {
            return soundUrlCache.get(eventKey)!;
        }

        try {
            const response = await api.get(`/sounds/active/${eventKey}`);
            if (response.data) {
                const url = typeof response.data === 'string' ? response.data : response.data.soundUrl;
                if (url && typeof url === 'string') {
                    const resolved = resolveAudioUrl(url);
                    soundUrlCache.set(eventKey, resolved);
                    return resolved;
                }
            }
        } catch (error) {
            console.debug('Failed to fetch sound URL, using default:', error);
        }

        // Fallback to default
        return DEFAULT_SOUNDS[eventKey] || '/sounds/default/new-ticket.mp3';
    }, []);

    // Play sound from a specific URL (for preview or testing)
    const previewSoundUrl = useCallback(async (url: string) => {
        try {
            const resolvedUrl = resolveAudioUrl(url);
            const audio = new Audio(resolvedUrl);
            audio.volume = settings.volume;
            await audio.play();
        } catch (error) {
            console.debug('Audio preview playback failed:', error);
        }
    }, [settings.volume]);

    // Play sound for event type
    const playSound = useCallback(async (rawEventType: NotificationEventType | string) => {
        if (!settings.enabled) {
            return;
        }

        try {
            const soundUrl = await getSoundUrl(rawEventType);
            const audio = new Audio(soundUrl);
            audio.volume = settings.volume;

            await audio.play();
        } catch (error) {
            // Often fails due to browser autoplay policy - that's okay
            console.debug('Sound playback failed (likely autoplay policy):', error);
        }
    }, [settings.enabled, settings.volume, getSoundUrl]);

    // Play sound for new ticket (convenience method)
    const playNewTicketSound = useCallback(() => {
        return playSound('NEW_TICKET');
    }, [playSound]);

    // Play sound for new message
    const playMessageSound = useCallback(() => {
        return playSound('MESSAGE');
    }, [playSound]);

    // Play sound for critical alert
    const playCriticalSound = useCallback(() => {
        return playSound('CRITICAL');
    }, [playSound]);

    // Play sound for assignment
    const playAssignedSound = useCallback(() => {
        return playSound('ASSIGNED');
    }, [playSound]);

    // Play sound for resolved
    const playResolvedSound = useCallback(() => {
        return playSound('RESOLVED');
    }, [playSound]);

    // Update enabled state
    const setEnabled = useCallback((enabled: boolean) => {
        setSettings(prev => ({ ...prev, enabled }));
    }, []);

    // Update volume (0.0 to 1.0)
    const setVolume = useCallback((volume: number) => {
        setSettings(prev => ({ ...prev, volume: Math.max(0, Math.min(1, volume)) }));
    }, []);

    // Toggle enabled
    const toggleSound = useCallback(() => {
        setSettings(prev => ({ ...prev, enabled: !prev.enabled }));
    }, []);

    // Clear cache (call when user updates sound settings)
    const clearCache = useCallback(() => {
        soundUrlCache.clear();
    }, []);

    // Test sound playback
    const testSound = useCallback(async (eventType: NotificationEventType = 'NEW_TICKET') => {
        const wasEnabled = settings.enabled;
        if (!wasEnabled) {
            setSettings(prev => ({ ...prev, enabled: true }));
        }

        await playSound(eventType);

        if (!wasEnabled) {
            setSettings(prev => ({ ...prev, enabled: false }));
        }
    }, [settings.enabled, playSound]);

    return {
        // State
        enabled: settings.enabled,
        volume: settings.volume,

        // Actions
        playSound,
        playNewTicketSound,
        playMessageSound,
        playCriticalSound,
        playAssignedSound,
        playResolvedSound,
        previewSoundUrl,

        // Settings
        setEnabled,
        setVolume,
        toggleSound,

        // Utilities
        clearCache,
        testSound,
    };
};

export default useSoundNotification;
