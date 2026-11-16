import { createContext, createElement, useContext, useEffect, useState, type ReactNode } from 'react';
import { QueryClientContext } from '@tanstack/react-query';
import { io, type Socket } from 'socket.io-client';
import { queryKeys } from '@/lib/queryKeys';
import { SOCKET_URL } from '@/lib/socket';
import type { CsiScopeParam } from '../types';

/** Fallback polling interval when WebSocket live push is disconnected. */
export const CSI_LIVE_FALLBACK_POLL_MS = 15_000;

interface CsiUpdatedPayload {
    scope?: string;
    periodId?: string | null;
}

const CsiLiveContext = createContext<boolean | undefined>(undefined);

let csiSocket: Socket | null = null;
function getCsiSocket(): Socket {
    if (!csiSocket) {
        csiSocket = io(`${SOCKET_URL}/csi`, {
            withCredentials: true,
            transports: ['websocket'],
        });
    }
    return csiSocket;
}

export function resetCsiLiveSocketForTests() {
    csiSocket?.disconnect();
    csiSocket = null;
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
        let hadDisconnect = false;

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
            setConnected(true);
            subscribe();
            if (hadDisconnect) {
                hadDisconnect = false;
                invalidateScopeQueries();
            }
        };

        const onDisconnect = () => {
            hadDisconnect = true;
            setConnected(false);
        };

        const onUpdated = (payload?: CsiUpdatedPayload) => {
            if (payload?.scope && payload.scope.toLowerCase() !== scope) return;
            invalidateScopeQueries(payload?.periodId);
        };

        socket.on('connect', onConnect);
        socket.on('disconnect', onDisconnect);
        socket.on('csi:updated', onUpdated);
        if (socket.connected) {
            subscribe();
        }

        return () => {
            socket.emit('csi:unsubscribe', { scope });
            socket.off('connect', onConnect);
            socket.off('disconnect', onDisconnect);
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
