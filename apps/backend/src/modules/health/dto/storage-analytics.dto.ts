export interface StorageVitals {
    totalBytes: number;
    usedBytes: number;
    freeBytes: number;
    usagePercent: number;
    diskPath: string;
    platform: string;
    ideskUsedBytes: number;
    ideskSaturationPercent: number;
    serverFreeBytes: number;
    serverTotalBytes: number;
}

export interface TableStorageInfo {
    tableName: string;
    totalBytes: number;
    prettySize: string;
}

export interface StorageBreakdown {
    attachmentsBytes: number;
    databaseBytes: number;
    systemOverheadBytes: number;
    byFolder: Record<string, { count: number; sizeBytes: number }>;
    topTables: TableStorageInfo[];
}

export interface ProjectionPoint {
    timestamp: string; // ISO date
    dayOffset: number; // e.g. -30, 0, 30, 90, 180, 365
    isProjected: boolean;
    baselineUsedBytes: number;
    highGrowthUsedBytes: number;
    peakGrowthUsedBytes: number;
    warningThresholdBytes: number; // 85% of total
    criticalThresholdBytes: number; // 95% of total
    totalCapacityBytes: number;
}

export interface ForecastingMetrics {
    growthRateBytesPerDay: number;
    growthRateBytesPerMonth: number;
    daysToWarningThreshold: number | null; // null if velocity <= 0
    daysToCriticalThreshold: number | null;
    estimatedWarningDate: string | null;
    estimatedFullDate: string | null;
    runwayStatus: 'healthy' | 'warning' | 'critical';
    timeToWarningFormatted: string;
    timeToCriticalFormatted: string;
}

export interface MitigationSavings {
    imageCompressionSavingsBytes: number;
    autoCleanupSavingsBytes: number;
    totalPotentialSavingsBytes: number;
}

export interface StorageAnalyticsResponseDto {
    vitals: StorageVitals;
    breakdown: StorageBreakdown;
    forecasting: ForecastingMetrics;
    projections: ProjectionPoint[];
    mitigations: MitigationSavings;
    sampledAt: string;
}
