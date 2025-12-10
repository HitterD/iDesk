import { Module, Global } from '@nestjs/common';
import { CacheService } from './cache.service';
import { CacheInvalidationService } from './cache-invalidation.service';

@Global()
@Module({
    providers: [CacheService, CacheInvalidationService],
    exports: [CacheService, CacheInvalidationService],
})
export class AppCacheModule { }
