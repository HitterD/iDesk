import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../modules/users/entities/user.entity';
import { PermissionPreset } from '../../modules/permissions/entities/permission-preset.entity';
import { PageAccessGuard } from './guards/page-access.guard';
import { FeatureAccessGuard } from './guards/feature-access.guard';

/**
 * SharedGuardsModule
 * 
 * Global module that provides guards with their TypeORM dependencies.
 * This solves dependency injection issues when guards need repository access
 * across different feature modules.
 * 
 * Guards exported:
 * - PageAccessGuard: Checks page-level access from presets
 * - FeatureAccessGuard: Checks feature-level CRUD access from presets
 */
@Global()
@Module({
    imports: [
        TypeOrmModule.forFeature([User, PermissionPreset]),
    ],
    providers: [PageAccessGuard, FeatureAccessGuard],
    exports: [PageAccessGuard, FeatureAccessGuard, TypeOrmModule],
})
export class SharedGuardsModule { }
