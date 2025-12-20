import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PermissionsService } from './permissions.service';
import { PermissionsController } from './permissions.controller';
import { FeatureDefinition } from './entities/feature-definition.entity';
import { UserFeaturePermission } from './entities/user-feature-permission.entity';
import { PermissionPreset } from './entities/permission-preset.entity';
import { User } from '../users/entities/user.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            FeatureDefinition,
            UserFeaturePermission,
            PermissionPreset,
            User,
        ]),
    ],
    controllers: [PermissionsController],
    providers: [PermissionsService],
    exports: [PermissionsService],
})
export class PermissionsModule { }
