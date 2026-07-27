import { useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

export interface RedisQueueDepth {
    name: string;
    waiting: number;
    active: number;
    failed: number;
}

export interface RedisDetail {
    usedMemory: number;
    keys: number;
    queues: RedisQueueDepth[];
}

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
        detail?: RedisDetail;
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

export interface HealthHistory {
    cpu: number[];
    memory: number[];
    dbLatency: number[];
    redisLatency: number[];
}

export interface HealthFastUpdate {
    serverTime: string;
    uptime: number;
    cpuUsage: number;
    memoryUsage: number;
    memoryFree: number;
    loadAverage: number[];
    database: InfrastructureStatus['database'];
    redis: InfrastructureStatus['redis'];
    websocket: InfrastructureStatus['websocket'];
}

export interface HealthSlowUpdate {
    serverTime: string;
    status: DetailedHealthStatus['status'];
    disk: { diskUsage: number; diskTotal: number; diskFree: number };
    services: ServiceStatus[];
    redisDetail?: RedisDetail;
    backup: InfrastructureStatus['backup'];
}

export interface HealthSnapshot extends DetailedHealthStatus {
    serverTime: string;
    history: HealthHistory;
    sampledAt: { fast: string; slow: string };
    redisDetail?: RedisDetail;
}

export interface UseHealthSocketReturn {
    healthData: DetailedHealthStatus | null;
    uptime: number;
    history: HealthHistory;
    isStale: boolean;
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

const STALE_THRESHOLD_MS = 6_000;
const HISTORY_SIZE = 60;

function appendFastSample(history: HealthHistory, update: HealthFastUpdate): HealthHistory {
    const pushCap = (arr: number[], val: number) => [...arr, val].slice(-HISTORY_SIZE);
    const redisLatency =
        update.redis.status === 'connected' && update.redis.latency !== undefined
            ? pushCap(history.redisLatency, update.redis.latency)
            : history.redisLatency;

    return {
        cpu: pushCap(history.cpu, update.cpuUsage),
        memory: pushCap(history.memory, update.memoryUsage),
        dbLatency: pushCap(history.dbLatency, update.database.latency || 0),
        redisLatency,
    };
}

export function useHealthSocket(autoConnect = true): UseHealthSocketReturn {
    const [, setSocket] = useState<Socket | null>(null);
    const [healthData, setHealthData] = useState<DetailedHealthStatus | null>(null);
    const [history, setHistory] = useState<HealthHistory>({ cpu: [], memory: [], dbLatency: [], redisLatency: [] });
    const [isConnected, setIsConnected] = useState(false);
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
    const [incidents, setIncidents] = useState<SystemIncident[]>([]);

    const [uptime, setUptime] = useState(0);
    const [uptimeBase, setUptimeBase] = useState<{ uptime: number; receivedAt: number } | null>(null);
    const [lastFastUpdate, setLastFastUpdate] = useState<number | null>(null);
    const [clockNow, setClockNow] = useState(Date.now());

    const socketRef = useRef<Socket | null>(null);

    useEffect(() => {
        const timer = window.setInterval(() => {
            const now = Date.now();
            setClockNow(now);
            if (uptimeBase) {
                setUptime(uptimeBase.uptime + (now - uptimeBase.receivedAt) / 1_000);
            }
        }, 1_000);
        return () => window.clearInterval(timer);
    }, [uptimeBase]);

    const isStale = Boolean(lastFastUpdate && Date.now() - lastFastUpdate > STALE_THRESHOLD_MS);

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
            setIsConnected(true);
        });

        newSocket.on('disconnect', () => {
            setIsConnected(false);
            setIsSubscribed(false);
            setLastFastUpdate(null);
        });

        newSocket.on('health:snapshot', (snapshot: HealthSnapshot) => {
            setHealthData(snapshot);
            setHistory(snapshot.history);
            setUptimeBase({ uptime: snapshot.uptime, receivedAt: Date.now() });
            setUptime(snapshot.uptime);
            setLastFastUpdate(Date.now());
            setLastUpdate(new Date());
        });

        newSocket.on('health:fast', (update: HealthFastUpdate) => {
            setHealthData((current) => current ? {
                ...current,
                timestamp: update.serverTime,
                uptime: update.uptime,
                system: {
                    ...current.system,
                    cpuUsage: update.cpuUsage,
                    memoryUsage: update.memoryUsage,
                    memoryFree: update.memoryFree,
                    loadAverage: update.loadAverage,
                },
                infrastructure: {
                    ...current.infrastructure,
                    database: update.database,
                    redis: update.redis,
                    websocket: update.websocket,
                },
            } : current);

            setHistory((current) => appendFastSample(current, update));
            setUptimeBase({ uptime: update.uptime, receivedAt: Date.now() });
            setUptime(update.uptime);
            setLastFastUpdate(Date.now());
            setLastUpdate(new Date());
        });

        newSocket.on('health:slow', (update: HealthSlowUpdate) => {
            setHealthData((current) => current ? {
                ...current,
                status: update.status,
                timestamp: update.serverTime,
                system: {
                    ...current.system,
                    diskUsage: update.disk.diskUsage,
                    diskTotal: update.disk.diskTotal,
                    diskFree: update.disk.diskFree,
                },
                infrastructure: {
                    ...current.infrastructure,
                    backup: update.backup,
                    redis: {
                        ...current.infrastructure.redis,
                        detail: update.redisDetail,
                    },
                },
                services: update.services,
            } : current);

            setLastUpdate(new Date());
        });

        newSocket.on('health:incident', (incident: SystemIncident) => {
            setIncidents(prev => [incident, ...prev].slice(0, 50));
        });

        socketRef.current = newSocket;
        setSocket(newSocket);
    }, []);

    const disconnect = useCallback(() => {
        if (socketRef.current) {
            socketRef.current.removeAllListeners();
            socketRef.current.disconnect();
            socketRef.current = null;
            setSocket(null);
            setIsConnected(false);
            setIsSubscribed(false);
            setLastFastUpdate(null);
        }
    }, []);

    const subscribe = useCallback(() => {
        if (socketRef.current?.connected) {
            socketRef.current.emit('health:subscribe');
            setIsSubscribed(true);
        }
    }, []);

    const unsubscribe = useCallback(() => {
        if (socketRef.current?.connected) {
            socketRef.current.emit('health:unsubscribe');
            setIsSubscribed(false);
        }
    }, []);

    useEffect(() => {
        if (autoConnect) {
            connect();
        }

        return () => {
            disconnect();
        };
    }, [autoConnect, connect, disconnect]);

    useEffect(() => {
        if (isConnected && autoConnect && !isSubscribed) {
            subscribe();
        }
    }, [isConnected, autoConnect, isSubscribed, subscribe]);

    return {
        healthData,
        uptime,
        history,
        isStale,
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
