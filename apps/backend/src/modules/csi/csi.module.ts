import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';
import { User } from '../users/entities/user.entity';
import { PermissionPreset } from '../permissions/entities/permission-preset.entity';
import { Site } from '../sites/entities/site.entity';
import { Ticket } from '../ticketing/entities/ticket.entity';
import { CsiSlaService } from './services/csi-sla.service';
import { CsiAdminGuard } from './guards/csi-admin.guard';
import { CsiMasterService } from './services/csi-master.service';
import { CsiAdminMasterController } from './presentation/csi-admin-master.controller';
import { CsiPeriodService } from './services/csi-period.service';
import { CsiAdminPeriodController } from './presentation/csi-admin-period.controller';
import { CsiRespondentService } from './services/csi-respondent.service';
import { CsiMeController } from './presentation/csi-me.controller';
import { CsiReportService } from './services/csi-report.service';
import { CsiExportService } from './services/csi-export.service';
import { CsiAdminReportController } from './presentation/csi-admin-report.controller';
import { CsiMemoSetting } from './entities/csi-memo-setting.entity';
import { CsiMemoService } from './services/csi-memo.service';
import { CsiAdminMemoController } from './presentation/csi-admin-memo.controller';
import { CsiTeam } from './entities/csi-team.entity';
import { CsiSubjectProfile } from './entities/csi-subject-profile.entity';
import { CsiRaterAssignment } from './entities/csi-rater-assignment.entity';
import { CsiPeriodRaterRatee } from './entities/csi-period-rater-ratee.entity';
import { CsiDimension } from './entities/csi-dimension.entity';
import { CsiDepartment } from './entities/csi-department.entity';
import { CsiRater } from './entities/csi-rater.entity';
import { CsiPeriod } from './entities/csi-period.entity';
import { CsiPeriodSite } from './entities/csi-period-site.entity';
import { CsiPeriodRatee } from './entities/csi-period-ratee.entity';
import { CsiPeriodRateeDimension } from './entities/csi-period-ratee-dimension.entity';
import { CsiPeriodRater } from './entities/csi-period-rater.entity';
import { CsiResponse } from './entities/csi-response.entity';
import { CsiResponseItem } from './entities/csi-response-item.entity';
import { CsiResponseComment } from './entities/csi-response-comment.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            CsiDimension, CsiDepartment, CsiRater, CsiPeriod, CsiPeriodSite, CsiPeriodRatee,
            CsiPeriodRateeDimension, CsiPeriodRater, CsiResponse, CsiResponseItem, CsiResponseComment,
            CsiMemoSetting, CsiTeam, CsiSubjectProfile, CsiRaterAssignment, CsiPeriodRaterRatee,
            User, PermissionPreset, Site, Ticket,
        ]),
        AuthModule,
        AuditModule,
    ],
    controllers: [CsiAdminMasterController, CsiAdminPeriodController, CsiAdminReportController, CsiAdminMemoController, CsiMeController],
    providers: [CsiAdminGuard, CsiMasterService, CsiPeriodService, CsiRespondentService, CsiReportService, CsiSlaService, CsiExportService, CsiMemoService],
})
export class CsiModule { }
