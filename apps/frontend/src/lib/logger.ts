/**
 * Logger utility for iDesk application
 * - In development: logs to console with prefix
 * - In production: suppresses debug logs, only shows errors
 */

const isDev = import.meta.env.DEV;
const isTest = import.meta.env.MODE === 'test';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerOptions {
    prefix?: string;
    timestamp?: boolean;
}

const formatMessage = (level: LogLevel, prefix: string, args: unknown[]): string => {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level.toUpperCase()}] ${prefix}`;
};

const createLogger = (options: LoggerOptions = {}) => {
    const prefix = options.prefix || 'iDesk';

    return {
        debug: (...args: unknown[]) => {
            if (isDev && !isTest) {
                console.log(`[${prefix}]`, ...args);
            }
        },
        
        log: (...args: unknown[]) => {
            if (isDev && !isTest) {
                console.log(`[${prefix}]`, ...args);
            }
        },
        
        info: (...args: unknown[]) => {
            if (isDev && !isTest) {
                console.info(`[${prefix}]`, ...args);
            }
        },
        
        warn: (...args: unknown[]) => {
            if (isDev && !isTest) {
                console.warn(`[${prefix}] WARN:`, ...args);
            }
        },
        
        error: (...args: unknown[]) => {
            // Always log errors, even in production
            console.error(`[${prefix}] ERROR:`, ...args);
        },

        // For socket/websocket specific logs
        socket: (...args: unknown[]) => {
            if (isDev && !isTest) {
                console.log(`[${prefix}:Socket]`, ...args);
            }
        },

        // For API/network related logs
        api: (...args: unknown[]) => {
            if (isDev && !isTest) {
                console.log(`[${prefix}:API]`, ...args);
            }
        },

        // Group logs for complex operations
        group: (label: string, fn: () => void) => {
            if (isDev && !isTest) {
                console.group(`[${prefix}] ${label}`);
                fn();
                console.groupEnd();
            }
        },

        // Time operations
        time: (label: string) => {
            if (isDev && !isTest) {
                console.time(`[${prefix}] ${label}`);
            }
        },

        timeEnd: (label: string) => {
            if (isDev && !isTest) {
                console.timeEnd(`[${prefix}] ${label}`);
            }
        },
    };
};

// Default logger instance
export const logger = createLogger();

// Factory for creating module-specific loggers
export const createModuleLogger = (moduleName: string) => createLogger({ prefix: `iDesk:${moduleName}` });

export default logger;
