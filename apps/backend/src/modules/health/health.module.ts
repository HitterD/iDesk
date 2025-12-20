import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { HealthGateway } from './health.gateway';

@Module({
    imports: [
        ConfigModule,
        ScheduleModule.forRoot(),
    ],
    controllers: [HealthController],
    providers: [
        HealthService,
        HealthGateway,
    ],
    exports: [HealthService, HealthGateway],
})
export class HealthModule { }
