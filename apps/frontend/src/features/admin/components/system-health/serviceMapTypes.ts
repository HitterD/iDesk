export type ServiceTier = 'client' | 'gateway' | 'core' | 'storage' | 'external';

export type NodeHealthStatus = 'healthy' | 'warning' | 'error' | 'disabled';

export interface ServiceNodeData {
    id: string;
    name: string;
    label: string;
    tier: ServiceTier;
    statusCode: number;
    execTimePercent: number;
    latencyMs: number;
    status: NodeHealthStatus;
    iconType: string;
    errorCount?: number;
    errorBadge?: string;
    errorMessage?: string;
    description?: string;
}

export interface TraceEventStep {
    id: string;
    timestamp: string;
    type: 'trace' | 'dependency' | 'exception' | 'event' | 'request';
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
    customProperties: {
        azureAdClientId?: string;
        applicationName?: string;
        identityName?: string;
        referer?: string;
        traceId?: string;
        operationId?: string;
        clientIp?: string;
        endpoint?: string;
        status?: number;
    };
    callStack: string;
    relatedItems?: Array<{
        title: string;
        description: string;
    }>;
}

export interface EndToEndTrace {
    traceId: string;
    operationId: string;
    operationName: string;
    httpMethod: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    endpoint: string;
    totalDurationMs: number;
    statusCode: number;
    statusText: string;
    timestamp: string;
    clientInfo: {
        app: string;
        browser: string;
        os: string;
        country: string;
        ip: string;
    };
    spanCount: number;
    errorCount: number;
    activeNodes: string[];
    connections: Array<{
        from: string;
        to: string;
        status: 'healthy' | 'error';
    }>;
    nodeMetrics: Record<string, {
        statusCode: number;
        execTimePercent: number;
        latencyMs: number;
        status: NodeHealthStatus;
        errorBadge?: string;
    }>;
    events: TraceEventStep[];
    exception?: TraceExceptionDetails;
}
