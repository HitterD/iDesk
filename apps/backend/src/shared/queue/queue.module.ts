import { Module, Global, Logger, DynamicModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

/**
 * Queue Module Configuration
 * 
 * Environment Variables:
 * - REDIS_HOST: Redis server host (default: localhost)
 * - REDIS_PORT: Redis server port (default: 6379)
 * - REDIS_PASSWORD: Redis password (optional)
 * - REDIS_ENABLED: Set to 'true' to enable Redis queues (default: false)
 * 
 * When Redis is disabled, the system uses in-memory processing.
 * 
 * Available Queues:
 * - notifications: For in-app and push notifications
 * - emails: For email sending (transactional, bulk, ticket notifications)
 * - file-processing: For file processing tasks
 * - reports: For report generation tasks
 */
@Global()
@Module({})
export class QueueModule {
    private static logger = new Logger('QueueModule');

    static forRoot(): DynamicModule {
        const redisEnabled = process.env.REDIS_ENABLED === 'true';

        if (!redisEnabled) {
            this.logger.warn('Redis is disabled. Bull queues will not be available.');
            this.logger.warn('Set REDIS_ENABLED=true in .env to enable queue features.');
            
            // Return empty module when Redis is disabled
            return {
                module: QueueModule,
                imports: [],
                exports: [],
            };
        }

        // Dynamic import of Bull module when Redis is enabled
        const { BullModule } = require('@nestjs/bull');

        this.logger.log('Redis is enabled. Initializing Bull queues...');

        return {
            module: QueueModule,
            imports: [
                BullModule.forRootAsync({
                    imports: [ConfigModule],
                    inject: [ConfigService],
                    useFactory: async (configService: ConfigService) => {
                        const host = configService.get<string>('REDIS_HOST', 'localhost');
                        const port = configService.get<number>('REDIS_PORT', 6379);
                        const password = configService.get<string>('REDIS_PASSWORD');

                        this.logger.log(`Connecting to Redis at ${host}:${port}`);

                        return {
                            redis: {
                                host,
                                port,
                                password: password || undefined,
                            },
                            defaultJobOptions: {
                                removeOnComplete: 100,
                                removeOnFail: 50,
                                attempts: 3,
                                backoff: {
                                    type: 'exponential',
                                    delay: 1000,
                                },
                            },
                        };
                    },
                }),
                BullModule.registerQueue({ name: 'notifications' }),
                BullModule.registerQueue({ name: 'emails' }),
                BullModule.registerQueue({ name: 'file-processing' }),
                BullModule.registerQueue({ name: 'reports' }),
            ],
            exports: [BullModule],
        };
    }
}
