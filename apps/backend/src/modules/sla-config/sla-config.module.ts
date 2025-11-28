import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SlaConfigController } from './sla-config.controller';
import { SlaConfigService } from './sla-config.service';
import { SlaConfig } from '../../modules/ticketing/entities/sla-config.entity';

@Module({
    imports: [TypeOrmModule.forFeature([SlaConfig])],
    controllers: [SlaConfigController],
    providers: [SlaConfigService],
})
export class SlaConfigModule { }
