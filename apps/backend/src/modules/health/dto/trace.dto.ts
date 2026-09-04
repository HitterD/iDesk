export interface TraceClientInfo {
    app: string;
    browser: string;
    os: string;
    country: string;
    ip: string;
}

export interface TraceEventStep {
    id: string;
    timestamp: string;
    type: 'request' | 'trace' | 'dependency' | 'exception';
    name: string;
    severity: 'Information' | 'Warning' | 'Error';
    message: string;
    durationMs?: number;
    isException?: boolean;
}

export interface TraceExceptionDetails {
    type: string;
    eventTime: string;
    localTime: string;
    message: string;
    failedMethod: string;
    customProperties: Record<string, any>;
    callStack: string;
    relatedItems?: { title: string; description: string }[];
}

export interface RealTraceRecord {
    traceId: string;
    operationId: string;
    operationName: string;
    httpMethod: string;
    endpoint: string;
    totalDurationMs: number;
    statusCode: number;
    statusText: string;
    timestamp: string;
    clientInfo: TraceClientInfo;
    spanCount: number;
    errorCount: number;
    activeNodes: string[];
    connections: { from: string; to: string; status: 'healthy' | 'warning' | 'error' }[];
    nodeMetrics: Record<string, {
        statusCode: number;
        execTimePercent: number;
        latencyMs: number;
        status: 'healthy' | 'warning' | 'error';
        errorBadge?: string;
    }>;
    events: TraceEventStep[];
    exception?: TraceExceptionDetails;
}
