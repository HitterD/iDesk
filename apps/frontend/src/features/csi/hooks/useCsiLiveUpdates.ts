import { createContext, createElement, useContext, useEffect, useState, type ReactNode } from 'react';
import { QueryClientContext } from '@tanstack/react-query';
import { io, type Socket } from 'socket.io-client';
import { queryKeys } from '@/lib/queryKeys';
import { SOCKET_URL } from '@/lib/socket';
import type { CsiScopeParam } from '../types';

/** Fallback polling interval when WebSocket live push is disconnected. */
export const CSI_LIVE_FALLBACK_POLL_MS = 15_000;
/** Wait before reconnecting after the server dropped the socket (e.g. expired cookie before refresh). */
export const CSI_SERVER_DISCONNECT_RETRY_MS = 3000;

interface CsiUpdatedPayload {
    scope?: string;
    periodId?: string | null;
}

const CsiLiveContext = createContext<boolean | undefined>(undefined);

/** Strip REST base suffixes (`/api`, `/v1`) so Socket.IO connects to the `/csi` namespace at server origin. */
export function resolveCsiSocketOrigin(rawUrl: string = SOCKET_URL): string {
    return rawUrl
        .replace(/\/v1\/?$/, '')
        .replace(/\/api\/?$/, '')
        .replace(/\/+$/, '');
}

let csiSocket: Socket | null = null;
let hadSocketDrop = false;

function getCsiSocket(): Socket {
    if (!csiSocket) {
        csiSocket = io(`${resolveCsiSocketOrigin()}/csi`, {
            withCredentials: true,
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            timeout: 10000,
        });
    }
    return csiSocket;
}

export function resetCsiLiveSocketForTests() {
    csiSocket?.disconnect();
    csiSocket = null;
    hadSocketDrop = false;
}

/**
 * Subscribes the CSI admin area (`ict` or `hc`) to `/csi` Socket.IO push events
 * and invalidates dashboard, period, report, and respondent status queries.
 * Safe in unit tests without QueryClientProvider (returns `false`).
 */
export function useCsiLiveUpdates(scope: CsiScopeParam): boolean {
    const qc = useContext(QueryClientContext);
    const [connected, setConnected] = useState(() => (qc ? getCsiSocket().connected : false));

    useEffect(() => {
        if (!qc) return;
        const socket = getCsiSocket();
        let retryTimer: ReturnType<typeof setTimeout> | undefined;

        const invalidateScopeQueries = (periodId?: string | null) => {
            qc.invalidateQueries({ queryKey: queryKeys.csi.dashboard(scope) });
            qc.invalidateQueries({ queryKey: queryKeys.csi.periods(scope) });
            qc.invalidateQueries({ queryKey: queryKeys.csi.periodDetails(scope) });
            if (periodId) {
                qc.invalidateQueries({ queryKey: queryKeys.csi.period(scope, periodId) });
                qc.invalidateQueries({ queryKey: queryKeys.csi.report(scope, periodId) });
                qc.invalidateQueries({ queryKey: queryKeys.csi.respondents(scope, periodId) });
                qc.invalidateQueries({ queryKey: queryKeys.csi.assignments(scope, periodId) });
                qc.invalidateQueries({ queryKey: ['csi', scope, 'hc-recap', periodId] });
            } else {
                qc.invalidateQueries({ queryKey: ['csi', scope, 'report'] });
                qc.invalidateQueries({ queryKey: ['csi', scope, 'respondents'] });
                qc.invalidateQueries({ queryKey: ['csi', scope, 'assignments'] });
                qc.invalidateQueries({ queryKey: ['csi', scope, 'hc-recap'] });
            }
        };

        const subscribe = () => {
            socket.emit('csi:subscribe', { scope });
        };

        const onConnect = () => {
            clearTimeout(retryTimer);
            setConnected(true);
            subscribe();
            if (hadSocketDrop) {
                hadSocketDrop = false;
                invalidateScopeQueries();
            }
        };

        const onDisconnect = (reason?: string) => {
            hadSocketDrop = true;
            setConnected(false);
            // socket.io never reconnects on its own after a server-side disconnect (e.g. expired cookie).
            if (reason === 'io server disconnect') {
                clearTimeout(retryTimer);
                retryTimer = setTimeout(() => {
                    socket.connect?.();
                }, CSI_SERVER_DISCONNECT_RETRY_MS);
            }
        };

        const onConnectError = () => {
            hadSocketDrop = true;
            setConnected(false);
        };

        const onUpdated = (payload?: CsiUpdatedPayload) => {
            if (payload?.scope && payload.scope.toLowerCase() !== scope) return;
            invalidateScopeQueries(payload?.periodId);
        };

        socket.on('connect', onConnect);
        socket.on('disconnect', onDisconnect);
        socket.on('connect_error', onConnectError);
        socket.on('csi:updated', onUpdated);
        if (socket.connected) {
            setConnected(true);
            subscribe();
        } else {
            setConnected(false);
            if (typeof socket.connect === 'function' && (socket as { active?: boolean }).active === false) {
                socket.connect();
            }
        }

        return () => {
            clearTimeout(retryTimer);
            socket.emit('csi:unsubscribe', { scope });
            socket.off('connect', onConnect);
            socket.off('disconnect', onDisconnect);
            socket.off('connect_error', onConnectError);
            socket.off('csi:updated', onUpdated);
        };
    }, [qc, scope]);

    return connected;
}

export function CsiLiveProvider({ scope, children }: { scope: CsiScopeParam; children: ReactNode }) {
    const isLive = useCsiLiveUpdates(scope);
    return createElement(CsiLiveContext.Provider, { value: isLive }, children);
}

/** True when inside `CsiLiveProvider` and `/csi` WebSocket is connected. */
export function useCsiLiveStatus(): boolean {
    return useContext(CsiLiveContext) === true;
}

/** Returns `false` when outside `CsiLiveProvider` or when WS is connected; `15_000`ms fallback when WS is disconnected inside `CsiLiveProvider`. */
export function useCsiPollingFallback(): number | false {
    const qc = useContext(QueryClientContext);
    const live = useContext(CsiLiveContext);
    if (!qc || live === undefined || live) return false;
    return CSI_LIVE_FALLBACK_POLL_MS;
}
