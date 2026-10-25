import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';
import { User } from '../users/entities/user.entity';
import { PermissionPreset } from '../permissions/entities/permission-preset.entity';
import { CsiAdminGuard } from './guards/csi-admin.guard';
import { CsiMasterService } from './services/csi-master.service';
import { CsiAdminMasterController } from './presentation/csi-admin-master.controller';
import { CsiDimension } from './entities/csi-dimension.entity';
import { CsiDepartment } from './entities/csi-department.entity';
import { CsiRater } from './entities/csi-rater.entity';
import { CsiPeriod } from './entities/csi-period.entity';
import { CsiPeriodRatee } from './entities/csi-period-ratee.entity';
import { CsiPeriodRateeDimension } from './entities/csi-period-ratee-dimension.entity';
import { CsiPeriodRater } from './entities/csi-period-rater.entity';
import { CsiResponse } from './entities/csi-response.entity';
import { CsiResponseItem } from './entities/csi-response-item.entity';
import { CsiResponseComment } from './entities/csi-response-comment.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            CsiDimension, CsiDepartment, CsiRater, CsiPeriod, CsiPeriodRatee,
            CsiPeriodRateeDimension, CsiPeriodRater, CsiResponse, CsiResponseItem, CsiResponseComment,
            User, PermissionPreset,
        ]),
        AuthModule,
        AuditModule,
    ],
    controllers: [CsiAdminMasterController],
    providers: [CsiAdminGuard, CsiMasterService],
})
export class CsiModule { }
