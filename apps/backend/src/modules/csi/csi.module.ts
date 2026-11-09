import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';
import { NotificationModule } from '../notifications/notification.module';
import { Notification } from '../notifications/entities/notification.entity';
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
import { CsiAdminReportController, CsiAdminReportSignoffController } from './presentation/csi-admin-report.controller';
import { CsiMemoSetting } from './entities/csi-memo-setting.entity';
import { CsiMemoService } from './services/csi-memo.service';
import { CsiAdminMemoController } from './presentation/csi-admin-memo.controller';
import { CsiSubjectService } from './services/csi-subject.service';
import { CsiAssignmentService } from './services/csi-assignment.service';
import { CsiAdminSubjectController } from './presentation/csi-admin-subject.controller';
import { CsiAdminAssignmentController } from './presentation/csi-admin-assignment.controller';
import { CsiReminderService } from './services/csi-reminder.service';
import { CsiDashboardService } from './services/csi-dashboard.service';
import { CsiAdminDashboardController } from './presentation/csi-admin-dashboard.controller';
import { CsiTeam } from './entities/csi-team.entity';
import { CsiSubjectProfile } from './entities/csi-subject-profile.entity';
import { CsiRaterAssignment } from './entities/csi-rater-assignment.entity';
import { CsiPeriodRaterRatee } from './entities/csi-period-rater-ratee.entity';
import { CsiDimension } from './entities/csi-dimension.entity';
import { CsiQuestionSet } from './entities/csi-question-set.entity';
import { CsiQuestionSetService } from './services/csi-question-set.service';
import { CsiAdminQuestionSetController } from './presentation/csi-admin-question-set.controller';
import { CsiAdminRaterBulkController } from './presentation/csi-admin-rater-bulk.controller';
import { CsiRaterBulkService } from './services/csi-rater-bulk.service';
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
import { CsiOrgPerson } from './entities/csi-org-person.entity';
import { CsiPic } from './entities/csi-pic.entity';
import { CsiOrgService } from './org/csi-org.service';
import { CsiUnitRulesService } from './org/csi-unit-rules.service';
import { CsiPairsExcelService } from './org/csi-pairs-excel.service';
import { CsiAdminOrgController } from './presentation/csi-admin-org.controller';
import { CsiServiceReportOwner } from './entities/csi-service-report-owner.entity';
import { CsiAccessReader } from './guards/csi-access-reader';
import { CsiReportAccessService } from './services/csi-report-access.service';
import { CsiAdminReportOwnerController } from './presentation/csi-admin-report-owner.controller';
import { SystemSettings } from '../settings/entities/system-settings.entity';
import { ReportSignoffService } from '../reports/services/report-signoff.service';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            CsiDimension, CsiDepartment, CsiRater, CsiPeriod, CsiPeriodSite, CsiPeriodRatee,
            CsiPeriodRateeDimension, CsiPeriodRater, CsiResponse, CsiResponseItem, CsiResponseComment,
            CsiMemoSetting, CsiTeam, CsiSubjectProfile, CsiRaterAssignment, CsiPeriodRaterRatee, CsiQuestionSet,
            CsiOrgPerson, CsiPic, CsiServiceReportOwner, User, PermissionPreset, Site, Ticket, Notification, SystemSettings,
        ]),
        AuthModule,
        AuditModule,
        NotificationModule,
    ],
    controllers: [
        CsiAdminMasterController, CsiAdminPeriodController, CsiAdminReportController, CsiAdminReportSignoffController, CsiAdminMemoController, CsiMeController,
        CsiAdminSubjectController, CsiAdminAssignmentController, CsiAdminDashboardController, CsiAdminQuestionSetController, CsiAdminRaterBulkController,
        CsiAdminOrgController, CsiAdminReportOwnerController,
    ],
    providers: [CsiAdminGuard, CsiMasterService, CsiPeriodService, CsiRespondentService, CsiReportService, CsiSlaService, CsiExportService, CsiMemoService,
        CsiSubjectService, CsiAssignmentService, CsiReminderService, CsiDashboardService, CsiQuestionSetService, CsiRaterBulkService, ReportSignoffService, CsiOrgService, CsiUnitRulesService, CsiPairsExcelService,
        CsiAccessReader, CsiReportAccessService],
})
export class CsiModule { }
