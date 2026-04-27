import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useActionItems } from './useActionItems';
import api from '@/lib/api';

export const useReminderEngine = () => {
    const { items, counts } = useActionItems();
    const lastReminderTime = useRef<number>(Date.now());

    useEffect(() => {
        if (counts.critical === 0 && counts.high === 0) return;

        const checkReminders = async () => {
            try {
                // Fetch user preferences for reminder intensity
                const prefRes = await api.get('/notifications/preferences');
                const intensity = prefRes.data?.reminderIntensity || 'MODERATE';
                
                let intervalMs = 0;
                if (intensity === 'GENTLE') intervalMs = 60 * 60 * 1000;
                else if (intensity === 'MODERATE') intervalMs = 30 * 60 * 1000;
                else if (intensity === 'ASSERTIVE') intervalMs = 15 * 60 * 1000;

                if (intervalMs === 0) return; // OFF

                const now = Date.now();
                if (now - lastReminderTime.current >= intervalMs) {
                    // Trigger reminder
                    toast.error(`You have ${counts.critical + counts.high} pending action items!`, {
                        description: 'Please check your Action Command Center.',
                        duration: 10000,
                    });
                    lastReminderTime.current = now;
                }
            } catch (e) {
                console.error("Failed to check reminder preferences", e);
            }
        };

        const intervalId = setInterval(checkReminders, 60000); // Check every minute
        return () => clearInterval(intervalId);
    }, [counts.critical, counts.high]);
};
