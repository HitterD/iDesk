import { Logger as TypeOrmLogger, QueryRunner } from 'typeorm';
import { Logger } from '@nestjs/common';

/**
 * Custom TypeORM Logger with Slow Query Detection
 * 
 * Features:
 * - Only logs slow queries (above threshold) to reduce noise
 * - Logs all query errors for debugging
 * - Provides structured logging format
 * - Configurable via environment variables
 */
export class CustomTypeOrmLogger implements TypeOrmLogger {
    private readonly logger = new Logger('TypeORM');

    // Queries taking longer than this are logged as warnings
    private readonly slowQueryThreshold: number;
    private readonly isProduction: boolean;

    constructor() {
        this.slowQueryThreshold = parseInt(process.env.SLOW_QUERY_THRESHOLD_MS || '1000', 10);
        this.isProduction = process.env.NODE_ENV === 'production';
    }

    /**
     * Log a query - only in development mode
     */
    logQuery(query: string, parameters?: any[], queryRunner?: QueryRunner) {
        if (!this.isProduction && process.env.DB_LOGGING === 'true') {
            this.logger.debug(this.formatQuery(query, parameters));
        }
    }

    /**
     * Log a slow query - always logged regardless of environment
     */
    logQuerySlow(time: number, query: string, parameters?: any[], queryRunner?: QueryRunner) {
        this.logger.warn({
            message: 'SLOW_QUERY',
            durationMs: time,
            threshold: this.slowQueryThreshold,
            query: this.truncateQuery(query),
            parameters: this.isProduction ? '[hidden]' : parameters,
        });
    }

    /**
     * Log query errors - always logged
     */
    logQueryError(error: string | Error, query: string, parameters?: any[], queryRunner?: QueryRunner) {
        const errorMessage = typeof error === 'string' ? error : error.message;

        this.logger.error({
            message: 'QUERY_ERROR',
            error: errorMessage,
            query: this.truncateQuery(query),
            parameters: this.isProduction ? '[hidden]' : parameters,
        });
    }

    /**
     * Log schema build operations
     */
    logSchemaBuild(message: string, queryRunner?: QueryRunner) {
        this.logger.log(`Schema: ${message}`);
    }

    /**
     * Log migrations
     */
    logMigration(message: string, queryRunner?: QueryRunner) {
        this.logger.log(`Migration: ${message}`);
    }

    /**
     * Log general messages
     */
    log(level: 'log' | 'info' | 'warn', message: any, queryRunner?: QueryRunner) {
        switch (level) {
            case 'warn':
                this.logger.warn(message);
                break;
            case 'info':
            case 'log':
            default:
                if (!this.isProduction) {
                    this.logger.log(message);
                }
                break;
        }
    }

    /**
     * Truncate long queries for logging
     */
    private truncateQuery(query: string): string {
        const maxLength = 500;
        if (query.length > maxLength) {
            return query.substring(0, maxLength) + '... [truncated]';
        }
        return query;
    }

    /**
     * Format query with parameters for development logging
     */
    private formatQuery(query: string, parameters?: any[]): string {
        if (!parameters || parameters.length === 0) {
            return query;
        }
        return `${this.truncateQuery(query)} -- params: ${JSON.stringify(parameters)}`;
    }
}
