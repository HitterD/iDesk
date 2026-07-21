import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Site } from '../sites/entities/site.entity';
import { Department } from '../users/entities/department.entity';
import { User } from '../users/entities/user.entity';
import { HrisGatewayAdapter } from './hris-gateway.adapter';
import { HrisSyncController } from './hris-sync.controller';
import { HrisSyncService } from './hris-sync.service';
import { PermissionsModule } from '../permissions/permissions.module';

@Module({
    imports: [TypeOrmModule.forFeature([User, Site, Department]), PermissionsModule],
    providers: [HrisGatewayAdapter, HrisSyncService],
    controllers: [HrisSyncController],
    exports: [HrisGatewayAdapter, HrisSyncService],
})
export class HrisGatewayModule {}
