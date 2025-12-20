import { useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

// Types matching backend DTOs
export interface SystemMetrics {
    cpuUsage: number;
    memoryUsage: number;
    memoryTotal: number;
    memoryFree: number;
    diskUsage: number;
    diskTotal: number;
    diskFree: number;
    platform: string;
    arch: string;
    nodeVersion: string;
    loadAverage: number[];
}

export interface InfrastructureStatus {
    database: {
        status: 'connected' | 'disconnected';
        latency: number;
    };
    redis: {
        status: 'connected' | 'disabled' | 'error';
        latency?: number;
    };
    websocket: {
        status: 'active' | 'inactive';
        clients: number;
    };
    backup: {
        configured: boolean;
        connected?: boolean;
        lastBackup?: string;
    };
}

export interface ServiceStatus {
    name: string;
    module: string;
    status: 'operational' | 'degraded' | 'down';
    latency: number;
    lastChecked: string;
    message?: string;
}

export interface SystemIncident {
    id: string;
    service: string;
    previousStatus: string;
    newStatus: string;
    message: string;
    timestamp: string;
}

export interface DetailedHealthStatus {
    status: 'ok' | 'degraded' | 'error';
    timestamp: string;
    uptime: number;
    version: string;
    system: SystemMetrics;
    infrastructure: InfrastructureStatus;
    services: ServiceStatus[];
    recentIncidents: SystemIncident[];
}

interface UseHealthSocketReturn {
    healthData: DetailedHealthStatus | null;
    isConnected: boolean;
    isSubscribed: boolean;
    lastUpdate: Date | null;
    incidents: SystemIncident[];
    connect: () => void;
    disconnect: () => void;
    subscribe: () => void;
    unsubscribe: () => void;
}

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ||
    import.meta.env.VITE_API_URL ||
    'http://localhost:5050';

/**
 * Custom hook for real-time health monitoring via WebSocket
 */
export function useHealthSocket(autoConnect = true): UseHealthSocketReturn {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [healthData, setHealthData] = useState<DetailedHealthStatus | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
    const [incidents, setIncidents] = useState<SystemIncident[]>([]);
    const socketRef = useRef<Socket | null>(null);

    // Initialize socket connection
    const connect = useCallback(() => {
        if (socketRef.current?.connected) return;

        const newSocket = io(`${SOCKET_URL}/health`, {
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            timeout: 10000,
        });

        newSocket.on('connect', () => {
            console.log('[HealthSocket] Connected');
            setIsConnected(true);
        });

        newSocket.on('disconnect', () => {
            console.log('[HealthSocket] Disconnected');
            setIsConnected(false);
            setIsSubscribed(false);
        });

        newSocket.on('health:update', (data: DetailedHealthStatus) => {
            setHealthData(data);
            setLastUpdate(new Date());
        });

        newSocket.on('health:incident', (incident: SystemIncident) => {
            console.log('[HealthSocket] Incident:', incident);
            setIncidents(prev => [incident, ...prev].slice(0, 50));
        });

        newSocket.on('connect_error', (error) => {
            console.error('[HealthSocket] Connection error:', error.message);
        });

        socketRef.current = newSocket;
        setSocket(newSocket);
    }, []);

    // Disconnect socket
    const disconnect = useCallback(() => {
        if (socketRef.current) {
            socketRef.current.removeAllListeners();
            socketRef.current.disconnect();
            socketRef.current = null;
            setSocket(null);
            setIsConnected(false);
            setIsSubscribed(false);
        }
    }, []);

    // Subscribe to health updates
    const subscribe = useCallback(() => {
        if (socketRef.current?.connected) {
            socketRef.current.emit('health:subscribe');
            setIsSubscribed(true);
            console.log('[HealthSocket] Subscribed to updates');
        }
    }, []);

    // Unsubscribe from health updates
    const unsubscribe = useCallback(() => {
        if (socketRef.current?.connected) {
            socketRef.current.emit('health:unsubscribe');
            setIsSubscribed(false);
            console.log('[HealthSocket] Unsubscribed from updates');
        }
    }, []);

    // Auto-connect and subscribe on mount
    useEffect(() => {
        if (autoConnect) {
            connect();
        }

        return () => {
            disconnect();
        };
    }, [autoConnect, connect, disconnect]);

    // Auto-subscribe when connected
    useEffect(() => {
        if (isConnected && autoConnect && !isSubscribed) {
            subscribe();
        }
    }, [isConnected, autoConnect, isSubscribed, subscribe]);

    return {
        healthData,
        isConnected,
        isSubscribed,
        lastUpdate,
        incidents,
        connect,
        disconnect,
        subscribe,
        unsubscribe,
    };
}
