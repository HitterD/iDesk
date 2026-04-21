import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PermissionsService } from './permissions.service';
import { PermissionsController } from './permissions.controller';
import { PermissionsGateway } from './permissions.gateway';
import { FeatureDefinition } from './entities/feature-definition.entity';
import { UserFeaturePermission } from './entities/user-feature-permission.entity';
import { PermissionPreset } from './entities/permission-preset.entity';
import { User } from '../users/entities/user.entity';
import { AuditModule } from '../audit/audit.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            FeatureDefinition,
            UserFeaturePermission,
            PermissionPreset,
            User,
        ]),
        AuditModule,
    ],
    controllers: [PermissionsController],
    providers: [PermissionsService, PermissionsGateway],
    exports: [PermissionsService, PermissionsGateway],
})
export class PermissionsModule { }

