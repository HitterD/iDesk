import { useState, useEffect, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { logger } from '../lib/logger';

interface PushNotificationState {
    isSupported: boolean;
    permission: NotificationPermission;
    isSubscribed: boolean;
    isLoading: boolean;
    subscriptionCount: number;
}

interface PushStatus {
    isConfigured: boolean;
    isSubscribed: boolean;
    subscriptionCount: number;
    publicKey: string | null;
}

interface PushSubscriptionDevice {
    id: string;
    deviceName: string;
    createdAt: string;
    lastPushAt: string | null;
}

// Check if push notifications are supported
const isPushSupported = (): boolean => {
    return (
        'serviceWorker' in navigator &&
        'PushManager' in window &&
        'Notification' in window
    );
};

// Convert URL-safe base64 to Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

export const usePushNotifications = () => {
    const queryClient = useQueryClient();
    const [state, setState] = useState<PushNotificationState>({
        isSupported: isPushSupported(),
        permission: isPushSupported() ? Notification.permission : 'denied',
        isSubscribed: false,
        isLoading: true,
        subscriptionCount: 0,
    });

    // Fetch push status from backend
    const { data: pushStatus, refetch: refetchStatus } = useQuery<PushStatus>({
        queryKey: ['push-status'],
        queryFn: async () => {
            const res = await api.get('/notifications/push/status');
            return res.data;
        },
        enabled: state.isSupported,
        staleTime: 60000,
    });

    // Fetch subscription list
    const { data: subscriptions = [], refetch: refetchSubscriptions } = useQuery<PushSubscriptionDevice[]>({
        queryKey: ['push-subscriptions'],
        queryFn: async () => {
            const res = await api.get('/notifications/push/subscriptions');
            return res.data;
        },
        enabled: state.isSupported && state.isSubscribed,
    });

    // Subscribe mutation
    const subscribeMutation = useMutation({
        mutationFn: async (subscription: PushSubscriptionJSON) => {
            const res = await api.post('/notifications/push/subscribe', {
                subscription: {
                    endpoint: subscription.endpoint,
                    keys: subscription.keys,
                },
            });
            return res.data;
        },
        onSuccess: () => {
            setState((prev) => ({ ...prev, isSubscribed: true }));
            refetchStatus();
            refetchSubscriptions();
            queryClient.invalidateQueries({ queryKey: ['notification-preferences'] });
        },
    });

    // Unsubscribe mutation
    const unsubscribeMutation = useMutation({
        mutationFn: async (endpoint: string) => {
            const res = await api.post('/notifications/push/unsubscribe', { endpoint });
            return res.data;
        },
        onSuccess: () => {
            refetchStatus();
            refetchSubscriptions();
            queryClient.invalidateQueries({ queryKey: ['notification-preferences'] });
        },
    });

    // Check current subscription status
    const checkSubscription = useCallback(async () => {
        if (!state.isSupported) {
            setState((prev) => ({ ...prev, isLoading: false }));
            return;
        }

        try {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();

            setState((prev) => ({
                ...prev,
                isSubscribed: !!subscription,
                permission: Notification.permission,
                isLoading: false,
            }));
        } catch (error) {
            logger.error('Error checking push subscription:', error);
            setState((prev) => ({ ...prev, isLoading: false }));
        }
    }, [state.isSupported]);

    // Subscribe to push notifications
    const subscribe = useCallback(async (): Promise<boolean> => {
        if (!state.isSupported) {
            logger.warn('Push notifications not supported');
            return false;
        }

        try {
            setState((prev) => ({ ...prev, isLoading: true }));

            // Request notification permission
            const permission = await Notification.requestPermission();
            setState((prev) => ({ ...prev, permission }));

            if (permission !== 'granted') {
                logger.warn('Notification permission denied');
                setState((prev) => ({ ...prev, isLoading: false }));
                return false;
            }

            // Get VAPID public key from backend
            if (!pushStatus?.publicKey) {
                logger.error('VAPID public key not available');
                setState((prev) => ({ ...prev, isLoading: false }));
                return false;
            }

            // Register service worker if not already registered
            let registration = await navigator.serviceWorker.getRegistration();
            if (!registration) {
                registration = await navigator.serviceWorker.register('/sw.js');
                await navigator.serviceWorker.ready;
            }

            // Subscribe to push
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(pushStatus.publicKey).buffer as ArrayBuffer,
            });

            // Send subscription to backend
            await subscribeMutation.mutateAsync(subscription.toJSON());

            setState((prev) => ({ ...prev, isSubscribed: true, isLoading: false }));
            return true;
        } catch (error) {
            logger.error('Error subscribing to push:', error);
            setState((prev) => ({ ...prev, isLoading: false }));
            return false;
        }
    }, [state.isSupported, pushStatus?.publicKey, subscribeMutation]);

    // Unsubscribe from push notifications
    const unsubscribe = useCallback(async (): Promise<boolean> => {
        if (!state.isSupported) return false;

        try {
            setState((prev) => ({ ...prev, isLoading: true }));

            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();

            if (subscription) {
                // Unsubscribe from browser
                await subscription.unsubscribe();

                // Notify backend
                await unsubscribeMutation.mutateAsync(subscription.endpoint);
            }

            setState((prev) => ({ ...prev, isSubscribed: false, isLoading: false }));
            return true;
        } catch (error) {
            logger.error('Error unsubscribing from push:', error);
            setState((prev) => ({ ...prev, isLoading: false }));
            return false;
        }
    }, [state.isSupported, unsubscribeMutation]);

    // Register service worker on mount
    useEffect(() => {
        if (!state.isSupported) return;

        const registerSW = async () => {
            try {
                const registration = await navigator.serviceWorker.register('/sw.js');
                logger.log('Service Worker registered:', registration.scope);
            } catch (error) {
                logger.error('Service Worker registration failed:', error);
            }
        };

        registerSW();
        checkSubscription();
    }, [state.isSupported, checkSubscription]);

    // Update state when push status changes
    useEffect(() => {
        if (pushStatus) {
            setState((prev) => ({
                ...prev,
                isSubscribed: pushStatus.isSubscribed,
                subscriptionCount: pushStatus.subscriptionCount,
            }));
        }
    }, [pushStatus]);

    return {
        // State
        isSupported: state.isSupported,
        permission: state.permission,
        isSubscribed: state.isSubscribed,
        isLoading: state.isLoading || subscribeMutation.isPending || unsubscribeMutation.isPending,
        subscriptionCount: state.subscriptionCount,
        isConfigured: pushStatus?.isConfigured ?? false,
        subscriptions,

        // Actions
        subscribe,
        unsubscribe,
        checkSubscription,
        refetchStatus,

        // Status helpers
        canSubscribe: state.isSupported && state.permission !== 'denied' && pushStatus?.isConfigured,
        needsPermission: state.isSupported && state.permission === 'default',
        isPermissionDenied: state.permission === 'denied',
    };
};

export default usePushNotifications;
