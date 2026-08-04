import { Module, Global } from '@nestjs/common';
import { CacheService } from './cache.service';
import { CacheInvalidationService } from './cache-invalidation.service';
import { RedisClientService } from './redis-client.service';

@Global()
@Module({
    providers: [RedisClientService, CacheService, CacheInvalidationService],
    exports: [RedisClientService, CacheService, CacheInvalidationService],
})
export class AppCacheModule { }
