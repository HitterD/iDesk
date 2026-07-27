import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { HealthGateway } from './health.gateway';
import { HealthSamplerService } from './health-sampler.service';

@Module({
    imports: [
        ConfigModule,
        ScheduleModule.forRoot(),
    ],
    controllers: [HealthController],
    providers: [
        HealthService,
        HealthSamplerService,
        HealthGateway,
    ],
    exports: [HealthService, HealthSamplerService, HealthGateway],
})
export class HealthModule { }
