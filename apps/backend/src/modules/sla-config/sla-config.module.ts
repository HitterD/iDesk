import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SlaConfigController } from './sla-config.controller';
import { SlaConfigService } from './sla-config.service';
import { SlaConfig } from '../../modules/ticketing/entities/sla-config.entity';
import { BusinessHours } from './entities/business-hours.entity';
import { BusinessHoursService } from './business-hours.service';
import { BusinessHoursController } from './business-hours.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
    imports: [TypeOrmModule.forFeature([SlaConfig, BusinessHours]), AuditModule],
    controllers: [SlaConfigController, BusinessHoursController],
    providers: [SlaConfigService, BusinessHoursService],
    exports: [SlaConfigService, BusinessHoursService],
})
export class SlaConfigModule { }

