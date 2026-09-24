import { useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import api from '@/lib/api';
import { EndToEndTrace } from '../components/system-health/serviceMapTypes';

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

export interface ProcessMetrics {
    pid: number;
    heapUsed: number;
    heapTotal: number;
    rss: number;
    external: number;
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
    process?: ProcessMetrics;
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
    sjaNotification?: {
        status: 'connected' | 'degraded' | 'disconnected';
        latency?: number;
        activeDevices?: number;
        onlineSockets?: number;
        authProtocol?: string;
        hubUrl?: string;
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
    wsClients: number[];
}

export interface HealthFastUpdate {
    serverTime: string;
    uptime: number;
    cpuUsage: number;
    memoryUsage: number;
    memoryTotal: number;
    memoryFree: number;
    loadAverage: number[];
    process?: ProcessMetrics;
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

export interface WebSocketFrame {
    id: string;
    timestamp: string;
    event: string;
    bytes: number;
    direction: 'in' | 'out';
    payloadPreview: string;
    rawPayload?: any;
}

export interface GatewayTelemetry {
    subscribers: number;
    transport: string;
    throughputPerSec: number;
    uptimeSeconds: number;
    activeRooms: string[];
}

export interface UseHealthSocketReturn {
    healthData: DetailedHealthStatus | null;
    uptime: number;
    history: HealthHistory;
    isStale: boolean;
    isConnected: boolean;
    isSubscribed: boolean;
    isPaused: boolean;
    pingLatency: number | null;
    lastUpdate: Date | null;
    incidents: SystemIncident[];
    realTraces: EndToEndTrace[];
    recentFrames: WebSocketFrame[];
    transportType: string;
    gatewayTelemetry: GatewayTelemetry | null;
    reconnectCount: number;
    connect: () => void;
    disconnect: () => void;
    subscribe: () => void;
    unsubscribe: () => void;
    togglePause: () => void;
    forceRefresh: () => Promise<void>;
    triggerPingTest: () => Promise<number>;
    clearFrames: () => void;
}

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ||
    import.meta.env.VITE_API_URL ||
    (typeof window !== 'undefined' ? window.location.origin : '');

const STALE_THRESHOLD_MS = 6_000;
const HISTORY_SIZE = 60;

function appendFastSample(history: HealthHistory, update: HealthFastUpdate): HealthHistory {
    const pushCap = (arr: number[] = [], val: number) => [...arr, val].slice(-HISTORY_SIZE);
    const redisLatency =
        update.redis?.status === 'connected' && update.redis?.latency !== undefined
            ? pushCap(history.redisLatency, update.redis.latency)
            : history.redisLatency || [];

    return {
        cpu: pushCap(history.cpu, update.cpuUsage),
        memory: pushCap(history.memory, update.memoryUsage),
        dbLatency: pushCap(history.dbLatency, update.database?.latency || 0),
        redisLatency,
        wsClients: pushCap(history.wsClients, update.websocket?.clients || 0),
    };
}

export function useHealthSocket(autoConnect = true): UseHealthSocketReturn {
    const [, setSocket] = useState<Socket | null>(null);
    const [healthData, setHealthData] = useState<DetailedHealthStatus | null>(null);
    const [history, setHistory] = useState<HealthHistory>({
        cpu: [],
        memory: [],
        dbLatency: [],
        redisLatency: [],
        wsClients: [],
    });
    const [isConnected, setIsConnected] = useState(false);
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [pingLatency, setPingLatency] = useState<number | null>(null);
    const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
    const [incidents, setIncidents] = useState<SystemIncident[]>([]);
    const [realTraces, setRealTraces] = useState<EndToEndTrace[]>([]);

    const [uptime, setUptime] = useState(0);
    const [uptimeBase, setUptimeBase] = useState<{ uptime: number; receivedAt: number } | null>(null);
    const [lastFastUpdate, setLastFastUpdate] = useState<number | null>(null);
    const [recentFrames, setRecentFrames] = useState<WebSocketFrame[]>([]);
    const [transportType, setTransportType] = useState<string>('websocket');
    const [gatewayTelemetry, setGatewayTelemetry] = useState<GatewayTelemetry | null>(null);
    const [reconnectCount, setReconnectCount] = useState<number>(0);

    const socketRef = useRef<Socket | null>(null);
    const isPausedRef = useRef(false);
    isPausedRef.current = isPaused;

    const logFrame = useCallback((event: string, payload: any, direction: 'in' | 'out' = 'in') => {
        try {
            const json = JSON.stringify(payload);
            const frame: WebSocketFrame = {
                id: `fr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                timestamp: new Date().toISOString(),
                event,
                bytes: json.length,
                direction,
                payloadPreview: json.length > 80 ? json.substring(0, 80) + '...' : json,
                rawPayload: payload,
            };
            setRecentFrames((prev) => [frame, ...prev].slice(0, 30));
        } catch {}
    }, []);

    const clearFrames = useCallback(() => {
        setRecentFrames([]);
    }, []);

    // Running local uptime ticker
    useEffect(() => {
        const timer = window.setInterval(() => {
            const now = Date.now();
            if (uptimeBase && !isPaused) {
                setUptime(uptimeBase.uptime + (now - uptimeBase.receivedAt) / 1_000);
            }
        }, 1_000);
        return () => window.clearInterval(timer);
    }, [uptimeBase, isPaused]);

    // Client-server ping interval for network latency calculation
    useEffect(() => {
        if (!isConnected || !socketRef.current) return;

        const pingInterval = window.setInterval(() => {
            if (socketRef.current?.connected) {
                const startTime = Date.now();
                socketRef.current.emit('health:ping', (response: any) => {
                    const latency = Date.now() - startTime;
                    setPingLatency(latency);
                    if (response) {
                        setGatewayTelemetry({
                            subscribers: response.subscribers || 1,
                            transport: response.transport || 'websocket',
                            throughputPerSec: response.throughputPerSec || 0,
                            uptimeSeconds: response.uptimeSeconds || 0,
                            activeRooms: response.activeRooms || ['health-updates'],
                        });
                        setTransportType(response.transport || 'websocket');
                    }
                });
            }
        }, 4_000);

        return () => window.clearInterval(pingInterval);
    }, [isConnected]);

    const triggerPingTest = useCallback(async (): Promise<number> => {
        if (!socketRef.current?.connected) return 0;
        return new Promise<number>((resolve) => {
            const startTime = Date.now();
            logFrame('health:ping', { clientTime: startTime }, 'out');
            socketRef.current?.emit('health:ping', (response: any) => {
                const latency = Date.now() - startTime;
                setPingLatency(latency);
                if (response) {
                    setGatewayTelemetry({
                        subscribers: response.subscribers || 1,
                        transport: response.transport || 'websocket',
                        throughputPerSec: response.throughputPerSec || 0,
                        uptimeSeconds: response.uptimeSeconds || 0,
                        activeRooms: response.activeRooms || ['health-updates'],
                    });
                    setTransportType(response.transport || 'websocket');
                    logFrame('health:pong', response, 'in');
                }
                resolve(latency);
            });
        });
    }, [logFrame]);

    const isStale = Boolean(
        !isPaused && lastFastUpdate && Date.now() - lastFastUpdate > STALE_THRESHOLD_MS
    );

    const togglePause = useCallback(() => {
        setIsPaused(prev => !prev);
    }, []);

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
            try {
                const transport = (newSocket.io as any)?.engine?.transport?.name || 'websocket';
                setTransportType(transport);
            } catch {}
        });

        newSocket.io?.on?.('reconnect', () => {
            setReconnectCount((c) => c + 1);
        });

        newSocket.on('disconnect', () => {
            setIsConnected(false);
            setIsSubscribed(false);
            setLastFastUpdate(null);
            setPingLatency(null);
        });

        newSocket.on('health:snapshot', (snapshot: HealthSnapshot) => {
            logFrame('health:snapshot', snapshot);
            if (isPausedRef.current) return;
            setHealthData(snapshot);
            setHistory({
                cpu: snapshot.history?.cpu || [],
                memory: snapshot.history?.memory || [],
                dbLatency: snapshot.history?.dbLatency || [],
                redisLatency: snapshot.history?.redisLatency || [],
                wsClients: (snapshot.history as any)?.wsClients || [],
            });
            setUptimeBase({ uptime: snapshot.uptime, receivedAt: Date.now() });
            setUptime(snapshot.uptime);
            setLastFastUpdate(Date.now());
            setLastUpdate(new Date());
        });

        newSocket.on('health:fast', (update: HealthFastUpdate) => {
            logFrame('health:fast', update);
            if (isPausedRef.current) return;
            setHealthData((current) => current ? {
                ...current,
                timestamp: update.serverTime,
                uptime: update.uptime,
                system: {
                    ...current.system,
                    cpuUsage: update.cpuUsage,
                    memoryUsage: update.memoryUsage,
                    memoryTotal: update.memoryTotal || current.system.memoryTotal,
                    memoryFree: update.memoryFree,
                    loadAverage: update.loadAverage,
                    process: update.process || current.system.process,
                },
                infrastructure: {
                    ...current.infrastructure,
                    database: update.database,
                    redis: {
                        ...update.redis,
                        detail: current.infrastructure.redis?.detail,
                    },
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
            logFrame('health:slow', update);
            if (isPausedRef.current) return;
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
            logFrame('health:incident', incident);
            setIncidents(prev => [incident, ...prev].slice(0, 50));
        });

        newSocket.on('telemetry:trace', (trace: EndToEndTrace) => {
            logFrame('telemetry:trace', trace);
            setRealTraces(prev => [trace, ...prev.filter(t => t.traceId !== trace.traceId)].slice(0, 50));
        });

        socketRef.current = newSocket;
        setSocket(newSocket);
    }, [logFrame]);

    const disconnect = useCallback(() => {
        if (socketRef.current) {
            socketRef.current.removeAllListeners();
            socketRef.current.disconnect();
            socketRef.current = null;
            setSocket(null);
            setIsConnected(false);
            setIsSubscribed(false);
            setLastFastUpdate(null);
            setPingLatency(null);
        }
    }, []);

    const subscribe = useCallback(() => {
        if (socketRef.current?.connected) {
            logFrame('health:subscribe', {}, 'out');
            socketRef.current.emit('health:subscribe');
            setIsSubscribed(true);
        }
    }, [logFrame]);

    const unsubscribe = useCallback(() => {
        if (socketRef.current?.connected) {
            logFrame('health:unsubscribe', {}, 'out');
            socketRef.current.emit('health:unsubscribe');
            setIsSubscribed(false);
        }
    }, [logFrame]);

    const forceRefresh = useCallback(async (): Promise<void> => {
        if (socketRef.current?.connected) {
            logFrame('health:force-refresh', {}, 'out');
            socketRef.current.emit('health:force-refresh');
        }
    }, [logFrame]);

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

    useEffect(() => {
        api?.get?.('/health/traces')
            ?.then((res: any) => {
                if (Array.isArray(res?.data) && res.data.length > 0) {
                    setRealTraces(res.data);
                }
            })
            ?.catch(() => {});
    }, []);

    return {
        healthData,
        uptime,
        history,
        isStale,
        isConnected,
        isSubscribed,
        isPaused,
        pingLatency,
        lastUpdate,
        incidents,
        realTraces,
        recentFrames,
        transportType,
        gatewayTelemetry,
        reconnectCount,
        connect,
        disconnect,
        subscribe,
        unsubscribe,
        togglePause,
        forceRefresh,
        triggerPingTest,
        clearFrames,
    };
}

